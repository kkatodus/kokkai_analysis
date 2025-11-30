import * as cdk from "aws-cdk-lib";
import {
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { BaseStackProps } from "../config/stack-props";

export interface FrontendStackProps extends BaseStackProps {
  readonly siteBucketName?: string;
  /**
   * File to serve when the user hits the root path.
   * @default "index.html"
   */
  readonly defaultRootObject?: string;
  /**
   * Whether to enable CloudFront access logging to a dedicated bucket.
   * If not specified, uses the value from environmentConfig.enableLogging
   */
  readonly enableLogging?: boolean;
  /**
   * Route SPA-style 403/404 responses back to the root document.
   * @default true
   */
  readonly spaRewrite?: boolean;
}

// FrontendStack provisions the S3 bucket and CloudFront distribution for the site.
export class FrontendStack extends cdk.Stack {
  // Expose the site bucket for deployments or post-deploy hooks.
  public readonly siteBucket: s3.Bucket;
  // Expose the CloudFront distribution so other stacks can reference it.
  public readonly distribution: cloudfront.Distribution;

  // The constructor wires everything together based on incoming props.
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    // Merge incoming props with defaults so we have concrete values to use below.
    const {
      siteBucketName,
      defaultRootObject = "index.html",
      enableLogging,
      spaRewrite = true,
      environmentConfig,
      environmentName,
      ...stackProps
    } = props;

    // Use environment-specific account and region
    const env = {
      account: environmentConfig.account,
      region: environmentConfig.region,
    };

    // Initialise the base Stack with environment config and remaining props.
    super(scope, id, {
      ...stackProps,
      env,
      tags: {
        ...environmentConfig.tags,
        Stack: "FrontendStack",
        ...stackProps.tags,
      },
    });

    // Determine bucket name: use prop, then environment config, then undefined (CDK generates)
    const bucketName =
      siteBucketName || environmentConfig.frontendBucketName;

    // Determine logging: use prop, then environment config, then false
    const shouldEnableLogging =
      enableLogging !== undefined
        ? enableLogging
        : environmentConfig.enableLogging;

    // Create the S3 bucket that stores the static assets for the frontend.
    this.siteBucket = new s3.Bucket(this, "FrontendBucket", {
      // Optionally apply a fixed bucket name if one was provided.
      ...(!bucketName ? {} : { bucketName }),
      // Ensure no direct public access; only CloudFront can read the bucket.
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Encrypt objects at rest with the default AWS-managed key.
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Force SSL for access attempts to protect data in transit.
      enforceSSL: true,
      // Keep object versions to enable rollbacks or debugging.
      versioned: true,
      // Retain the bucket on stack deletion to avoid accidental data loss.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Do not automatically delete objects; manual cleanup is safer.
      autoDeleteObjects: false,
    });

    // Create an Origin Access Identity so CloudFront can securely read the bucket.
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "FrontendOAI",
      {
        // Add a helpful comment in the AWS console.
        comment: `CloudFront access identity for ${environmentName} frontend bucket`,
      }
    );

    // Allow the CloudFront identity to read objects from the bucket.
    this.siteBucket.grantRead(originAccessIdentity);

    // Optionally create a separate bucket to store CloudFront access logs.
    const accessLogsBucket = shouldEnableLogging
      ? new s3.Bucket(this, "FrontendLogsBucket", {
          // Encrypt log files at rest.
          encryption: s3.BucketEncryption.S3_MANAGED,
          // Keep the logs bucket private as well.
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          // Require TLS for all access to the logs bucket.
          enforceSSL: true,
          // Retain logs on stack deletion for auditing purposes.
          removalPolicy: cdk.RemovalPolicy.RETAIN,
          // Avoid automatic removal of logs.
          autoDeleteObjects: false,
        })
      : undefined;

    // Define the CloudFront distribution that fronts the S3 bucket.
    this.distribution = new cloudfront.Distribution(
      this,
      "FrontendDistribution",
      {
        // Configure the default behaviour routing to the S3 origin.
        defaultBehavior: {
          // Map the S3 bucket as the origin, scoped to the OAI.
          origin: origins.S3BucketOrigin.withOriginAccessIdentity(
            this.siteBucket,
            {
              originAccessIdentity,
            }
          ),
          // Redirect all viewers to HTTPS.
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          // Only allow read-style HTTP verbs for the static site.
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          // Use AWS's standard caching behaviour for static sites.
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          // Enable gzip/brotli compression for faster delivery.
          compress: true,
        },
        // Keep costs low by serving primarily from the North America/Europe edge locations.
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        // Define the file CloudFront returns for the root path.
        defaultRootObject,
        // Configure access logging if we created a dedicated logs bucket.
        ...(accessLogsBucket
          ? {
              enableLogging: true,
              logBucket: accessLogsBucket,
              logFilePrefix: "cloudfront/",
            }
          : {}),
        // For SPA apps, rewrite 403/404 responses back to index.html so the client router handles them.
        ...(!spaRewrite
          ? {}
          : {
              errorResponses: [
                {
                  // Rewrite 403s to 200 with the SPA entrypoint.
                  httpStatus: 403,
                  responseHttpStatus: 200,
                  responsePagePath: `/${defaultRootObject}`,
                  ttl: cdk.Duration.minutes(5),
                },
                {
                  // Rewrite 404s similarly for missing deep links.
                  httpStatus: 404,
                  responseHttpStatus: 200,
                  responsePagePath: `/${defaultRootObject}`,
                  ttl: cdk.Duration.minutes(5),
                },
              ],
            }),
      }
    );

    // Output the bucket name for easy reference after deployment.
    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: this.siteBucket.bucketName,
      exportName: `FrontendBucketName-${environmentName}`,
    });

    // Output the distribution domain so you can wire DNS or test quickly.
    new cdk.CfnOutput(this, "FrontendDistributionDomainName", {
      value: this.distribution.distributionDomainName,
      exportName: `FrontendDistributionDomainName-${environmentName}`,
    });

    // Output the distribution ID for invalidations or automation hooks.
    new cdk.CfnOutput(this, "FrontendDistributionId", {
      value: this.distribution.distributionId,
      exportName: `FrontendDistributionId-${environmentName}`,
    });
  }
}

