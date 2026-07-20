Project quickstart for agents
=============================

KOKKAI DOC visualises Japanese Diet activity: scraped vote records, representative info, speeches, manifesto analysis, ideological scaling research, and UTAS candidate survey data (`data/data/u-tokyo-asahi/`).

**Do not load every guide below.** Read this index, pick the guides that match your task, and open only those files.

## Agent helper scripts (`scripts/`)

Prefer running these via Shell **instead of** listing directories or opening many files to discover structure:

| Script | Use when… |
|---|---|
| `./scripts/agent-help.sh` | You need the full list of helpers (start here) |
| `./scripts/route-task.sh "<task>"` | Unsure which guide(s) apply |
| `./scripts/show-guide.sh <name>` | Load one guide (`backend`, `data-layout`, …) |
| `./scripts/list-guides.sh` | See all guides with one-line summaries |
| `./scripts/tree-pillar.sh <pillar>` | Shallow tree: `backend`, `frontend`, `data`, `infra`, `paper` |
| `./scripts/list-api-routes.sh` | FastAPI endpoints without reading routers |
| `./scripts/list-frontend-routes.sh` | Next.js pages and `app/api` handlers |
| `./scripts/list-data-dirs.sh` | Top-level `data/data/` and `s3_mirror/` dirs |
| `./scripts/list-pipeline-scripts.sh` | Python/notebook entry points under `data/` |
| `./scripts/list-skills.sh` | Available `.agents/skills` |
| `./scripts/sync-skills.sh` | Copy skills to `.cursor/skills` and `.claude/skills` |
| `./scripts/list-specs.sh` | Planned projects under `specs/` |

Project skills (load explicitly): **update-agent-docs** (sync `docs/agents/` with data, pipelines, API, infra, specs) → **finalize** (same, then commit and open a PR against `main`). Drift check: `.agents/skills/update-agent-docs/scripts/audit-agent-docs.sh`.

Typical flow: `route-task.sh` → `show-guide.sh` → one targeted `list-*` script → open only the source files you need.

## Planned work (`specs/`)

Future project plans and design docs live in **`specs/`**. Start at **[specs/README.md](specs/README.md)** — the index of all specs (update that file whenever you add a new planned project).

| Resource | Use when… |
|---|---|
| [specs/README.md](specs/README.md) | Browsing or adding planned initiatives |
| `specs/<slug>/README.md` | Implementing or reviewing one specific plan |
| `./scripts/list-specs.sh` | Compact list of spec folders without loading every file |

If a task references a plan, spec, or not-yet-built feature, read the relevant `specs/<slug>/` doc before changing production code.

## Pillars

| Directory | Guide | Read when… |
|---|---|---|
| `backend/` | [BACKEND.md](docs/agents/BACKEND.md) | API routes, storage, auth, FastAPI changes |
| `frontend/` | [FRONTEND.md](docs/agents/FRONTEND.md) | Next.js UI, components, client/server data fetching |
| `data/` | [DATA-PIPELINES.md](docs/agents/DATA-PIPELINES.md) | Scraping, LLM pipelines, Python scripts |
| `data/data/` | [DATA-LAYOUT.md](docs/agents/DATA-LAYOUT.md) | Dataset paths, pipeline → S3 mirror mapping |
| `infra/` | [INFRA.md](docs/agents/INFRA.md) | CDK, AWS deploy, GitHub Actions |
| `paper/` | [RESEARCHER.md](docs/agents/RESEARCHER.md) | Papers, stance quantification, embeddings, labelling |
| (cross-cutting) | [CONTRACTS.md](docs/agents/CONTRACTS.md) | Frontend ↔ backend API shapes, adding new datasets |
| (cross-cutting) | [ENVIRONMENT.md](docs/agents/ENVIRONMENT.md) | Secrets, tooling, agent cautions |

## Quick routing

```
Task involves…                          → Open
─────────────────────────────────────────────────────────
UI page, React component, Next.js route → FRONTEND.md
FastAPI router, S3 read, API key        → BACKEND.md
Python scrape / LLM script              → DATA-PIPELINES.md
Where does this JSON file live?         → DATA-LAYOUT.md
Deploy, VPC, ECS, CloudFront            → INFRA.md
UMAP, axes, fine-tuning, LaTeX paper    → RESEARCHER.md
UTAS survey data, scaling validation    → DATA-LAYOUT.md + RESEARCHER.md
Wire frontend to new backend endpoint   → CONTRACTS.md + BACKEND.md + FRONTEND.md
Run a pipeline locally                  → ENVIRONMENT.md + DATA-PIPELINES.md
End-to-end new feature                  → DATA-LAYOUT.md → BACKEND.md → FRONTEND.md
Planned feature / spec / design doc     → specs/README.md → specs/<slug>/
```

## High-level layout (one paragraph)

- **`backend/`** — FastAPI app reading from `s3_mirror/kokkai-doc/` (local) or S3 data-lake (deployed).
- **`frontend/`** — Next.js App Router; main explorer at `app/page.tsx`.
- **`data/`** — Python pipelines; datasets under `data/data/` (including `u-tokyo-asahi/` UTAS surveys); mirror for API under `s3_mirror/kokkai-doc/`.
- **`infra/`** — AWS CDK (BackendStack + FrontendStack); branch-per-environment deploys.
- **`paper/`** — Research LaTeX sources for ideological-scaling work.
- **`specs/`** — Future project plans; index at [specs/README.md](specs/README.md).

Human-facing overview: [README.md](README.md). Cursor deployment rules: `.cursor/rules/`. Claude Code entry: [CLAUDE.md](CLAUDE.md) (imports this file).

## Skill: on-demand context

Use the **`load-project-guide`** skill (or ask to "load project context for X") to pull in only the relevant guide(s) instead of reading this entire tree upfront.
