---
name: load-project-guide
description: Load only the KOKKAI DOC agent guides relevant to the current task. Use when starting work on backend, frontend, data pipelines, infra, or research — or when the user asks for project context without loading all of AGENTS.md.
---

Read [AGENTS.md](../../AGENTS.md) first (the index — it is short).

Use **`./scripts/` helpers** to save tokens before opening files:

1. `./scripts/route-task.sh "<task>"` — pick guide(s)
2. `./scripts/show-guide.sh <name>` — load one guide (`backend`, `data-layout`, …)
3. `./scripts/list-api-routes.sh`, `list-frontend-routes.sh`, `list-data-dirs.sh`, or `tree-pillar.sh` as needed

Run `./scripts/agent-help.sh` for the full list. Do not read every file in `docs/agents/` unless the task truly spans all areas.

## Routing

| If the task touches… | Read |
|---|---|
| FastAPI, routers, S3 storage, API keys | `docs/agents/BACKEND.md` |
| Next.js pages, components, client fetch | `docs/agents/FRONTEND.md` |
| Python scripts, scraping, LLM pipelines | `docs/agents/DATA-PIPELINES.md` |
| Dataset paths, `data/data/`, s3_mirror sync | `docs/agents/DATA-LAYOUT.md` |
| CDK, deploy, AWS | `docs/agents/INFRA.md` |
| Papers, embeddings, UMAP, fine-tuning | `docs/agents/RESEARCHER.md` |
| API shapes, wiring frontend to backend | `docs/agents/CONTRACTS.md` |
| Secrets, env vars, running scripts safely | `docs/agents/ENVIRONMENT.md` |

## Rules

1. Start from the index routing table — pick the smallest set of guides that covers the task.
2. If a detail is missing from a guide, explore the codebase; do not preemptively load unrelated guides.
3. For cross-cutting features (new dataset → API → UI), read in order: DATA-LAYOUT → BACKEND → FRONTEND → CONTRACTS.
4. Prefer one focused guide over re-loading the old monolithic AGENTS.md pattern.
