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
		desiredCount:2,
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
				API_KEY: apiKeySecret.secretValueFromJson(props.environmentConfig.api_key_secret_key).toString(),
			},
		},
		healthCheckGracePeriod: cdk.Duration.seconds(60)
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
		defaultTtl: cdk.Duration.minutes(5),
		minTtl: cdk.Duration.seconds(0),
		maxTtl: cdk.Duration.hours(1),

		queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
		cookieBehavior: cloudfront.CacheCookieBehavior.none(),
		headerBehavior: cloudfront.CacheHeaderBehavior.none(),

		enableAcceptEncodingGzip: true,
		enableAcceptEncodingBrotli: true
	})

	// cloudfrontDistribution.addBehavior("/api/*",  new origins.LoadBalancerV2Origin(svc.loadBalancer, 
	// 	{
	// 		protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
	// 	}
	// ), {
	// 	allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
	// 	cachePolicy: publicCachePolicy,
	// 	originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
	// 	viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
	// })

	new cdk.CfnOutput(this, "AlbDns", {value: svc.loadBalancer.loadBalancerDnsName})
	new cdk.CfnOutput(this, "CloudfrontDomain", {value: cloudfrontDistribution.domainName})


  }
}