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

	const dbsecret = new rds.DatabaseSecret(this, 'DbSecret', {
		username: 'app_user',
	})

	const db = new rds.DatabaseInstance(this, 'Db', {
		vpc,
		engine: rds.DatabaseInstanceEngine.postgres({
			version: rds.PostgresEngineVersion.VER_17_6,
		}),
		credentials: rds.Credentials.fromSecret(dbsecret),
		instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
		allocatedStorage: 20,
		databaseName: 'app_db',
		multiAz: false,
		storageEncrypted: true,
		backupRetention: cdk.Duration.days(7),
		publiclyAccessible: false,
		deletionProtection: true,
		maxAllocatedStorage: 100,
	});



  }
}