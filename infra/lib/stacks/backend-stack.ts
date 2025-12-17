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
		removalPolicy: cdk.RemovalPolicy.DESTROY,
	})

	const dbCredentials = rds.Credentials.fromGeneratedSecret('app_user');

	const db = new rds.DatabaseCluster(this, 'AuroraCluster', {
		vpc, 
		engine: rds.DatabaseClusterEngine.auroraPostgres({
			version: rds.AuroraPostgresEngineVersion.VER_17_4,
		}),
		credentials: dbCredentials,
		defaultDatabaseName: 'app_db',
		writer: rds.ClusterInstance.serverlessV2('writer'),
		serverlessV2MinCapacity: 0.5,
		serverlessV2MaxCapacity: 4,
		vpcSubnets: {
			subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
		},
		deletionProtection: true,
	})

  }
}