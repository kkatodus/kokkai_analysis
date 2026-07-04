#!/usr/bin/env bash
# List agent guides with one-line summaries — cheaper than reading AGENTS.md + every guide.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

for f in "$DOCS_AGENTS"/*.md; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f" .md)"
  summary="$(sed -n '1s/^# //p' "$f")"
  printf "%-16s %s\n" "$name" "$summary"
done | sort
