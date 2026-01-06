#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { getEnvironmentConfig } from "../lib/config/environments";
import { BackendStack } from "../lib/stacks/backend-stack";

const app = new cdk.App();

const environmentName = app.node.tryGetContext("environment") || process.env.CDK_ENVIRONMENT || "dev";
const environmentConfig = getEnvironmentConfig(environmentName);

new BackendStack(app, `BackendStack-${environmentName}`, {
	environmentName,
	environmentConfig,
});

// Add app-level tags
cdk.Tags.of(app).add("Project", "kokkai-doc");
cdk.Tags.of(app).add("ManagedBy", "CDK");
cdk.Tags.of(app).add("Environment", environmentName);
