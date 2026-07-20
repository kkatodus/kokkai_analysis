# Infrastructure (`infra/`)

AWS CDK TypeScript app. Branch-based deployment: `dev` → dev, `stg` → staging, `prd` → prod. Pushes to `main`/`master` do **not** deploy.

## Stacks

| Stack | File | Provisions |
|---|---|---|
| BackendStack | `lib/stacks/backend-stack.ts` | VPC, ECS Fargate (port 8000), ALB, Aurora PostgreSQL + RDS Proxy, S3 data-lake bucket |
| FrontendStack | `lib/frontend-stack.ts` | Private S3 bucket, CloudFront, optional logging, SPA 403/404 rewrites |

Environment config: `lib/config/environments.ts`.

## Deployment

- Infra: `.github/workflows/deploy-infra.yml` — triggers on `infra/**` changes
- Frontend: `.github/workflows/deploy-frontend.yml` — triggers on `frontend/**` changes
- See `infra/README.md` and `infra/DEPLOYMENT.md` for full details

## Data lake

Production backend reads/writes `kokkai-doc-data-lake-bucket-{environment}`. Local dev uses symlinked `s3_mirror/` at repo root.

## Frontend hosting

- Builds from `frontend/` → S3 sync + CloudFront invalidation
- Stack outputs: bucket name, distribution domain, distribution ID
