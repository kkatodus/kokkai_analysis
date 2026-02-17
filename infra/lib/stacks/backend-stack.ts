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
		// Cost lever: NAT Gateways are a large fixed monthly cost.
		// For low-traffic APIs, prefer no NAT and let tasks have a public IP for outbound access.
		// Tradeoff: tasks run in public subnets (still protected by SGs; not directly exposed).
		natGateways: 0,
	})

	const ECSCluster = new ecs.Cluster(this, "Cluster", {
		vpc,
	})

	const secretsManager = secrets.Secret.fromSecretCompleteArn(this, "SecretsManager", props.environmentConfig.secret_arn);

	const dataLakeBucketName = props.environmentConfig.data_lake_bucket_name_object_uri.split("/")[2];
	const dataLakeBucket = s3.Bucket.fromBucketName(this, "DataLakeBucket", dataLakeBucketName);

	const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
		cluster: ECSCluster,
		cpu: 512,
		// ECS Patterns construct requires desiredCount > 0 at synth time.
		// We still allow scale-to-zero via autoscaling (minCapacity: 0) after deploy.
		desiredCount: 1,
		memoryLimitMiB: 1024,
		// Without NAT, tasks need a public IP for outbound access (ECR image pulls, S3, Secrets Manager, etc.).
		assignPublicIp: true,
		taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
		taskImageOptions:{
			// Resolve from this file's directory so deploys work regardless of the current working directory.
			image: ecs.ContainerImage.fromAsset(path.resolve(__dirname, "../../../backend")),
			containerPort: 8000,
			environment: {
				DATA_LAKE_BUCKET_NAME_OBJECT_URI: props.environmentConfig.data_lake_bucket_name_object_uri,
				DATA_LAKE_BUCKET_NAME: dataLakeBucketName,
				ENVIRONMENT: props.environmentName,
				STORAGE_BACKEND: "s3",
				// pydantic-settings treats List[str] env vars as "complex" and attempts JSON parsing.
				// Always provide valid JSON here to avoid parsing failures (e.g. "*" would break json.loads).
				CORS_ALLOW_ORIGINS: JSON.stringify(props.environmentConfig.cors_allow_origins),
			},
			// Inject secrets at runtime (do NOT synth them into CloudFormation).
			secrets: {
				API_KEY: ecs.Secret.fromSecretsManager(secretsManager, props.environmentConfig.api_key_secret_key),
				STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(secretsManager, props.environmentConfig.stripe_secret_key_secret_key),
				STRIPE_PUBLISHABLE_KEY: ecs.Secret.fromSecretsManager(secretsManager, props.environmentConfig.stripe_publishable_key_secret_key),
			},
		},
		healthCheckGracePeriod: cdk.Duration.seconds(60)
	})

	// Autoscaling for dev: scale out on traffic, scale in after extended idle.
	//
	// NOTE: With an ALB in front, scaling from 0 means the *first* request will likely see a 503
	// until at least one task is started and passes health checks.
	const scalableTarget = svc.service.autoScaleTaskCount({
		// Cost lever: allow scale-to-zero in all environments. If you'd rather avoid cold starts in prod,
		// change this back to `props.environmentName === "prod" ? 1 : 0`.
		minCapacity: 0,
		maxCapacity: 1,
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
		// Cost lever: scale in faster after traffic stops.
		// Tradeoff: more cold starts if traffic is sporadic.
		scaleInCooldown: cdk.Duration.minutes(15),
	})

	// The ALB target group health check defaults to "/" which our FastAPI app doesn't serve.
	// Use the app's explicit health endpoint instead.
	svc.targetGroup.configureHealthCheck({
		path: "/health",
		healthyHttpCodes: "200",
	})
	dataLakeBucket.grantReadWrite(svc.taskDefinition.taskRole)

	// Reject requests missing an API key at the edge so they never hit the ALB/Fargate origin.
	// Note: this only checks *presence* of X-API-KEY; the origin still validates correctness.
	const requireApiKeyFunction = new cloudfront.Function(this, "RequireApiKeyFunction", {
		code: cloudfront.FunctionCode.fromInline(`
			function handler(event) {
			var request = event.request;
			var headers = request.headers || {};

			// Keep /health reachable if you ever hit it through CloudFront (ALB health checks hit ALB directly).
			if (request.uri && request.uri.indexOf('/health') === 0) {
				return request;
			}

			var apiKey = headers['x-api-key'];
			if (!apiKey || !apiKey.value) {
				return {
				statusCode: 401,
				statusDescription: 'Unauthorized',
				headers: {
					'content-type': { value: 'application/json; charset=utf-8' },
					'cache-control': { value: 'no-store' }
				},
				body: JSON.stringify({ detail: 'Missing API key' })
				};
			}

			return request;
			}
		`),
	})

	const cloudfrontDistribution = new cloudfront.Distribution(this, "ApiDistribution", {
		defaultBehavior:{
			origin: new origins.LoadBalancerV2Origin(svc.loadBalancer, {
				protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
			}),
			allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
			cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
			originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
			functionAssociations: [{ eventType: cloudfront.FunctionEventType.VIEWER_REQUEST, function: requireApiKeyFunction }],
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
		"/speeches/available",
		"/speeches/get_first_page_of_all_topics",
		"/speeches/get",
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
			functionAssociations: [{ eventType: cloudfront.FunctionEventType.VIEWER_REQUEST, function: requireApiKeyFunction }],
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
		})
	}

	new cdk.CfnOutput(this, "AlbDns", {value: svc.loadBalancer.loadBalancerDnsName})
	new cdk.CfnOutput(this, "CloudfrontDomain", {value: cloudfrontDistribution.domainName})


  }
}