import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
		removalPolicy: props.environmentName == "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
		blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
		encryption: s3.BucketEncryption.S3_MANAGED,
		versioned: true,
	})

	const dbCredentials = rds.Credentials.fromGeneratedSecret(`kokkai_doc_user_${props.environmentName}`);

	const db = new rds.DatabaseCluster(this, 'AuroraCluster', {
		vpc, 
		engine: rds.DatabaseClusterEngine.auroraPostgres({
			version: rds.AuroraPostgresEngineVersion.VER_17_4,
		}),
		credentials: dbCredentials,
		defaultDatabaseName: 'kokkai_doc_db',
		writer: rds.ClusterInstance.serverlessV2('writer'),
		serverlessV2MinCapacity: 0.5,
		serverlessV2MaxCapacity: 4,
		vpcSubnets: {
			subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
		},
		deletionProtection: true,
	})

	const proxy = new rds.DatabaseProxy(this, "DbProxy", {
		proxyTarget: rds.ProxyTarget.fromCluster(db),
		secrets: [db.secret!],
		vpc, 
		requireTLS: true,
		iamAuth: false
	})

	const cluster = new ecs.Cluster(this, "Cluster", {
		vpc,
	})

	const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
		cluster: cluster,
		cpu: 512,
		desiredCount:2,
		memoryLimitMiB: 1024,
		taskImageOptions:{
			image: ecs.ContainerImage.fromAsset("../backend"),
			containerPort: 8000,
			environment: {
				DB_HOST: proxy.endpoint,
				DB_PORT: "5432",
				DB_USER: "kokkai_doc_user",
				S3_BUCKET_NAME: bucket.bucketName,
				DB_NAME: "kokkai_doc_db",
			
			},
			secrets: {
				DB_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, "password")
			},
		},
		healthCheckGracePeriod: cdk.Duration.seconds(60)
	})

	proxy.connections.allowDefaultPortFrom(svc.service, "Allow traffic from the service to the proxy");

	bucket.grantReadWrite(svc.taskDefinition.taskRole)

	new cdk.CfnOutput(this, "AlbDns", {value: svc.loadBalancer.loadBalancerDnsName})
	new cdk.CfnOutput(this, "DbProxyEndpoint", {value: proxy.endpoint})


  }
}