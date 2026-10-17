# Infrastructure (`infra/`)

AWS CDK TypeScript app. Branch-based deployment: `dev` → dev, `stg` → staging, `prd` → prod. Pushes to `main`/`master` do **not** deploy.

## Stacks

| Stack | File | Provisions |
|---|---|---|
| BackendStack | `lib/stacks/backend-stack.ts` | VPC, ECS Fargate (port 8000), ALB, Aurora PostgreSQL + RDS Proxy; read/write grant on the (pre-existing, imported) S3 data-lake bucket |
| FrontendStack | `lib/frontend-stack.ts` | Private S3 bucket, CloudFront, optional logging, SPA 403/404 rewrites |

Environment config: `lib/config/environments.ts`.

## Deployment

- Infra: `.github/workflows/deploy-infra.yml` — triggers on `infra/**` changes
- Frontend: `.github/workflows/deploy-frontend.yml` — triggers on `frontend/**` changes
- See `infra/README.md` and `infra/DEPLOYMENT.md` for full details

## Data lake

**There is one data-lake bucket, `kokkai-doc-bucket-dev`, and every environment reads it, prod included.** Data lives under the `kokkai-doc/` prefix. Local dev uses the symlinked `s3_mirror/` at the repo root instead. Verified 2026-10-15 against the live account:

- `aws s3api list-buckets`: only `kokkai-doc-bucket-dev` and the CDK assets bucket exist. `kokkai-doc-bucket-prod` / `-staging` don't.
- Running ECS task definitions: prod (`BackendStackprodServiceV2TaskDef…:2`) and dev (`BackendStackdevServiceTaskDef…:33`) both have `DATA_LAKE_BUCKET_NAME=kokkai-doc-bucket-dev`.
- BackendStack doesn't create the bucket. It imports it by name (`s3.Bucket.fromBucketName`, from `data_lake_bucket_name_object_uri` in `lib/config/environments.ts`) and grants the task role read/write.

Consequences:

- Anything uploaded to `kokkai-doc-bucket-dev` (`speech_update`, `member_update`, `scripts/sync-s3-mirror.sh` in reverse) is live on kokkaidoc.com straight away, once the frontend's cache revalidates. There's no separate prod data copy to promote to.
- **Branch drift:** `prd` points prod at the dev bucket (commit `5a22df84`, "fixed s3 bucket name", 2026-01-06). `dev` still has the old `kokkai-doc-bucket-prod` value for `prod`. Merging `dev → prd` doesn't revert it, because `dev` has no `infra/` changes since the branches split. But don't copy `environments.ts` from `dev` to `prd`, and port the fix to `dev` when convenient. That's an `infra/**` change, so pushing it triggers the dev deploy.
- The `staging` entry still names a non-existent `kokkai-doc-bucket-staging`. A staging deploy would fail to read data until it's created or repointed.
- `infra/README.md` still describes a created `kokkai-doc-data-lake-bucket-${environment}`. That's out of date; this section is current.

## Frontend hosting

- Builds from `frontend/` → S3 sync + CloudFront invalidation
- Stack outputs: bucket name, distribution domain, distribution ID
