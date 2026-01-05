import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as path from "path";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { BaseStackProps } from "../config/stack-props";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

	const vpc = new ec2.Vpc(this, "Vpc", {
		maxAzs: 2, 
		natGateways: 1,
	})

	const ECSCluster = new ecs.Cluster(this, "Cluster", {
		vpc,
	})

	const apiKeySecret = secrets.Secret.fromSecretCompleteArn(this, "ApiKeySecret", props.environmentConfig.api_key_secret_arn);

	const dataLakeBucketName = props.environmentConfig.data_lake_bucket_name_object_uri.split("/")[2];
	const dataLakeBucket = s3.Bucket.fromBucketName(this, "DataLakeBucket", dataLakeBucketName);

	const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
		cluster: ECSCluster,
		cpu: 512,
		// ECS Patterns construct requires desiredCount > 0 at synth time.
		// We still allow scale-to-zero via autoscaling (minCapacity: 0) after deploy.
		desiredCount: 1,
		memoryLimitMiB: 1024,
		taskImageOptions:{
			// Resolve from this file's directory so deploys work regardless of the current working directory.
			image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, "../../../backend")),
			containerPort: 8000,
			environment: {
				DATA_LAKE_BUCKET_NAME_OBJECT_URI: props.environmentConfig.data_lake_bucket_name_object_uri,
				DATA_LAKE_BUCKET_NAME: dataLakeBucketName,
				ENVIRONMENT: props.environmentName,
				STORAGE_BACKEND: "s3",
				CORS_ALLOW_ORIGINS: props.environmentConfig.cors_allow_origins,
			},
			// Inject secrets at runtime (do NOT synth them into CloudFormation).
			secrets: {
				API_KEY: ecs.Secret.fromSecretsManager(apiKeySecret, props.environmentConfig.api_key_secret_key),
			},
		},
		healthCheckGracePeriod: cdk.Duration.seconds(60)
	})

	// Autoscaling for dev: scale out on traffic, scale in after extended idle.
	//
	// NOTE: With an ALB in front, scaling from 0 means the *first* request will likely see a 503
	// until at least one task is started and passes health checks.
	const scalableTarget = svc.service.autoScaleTaskCount({
		minCapacity: 0,
		maxCapacity: 2,
	})

	// Scale OUT quickly when requests hit the load balancer (even if there are currently 0 healthy targets).
	scalableTarget.scaleOnMetric("AlbRequestCountScaling", {
		metric: svc.loadBalancer.metrics.requestCount({
			period: cdk.Duration.minutes(1),
			statistic: cloudwatch.Stats.SUM,
		}),
		// Only scale out; scale-in is handled by CPU target tracking with a long cooldown.
		scalingSteps: [
			{ lower: 1, change: +1 },
			{ lower: 50, change: +1 },
		],
		cooldown: cdk.Duration.minutes(2),
	})

	// Scale IN after being idle for a while (keep tasks warm for up to ~1 hour).
	scalableTarget.scaleOnCpuUtilization("CpuTargetTracking", {
		targetUtilizationPercent: 20,
		scaleOutCooldown: cdk.Duration.minutes(2),
		scaleInCooldown: cdk.Duration.hours(1),
	})

	// The ALB target group health check defaults to "/" which our FastAPI app doesn't serve.
	// Use the app's explicit health endpoint instead.
	svc.targetGroup.configureHealthCheck({
		path: "/health",
		healthyHttpCodes: "200",
	})
	dataLakeBucket.grantReadWrite(svc.taskDefinition.taskRole)

	const cloudfrontDistribution = new cloudfront.Distribution(this, "ApiDistribution", {
		defaultBehavior:{
			origin: new origins.LoadBalancerV2Origin(svc.loadBalancer, {
				protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
			}),
			allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
			cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
			originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
		}
	})

	const publicCachePolicy = new cloudfront.CachePolicy(this, "PublicCachePolicy", {
		// IMPORTANT: defaultTtl must be <= maxTtl.
		defaultTtl: cdk.Duration.minutes(5),
		minTtl: cdk.Duration.seconds(0),
		maxTtl: cdk.Duration.hours(1),

		queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
		cookieBehavior: cloudfront.CacheCookieBehavior.none(),
		// IMPORTANT: This endpoint is protected by an API key header. If the cache key
		// does not vary by that header, CloudFront can cache an authorized (200) response
		// and serve it to unauthorized requests without ever hitting the origin.
		headerBehavior: cloudfront.CacheHeaderBehavior.allowList("X-API-KEY"),

		enableAcceptEncodingGzip: true,
		enableAcceptEncodingBrotli: true
	})
	const cachedOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
		this,
		"CachedApiOriginRequestPolicy",
		{
		  queryStringBehavior:cloudfront.OriginRequestQueryStringBehavior.all(),
		  headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
			"X-API-KEY"
		  ),
		  cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
		}
	  );
	const cacheEndpoints = [
		"/geo/senkyokuPolydata",
		"/parliamentMember",
	]

	for (const endpoint of cacheEndpoints) {
		cloudfrontDistribution.addBehavior(endpoint,  new origins.LoadBalancerV2Origin(svc.loadBalancer, 
			{
				protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
			}
		), {
			allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
			cachePolicy: publicCachePolicy,
			originRequestPolicy: cachedOriginRequestPolicy,
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
		})
	}

	new cdk.CfnOutput(this, "AlbDns", {value: svc.loadBalancer.loadBalancerDnsName})
	new cdk.CfnOutput(this, "CloudfrontDomain", {value: cloudfrontDistribution.domainName})


  }
}