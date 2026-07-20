#!/usr/bin/env bash
# Compact FastAPI route listing — cheaper than reading every router file.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

routers="$REPO_ROOT/backend/app/routers"
main="$REPO_ROOT/backend/app/main.py"

echo "GET  /health  (public)"

for f in "$routers"/*.py; do
  [[ -f "$f" ]] || continue
  prefix="$(grep -E '^router = APIRouter\(prefix=' "$f" | head -1 | sed -E 's/.*prefix="([^"]+)".*/\1/')"
  [[ -n "$prefix" ]] || prefix=""

  grep -E '@router\.(get|post|put|delete|patch)\(' "$f" | while read -r line; do
    method="$(echo "$line" | sed -E 's/.*@router\.([a-z]+)\(.*/\1/' | tr '[:lower:]' '[:upper:]')"
    path="$(echo "$line" | sed -E 's/.*@router\.[a-z]+\("([^"]+)".*/\1/')"
    summary="$(echo "$line" | sed -n 's/.*summary="\(.*\)".*/\1/p')"
    printf "%-6s %-40s %s\n" "$method" "${prefix}${path}" "$summary"
  done
done | sort -k2

if grep -q 'add_api_route' "$main" 2>/dev/null; then
  : # /health already listed
fi
