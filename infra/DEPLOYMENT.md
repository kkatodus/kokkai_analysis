# Branch-Based Deployment Strategy

This document explains the branch-based deployment strategy for KOKKAI DOC infrastructure and frontend.

## Overview

The project uses a **branch-per-environment** strategy where each branch automatically deploys to its corresponding AWS environment. This provides clear separation between environments and simplifies the deployment process.

## Branch Structure

```
dev  branch  →  dev  environment  (Development)
stg  branch  →  staging environment  (Staging)
prd  branch  →  prod  environment  (Production)
main/master →  No deployment (source of truth only)
```

**Important:** `main` and `master` branches do **NOT** trigger deployments. They serve as the source of truth and documentation branch only.

## How It Works

### Automatic Deployment

When you push code to a deployment branch, the corresponding GitHub Actions workflow automatically:

1. **Detects the branch name** (`dev`, `stg`, or `prd`)
2. **Maps it to an environment** using the following logic:
   - `dev` → `dev` environment
   - `stg` → `staging` environment
   - `prd` → `prod` environment
3. **Deploys to that environment** using the environment-specific configuration

**Note:** Pushes to `main` or `master` do **NOT** trigger deployments. These branches are for code storage and documentation only.

### Workflow Behavior

#### Infrastructure Deployment (`deploy-infra.yml`)

- **Triggers on:** Push to `dev`, `stg`, or `prd` when `infra/**` changes
- **PR Behavior:** Runs `cdk diff` for the target branch's environment (no deployment)
  - PRs to `main`/`master` default to `dev` environment for diff
- **Manual Trigger:** Can select any environment via workflow dispatch

#### Frontend Deployment (`deploy-frontend.yml`)

- **Triggers on:** Push to `dev`, `stg`, or `prd` when `frontend/**` changes
- **Manual Trigger:** Can select any environment via workflow dispatch
- **Requires:** Infrastructure stack must be deployed first

## Typical Workflow

### Development Cycle

The recommended development cycle follows this pattern:

```bash
# 1. Start from main (source of truth)
git checkout main
git pull origin main

# 2. Create or switch to dev branch
git checkout dev
git pull origin dev

# 3. Make changes to infra/ or frontend/
# ... edit files ...

# 4. Commit and push to dev
git add .
git commit -m "Add new feature"
git push origin dev

# GitHub Actions automatically deploys to dev environment
# Test in dev environment...

# 5. Merge dev into stg after testing
git checkout stg
git merge dev
git push origin stg

# GitHub Actions automatically deploys to staging environment
# Test in staging environment...

# 6. Merge stg into prd after testing
git checkout prd
git merge stg
git push origin prd

# GitHub Actions automatically deploys to production environment

# 7. Finally, merge prd back into main (no deployment)
git checkout main
git merge prd
git push origin main

# No deployment triggered - main is for documentation only
```

### Key Points

- **`main` branch**: Source of truth, no deployments
- **`dev` branch**: Development environment, first testing
- **`stg` branch**: Staging environment, pre-production testing
- **`prd` branch**: Production environment, live deployment
- **Workflow**: main → dev → stg → prd → main (no deployment on last step)

## Environment Configuration

Each environment has its own configuration in `lib/config/environments.ts`:

- **AWS Account ID** (can be different per environment)
- **AWS Region** (defaults to `us-east-1`)
- **S3 Bucket Name** (optional, CDK generates if not provided)
- **CloudFront Logging** (enabled for staging/prod, disabled for dev)
- **Resource Tags** (for cost tracking and organization)

## Stack Naming

Stacks are named with the environment suffix:

- `FrontendStack-dev` (deployed from `dev` branch)
- `FrontendStack-staging` (deployed from `stg` branch)
- `FrontendStack-prod` (deployed from `prd`, `main`, or `master` branch)

## Benefits

1. **Clear Separation**: Each environment has its own branch and AWS resources
2. **Automatic Mapping**: No need to manually specify environment - it's determined by branch
3. **Safe Deployments**: Changes go through dev → staging → production flow
4. **Easy Rollback**: Revert commits on a branch to rollback that environment
5. **Parallel Development**: Multiple developers can work on different environments simultaneously

## Manual Override

If you need to deploy a different environment than the branch suggests, you can use workflow dispatch:

1. Go to GitHub Actions
2. Select the workflow (`deploy-infra` or `deploy-frontend`)
3. Click "Run workflow"
4. Select the target environment
5. Run the workflow

**Note:** Manual deployments still require the infrastructure stack to exist for the target environment.

## Troubleshooting

### Wrong Environment Deployed

- Check the branch name matches the expected mapping
- Verify the workflow logs show the correct environment
- For manual triggers, ensure you selected the correct environment

### Stack Not Found

- Ensure infrastructure is deployed first: push to the branch with `infra/` changes
- Or manually trigger `deploy-infra` workflow for that environment

### Branch Not Recognized

- Only `dev`, `stg`, and `prd` branches trigger deployments
- Pushes to `main` or `master` will **NOT** trigger deployments (by design)
- Other branches will cause the workflow to fail with an error
- Create a PR to one of the deployment branches (`dev`, `stg`, or `prd`) instead

