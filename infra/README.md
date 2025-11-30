# CDK Infrastructure for KOKKAI DOC

This directory contains the AWS CDK infrastructure code for deploying the KOKKAI DOC platform to AWS.

## Overview

The infrastructure is organized into stacks that can be deployed independently:

- **FrontendStack** - S3 bucket and CloudFront distribution for the React frontend

## Project Structure

```
infra/
├── bin/
│   └── infra.ts                  # CDK app entry point
├── lib/
│   ├── stacks/
│   │   └── frontend-stack.ts     # Frontend infrastructure (S3 + CloudFront)
│   └── config/
│       ├── environments.ts       # Environment configurations (dev/staging/prod)
│       └── stack-props.ts         # Shared stack props interfaces
├── cdk.json                      # CDK configuration
└── package.json                  # Dependencies
```

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`

## Local Development

### Install Dependencies

```bash
cd infra
npm install
```

### Build

```bash
npm run build
```

### Deploy

Deploy to a specific environment:

```bash
# Deploy to dev environment
npx cdk deploy --context environment=dev

# Deploy to staging environment
npx cdk deploy --context environment=staging

# Deploy to production environment
npx cdk deploy --context environment=prod
```

Or set the environment via environment variable:

```bash
export CDK_ENVIRONMENT=prod
npx cdk deploy
```

### Other Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm test` - Run unit tests
- `npx cdk synth` - Synthesize CloudFormation templates
- `npx cdk diff` - Compare deployed stack with current state
- `npx cdk destroy` - Destroy the stack

## GitHub Actions Deployment

The infrastructure is automatically deployed via GitHub Actions workflows using a **branch-based deployment strategy**.

### Branch-to-Environment Mapping

Each branch automatically deploys to its corresponding environment:

| Branch | Environment | Description |
|--------|-------------|-------------|
| `dev` | `dev` | Development environment |
| `stg` | `staging` | Staging environment |
| `prd`, `main`, or `master` | `prod` | Production environment |

### Workflows

1. **`.github/workflows/deploy-infra.yml`** - Deploys CDK stacks when `infra/` directory changes
2. **`.github/workflows/deploy-frontend.yml`** - Builds and deploys frontend assets to S3/CloudFront

### Required GitHub Secrets

Configure the following secrets in your GitHub repository settings:

- `AWS_ACCESS_KEY_ID` - AWS access key for deployment
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_ACCOUNT_ID_DEV` - (Optional) Dev account ID
- `AWS_ACCOUNT_ID_STAGING` - (Optional) Staging account ID
- `AWS_ACCOUNT_ID_PROD` - (Optional) Production account ID

### Required GitHub Variables

- `AWS_REGION` - Default AWS region (e.g., `us-east-1`)

### Workflow Triggers

**Infrastructure Deployment:**
- Automatically triggers on push to `dev`, `stg`, or `prd` when `infra/**` files change
- Environment is automatically determined from the branch name
- Can be manually triggered via workflow dispatch with environment selection
- On pull requests, runs `cdk diff` for the target branch's environment (no deployment)
- **Note**: Pushes to `main` or `master` do **NOT** trigger deployments

**Frontend Deployment:**
- Automatically triggers on push to `dev`, `stg`, or `prd` when `frontend/**` files change
- Environment is automatically determined from the branch name
- Can be manually triggered via workflow dispatch with environment selection
- Requires infrastructure stack to be deployed first for the target environment
- **Note**: Pushes to `main` or `master` do **NOT** trigger deployments

### Deployment Flow

1. **Development**: Push to `dev` branch → Deploys to `dev` environment
2. **Staging**: Push to `stg` branch → Deploys to `staging` environment
3. **Production**: Push to `prd` branch → Deploys to `prod` environment
4. **Main/Master**: No deployment (source of truth only) - merge from `prd` after production deployment

### Manual Deployment

You can manually trigger deployments via workflow dispatch:
- Select the target environment (dev, staging, or prod)
- The workflow will deploy to the selected environment regardless of the current branch

## Environment Configuration

Environments are configured in `lib/config/environments.ts`. Each environment specifies:

- AWS Account ID
- AWS Region
- Optional S3 bucket name
- CloudFront logging settings
- Resource tags

To modify environment settings, edit `lib/config/environments.ts` or set the corresponding environment variables:

- `AWS_ACCOUNT_ID_DEV`, `AWS_ACCOUNT_ID_STAGING`, `AWS_ACCOUNT_ID_PROD`
- `AWS_REGION`
- `FRONTEND_BUCKET_NAME_DEV`, `FRONTEND_BUCKET_NAME_STAGING`, `FRONTEND_BUCKET_NAME_PROD`

## Stack Outputs

After deployment, the FrontendStack outputs:

- `FrontendBucketName` - S3 bucket name for frontend assets
- `FrontendDistributionDomainName` - CloudFront distribution domain
- `FrontendDistributionId` - CloudFront distribution ID (for cache invalidations)

These outputs are exported with environment-specific names (e.g., `FrontendBucketName-prod`) and can be referenced by other stacks or deployment scripts.

## First-Time Setup

1. **Create environment branches** (if not already created):
   ```bash
   git checkout -b dev
   git push -u origin dev
   
   git checkout -b stg
   git push -u origin stg
   
   git checkout -b prd  # or use main/master for production
   git push -u origin prd
   ```

2. **Bootstrap CDK** (if not already done):
   ```bash
   npx cdk bootstrap aws://ACCOUNT-ID/REGION
   ```
   The GitHub Actions workflow will automatically bootstrap if needed.

3. **Configure GitHub Secrets** as listed above.

4. **Deploy infrastructure** for each environment:
   - Push changes to `infra/` directory on the respective branch (`dev`, `stg`, or `prd`), or
   - Manually trigger the `deploy-infra` workflow and select the environment

5. **Deploy frontend** for each environment:
   - Push changes to `frontend/` directory on the respective branch, or
   - Manually trigger the `deploy-frontend` workflow and select the environment

## Troubleshooting

### CDK Bootstrap Required

If you see an error about CDK bootstrap, the workflow will attempt to bootstrap automatically. For manual bootstrap:

```bash
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Stack Not Found

If the frontend deployment fails with "stack not found", ensure the infrastructure stack is deployed first:

```bash
npx cdk deploy --context environment=ENV
```

### Permission Errors

Ensure your AWS credentials have the necessary permissions:
- CloudFormation (create/update/delete stacks)
- S3 (create buckets, manage objects)
- CloudFront (create distributions, invalidate cache)
- IAM (for CDK bootstrap and stack creation)

## Future Enhancements

Planned infrastructure additions:

- API Stack (API Gateway + Lambda functions)
- Data Stack (S3 Data Lake, OpenSearch)
- Base Stack (VPC, shared resources)

## Workflow Status

[![Deploy Infrastructure](https://github.com/USERNAME/REPO/actions/workflows/deploy-infra.yml/badge.svg)](https://github.com/USERNAME/REPO/actions/workflows/deploy-infra.yml)
[![Deploy Frontend](https://github.com/USERNAME/REPO/actions/workflows/deploy-frontend.yml/badge.svg)](https://github.com/USERNAME/REPO/actions/workflows/deploy-frontend.yml)

*Note: Update the badge URLs with your actual GitHub username and repository name.*
