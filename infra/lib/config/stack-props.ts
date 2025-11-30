import * as cdk from "aws-cdk-lib";
import { EnvironmentConfig } from "./environments";

/**
 * Base props for all stacks that includes environment configuration.
 */
export interface BaseStackProps extends cdk.StackProps {
  /** Environment configuration */
  environmentConfig: EnvironmentConfig;
  /** Environment name (dev, staging, prod) */
  environmentName: string;
}

