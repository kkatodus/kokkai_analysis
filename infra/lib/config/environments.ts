/**
 * Environment configuration for CDK stacks.
 * Defines environment-specific settings like account, region, and resource names.
 */

export interface EnvironmentConfig {
  /** AWS Account ID */
  account: string;
  /** AWS Region */
  region: string;
  /** Stack tags to apply to all resources */
  tags?: Record<string, string>;
  /** Data lake bucket name and object URI */
  data_lake_bucket_name_object_uri: string;
  data_lake_bucket_name: string;

  /** API key secret name */
  secret_arn: string;
  api_key_secret_key: string;
  /** CORS allow origins */
  cors_allow_origins: string[];
  /** Stripe secret key secret ARN */
  stripe_secret_key_secret_key: string;
  /** Stripe publishable key secret ARN */
  stripe_publishable_key_secret_key: string;
}

/**
 * Environment configurations for dev, staging, and production.
 * Update these values based on your AWS account setup.
 */
export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    account: process.env.AWS_ACCOUNT_ID_DEV || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    tags: {
      Environment: "dev",
      Project: "kokkai-doc",
    },
	data_lake_bucket_name_object_uri: "s3://kokkai-doc-bucket-dev/kokkai-doc/",
	data_lake_bucket_name: "kokkai-doc-bucket-dev",
	secret_arn: "arn:aws:secretsmanager:ap-northeast-1:641577182081:secret:dev/kokkaidoc/api-CWi9sp",
	api_key_secret_key: "kokkai-doc-dev-api-key",
	cors_allow_origins: ["*"],
	stripe_secret_key_secret_key: "stripe-secret-key",
	stripe_publishable_key_secret_key: "stripe-publishable-key"
  },
  staging: {
    account: process.env.AWS_ACCOUNT_ID_STAGING || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    tags: {
      Environment: "staging",
      Project: "kokkai-doc",
    },
	data_lake_bucket_name_object_uri: "s3://kokkai-doc-bucket-staging/kokkai-doc/",
	data_lake_bucket_name: "kokkai-doc-bucket-staging",
	secret_arn: "arn:aws:secretsmanager:ap-northeast-1:641577182081:secret:dev/kokkaidoc/api-CWi9sp",
	api_key_secret_key: "kokkai-doc-staging-api-key",
	cors_allow_origins: ["https://staging.kokkaidoc.com"],
	stripe_secret_key_secret_key: "stripe-secret-key",
	stripe_publishable_key_secret_key: "stripe-publishable-key"
  },
  prod: {
    account: process.env.AWS_ACCOUNT_ID_PROD || process.env.CDK_DEFAULT_ACCOUNT || "",
    region: process.env.AWS_REGION || "ap-northeast-1",
    tags: {
      Environment: "prod",	
      Project: "kokkai-doc",
    },
	data_lake_bucket_name_object_uri: "s3://kokkai-doc-bucket-prod/kokkai-doc/",
	data_lake_bucket_name: "kokkai-doc-bucket-prod",
	secret_arn: "arn:aws:secretsmanager:ap-northeast-1:641577182081:secret:dev/kokkaidoc/api-CWi9sp",
	api_key_secret_key: "kokkai-doc-prod-api-key",
	cors_allow_origins: ["https://kokkaidoc.com", "https://kokkaidoc.vercel.app"],
	stripe_secret_key_secret_key: "stripe-secret-key",
	stripe_publishable_key_secret_key: "stripe-publishable-key"
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