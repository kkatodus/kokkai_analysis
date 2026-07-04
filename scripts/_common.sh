#!/usr/bin/env bash
# Shared helpers for agent scripts — source from other scripts, do not execute directly.

_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$_COMMON_DIR/.." && pwd)"
DOCS_AGENTS="$REPO_ROOT/docs/agents"
SKILLS_ROOT="$REPO_ROOT/.agents/skills"

# Directory names to skip in tree-pillar.sh (basename match).
PRUNE_NAMES=(
  node_modules .git __pycache__ .next out .venv venv
  .pytest_cache cdk.out .turbo dist build backend_venv
)
