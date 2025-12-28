import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from "path";
import { BaseStackProps } from "../config/stack-props";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

	const vpc = new ec2.Vpc(this, "Vpc", {
		maxAzs: 2, 
		natGateways: 1,
	})

	const bucket = new s3.Bucket(this, "Bucket", {
		bucketName: `kokkai-doc-data-lake-bucket-${props.environmentName}`,
		removalPolicy: cdk.RemovalPolicy.RETAIN,
		blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
		encryption: s3.BucketEncryption.S3_MANAGED,
		versioned: true,
	})

	// const dbCredentials = rds.Credentials.fromGeneratedSecret(`kokkai_doc_user_${props.environmentName}`);

	// const db = new rds.DatabaseCluster(this, 'AuroraCluster', {
	// 	vpc, 
	// 	engine: rds.DatabaseClusterEngine.auroraPostgres({
	// 		version: rds.AuroraPostgresEngineVersion.VER_17_4,
	// 	}),
	// 	credentials: dbCredentials,
	// 	defaultDatabaseName: 'kokkai_doc_db',
	// 	writer: rds.ClusterInstance.serverlessV2('writer'),
	// 	serverlessV2MinCapacity: 0.5,
	// 	serverlessV2MaxCapacity: 4,
	// 	vpcSubnets: {
	// 		subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
	// 	},
	// })

	// const proxy = new rds.DatabaseProxy(this, "DbProxy", {
	// 	proxyTarget: rds.ProxyTarget.fromCluster(db),
	// 	secrets: [db.secret!],
	// 	vpc, 
	// 	requireTLS: true,
	// 	iamAuth: false
	// })

	const ECSCluster = new ecs.Cluster(this, "Cluster", {
		vpc,
	})

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
				S3_BUCKET_NAME: bucket.bucketName,
			
			},
		},
		healthCheckGracePeriod: cdk.Duration.seconds(60)
	})

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

	cloudfrontDistribution.addBehavior("/api/*",  new origins.LoadBalancerV2Origin(svc.loadBalancer, 
		{
			protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
		}
	), {
		allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
		cachePolicy: publicCachePolicy,
		originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
		viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
	})


	bucket.grantReadWrite(svc.taskDefinition.taskRole)

	new cdk.CfnOutput(this, "AlbDns", {value: svc.loadBalancer.loadBalancerDnsName})
	new cdk.CfnOutput(this, "CloudfrontDomain", {value: cloudfrontDistribution.domainName})


  }
}