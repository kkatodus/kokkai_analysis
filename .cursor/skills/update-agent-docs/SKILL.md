---
name: update-agent-docs
description: >-
  Sync docs/agents/ and AGENTS.md with the current repo — data dirs, pipelines,
  API routes, workflows, infra stacks, and specs. Use when agent docs may be stale,
  after adding datasets or features, or when the user asks to update or refresh
  agent documentation.
disable-model-invocation: true
---

# Update agent docs

Bring agent documentation in line with the **current** codebase. This is a doc-sync
task, not a feature build — change only guides and indexes unless the user also
asks for code.

## Scope

| Source of truth | Agent doc(s) to update |
|---|---|
| `data/data/`, `s3_mirror/kokkai-doc/` | `docs/agents/DATA-LAYOUT.md`, `ENVIRONMENT.md` |
| `data/*.py`, notebooks | `docs/agents/DATA-PIPELINES.md` |
| `backend/app/routers/` | `docs/agents/BACKEND.md`, `CONTRACTS.md` |
| `frontend/app/` routes & services | `docs/agents/FRONTEND.md`, `CONTRACTS.md` |
| `infra/`, `.github/workflows/` | `docs/agents/INFRA.md` |
| `paper/`, stance pipelines | `docs/agents/RESEARCHER.md` |
| `specs/` | `specs/README.md` |
| All guides | `AGENTS.md` (index, routing, one-paragraph layout) |
| Routing table in load-project-guide | `.agents/skills/load-project-guide/SKILL.md` |

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. Audit drift
- [ ] 2. Gather live inventory
- [ ] 3. Patch guides (minimal diffs)
- [ ] 4. Refresh indexes
- [ ] 5. Verify
```

### 1. Audit drift

Run the audit script from repo root:

```bash
./.agents/skills/update-agent-docs/scripts/audit-agent-docs.sh
```

Treat every `MISSING FROM DOCS` line as a required fix unless it is intentional
(scratch dirs like `tmp/`, gitignored subtrees, or local-only tooling).

Treat every `DOCUMENTED BUT ABSENT` line as stale documentation — remove, mark
legacy, or note "planned" with evidence.

### 2. Gather live inventory

Run discovery helpers **before** editing prose:

```bash
./scripts/list-data-dirs.sh
./scripts/list-pipeline-scripts.sh
./scripts/list-api-routes.sh
./scripts/list-frontend-routes.sh
./scripts/list-specs.sh
./scripts/tree-pillar.sh infra 2
./scripts/tree-pillar.sh backend 2
```

For workflows and stacks, list files directly:

```bash
ls .github/workflows/
ls infra/lib/stacks/ 2>/dev/null; find infra/lib -name '*.ts' -not -name '*.d.ts'
```

Read only the guide files the audit flagged — not all of `docs/agents/`.

### 3. Patch guides

Follow existing section style in each guide. Prefer **tables and bullet lists**
over long prose.

**DATA-LAYOUT.md** — for each new `data/data/<dir>/`:
- Add a `###` section: purpose, key files, producer script (if any), API mirror row
  (or note "not mirrored / research-only").

**DATA-PIPELINES.md** — add rows to the scraping or analysis tables for new
`data/*.py` scripts; note output paths.

**BACKEND.md** — add router rows; keep `GET /health` note.

**FRONTEND.md** — new pages under `app/`, new `app/api/` handlers, new services.

**INFRA.md** — stacks, workflows, deployment triggers, env branch mapping. If a
workflow is documented but missing on disk, **fix the doc** (do not invent files).

**RESEARCHER.md** — new validation corpora, paper dirs, or research outputs under
`data/results/`, `s3_mirror/kokkai-doc/ideology/`.

**ENVIRONMENT.md** — large committed dirs, new secrets if routers/pipelines need them.

**CONTRACTS.md** — only when new API shapes or proxy routes were added.

Keep diffs focused: document **what exists now**, not aspirational design.

### 4. Refresh indexes

After guide edits:

1. **AGENTS.md** — project summary, quick-routing table, pillars table, layout paragraph.
2. **specs/README.md** — one row per `specs/<slug>/` directory.
3. **load-project-guide** skill — routing table if new guide topics or common paths appeared.

If you changed any skill under `.agents/skills/`, run:

```bash
./scripts/sync-skills.sh
```

### 5. Verify

Re-run the audit script. Remaining items should be explained in the PR body or
called out to the user as intentional gaps.

Optionally spot-check:

```bash
./scripts/list-guides.sh
./scripts/route-task.sh "describe new feature area"
```

## Output

When done, report:

1. **Drift fixed** — bullet list by guide file
2. **Intentional gaps** — anything left undocumented and why
3. **Files changed** — paths only
4. **Suggested commit message** — one line, past tense ("docs: sync agent guides with …")

Do **not** commit or open a PR unless the user asked — use the **finalize** skill for that.

## Examples

**New dataset** (`data/data/foo/` added):
→ DATA-LAYOUT section + ENVIRONMENT large-dirs list + AGENTS.md summary if notable.

**New FastAPI router** (`backend/app/routers/bar.py`):
→ BACKEND router table + CONTRACTS if frontend consumes it + audit clean.

**New workflow** (`.github/workflows/deploy-foo.yml`):
→ INFRA deployment section + AGENTS.md only if it changes how agents deploy.
