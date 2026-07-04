#!/usr/bin/env bash
# List agent helper scripts — run this first instead of exploring the repo tree.
set -euo pipefail

cat <<'EOF'
KOKKAI DOC agent helper scripts (./scripts/)

Use these via Shell instead of loading large directories or many files into context.

Discovery & routing
  agent-help.sh              This list
  route-task.sh "<task>"     Suggest guide(s) for a task description
  list-guides.sh             Agent guides under docs/agents/ (one-line summaries)
  show-guide.sh <name>       Print one guide (e.g. backend, data-layout, contracts)

Project structure (compact)
  tree-pillar.sh <pillar>    Shallow tree: backend|frontend|data|infra|paper [depth]
  list-api-routes.sh         FastAPI routes (method + path + summary)
  list-frontend-routes.sh    Next.js pages and app/api route handlers
  list-data-dirs.sh          Top-level dataset dirs under data/data/
  list-pipeline-scripts.sh   Python pipeline entry scripts under data/
  list-specs.sh                Planned projects under specs/ (index: specs/README.md)

Skills
  list-skills.sh             Available .agents/skills names
  sync-skills.sh             Copy skills to .cursor/skills and .claude/skills

Typical flow
  1. ./scripts/route-task.sh "fix speech API pagination"
  2. ./scripts/show-guide.sh backend
  3. ./scripts/list-api-routes.sh
  4. Open only the source files the task needs
EOF
