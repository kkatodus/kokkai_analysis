#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FrontendStack } from "../lib/stacks/frontend-stack";
import { getEnvironmentConfig } from "../lib/config/environments";

const app = new cdk.App();

// Get environment from context, environment variable, or default to 'dev'
const environmentName =
  app.node.tryGetContext("environment") ||
  process.env.CDK_ENVIRONMENT ||
  "dev";

// Load environment-specific configuration
const environmentConfig = getEnvironmentConfig(environmentName);


// Add app-level tags
cdk.Tags.of(app).add("Project", "kokkai-doc");
cdk.Tags.of(app).add("ManagedBy", "CDK");
cdk.Tags.of(app).add("Environment", environmentName);
