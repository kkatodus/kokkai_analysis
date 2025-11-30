/**
 * Environment configuration for CDK stacks.
 * Defines environment-specific settings like account, region, and resource names.
 */

export interface EnvironmentConfig {
  /** AWS Account ID */
  account: string;
  /** AWS Region */
  region: string;
  /** Optional S3 bucket name for frontend (if not provided, CDK will generate one) */
  frontendBucketName?: string;
  /** Enable CloudFront access logging */
  enableLogging: boolean;
  /** Stack tags to apply to all resources */
  tags?: Record<string, string>;
}

/**
 * Environment configurations for dev, staging, and production.
 * Update these values based on your AWS account setup.
 */
export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    account: process.env.AWS_ACCOUNT_ID_DEV || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    frontendBucketName: process.env.FRONTEND_BUCKET_NAME_DEV,
    enableLogging: false,
    tags: {
      Environment: "dev",
      Project: "kokkai-doc",
    },
  },
  staging: {
    account: process.env.AWS_ACCOUNT_ID_STAGING || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    frontendBucketName: process.env.FRONTEND_BUCKET_NAME_STAGING,
    enableLogging: true,
    tags: {
      Environment: "staging",
      Project: "kokkai-doc",
    },
  },
  prod: {
    account: process.env.AWS_ACCOUNT_ID_PROD || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    frontendBucketName: process.env.FRONTEND_BUCKET_NAME_PROD,
    enableLogging: true,
    tags: {
      Environment: "prod",
      Project: "kokkai-doc",
    },
  },
};

/**
 * Get environment configuration by name.
 * @param envName Environment name (dev, staging, prod)
 * @returns Environment configuration
 * @throws Error if environment is not found
 */
export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(
      `Unknown environment: ${envName}. Available environments: ${Object.keys(environments).join(", ")}`
    );
  }
  return config;
}

