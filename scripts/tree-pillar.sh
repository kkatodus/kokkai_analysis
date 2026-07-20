#!/usr/bin/env bash
# Shallow directory tree for one project pillar — avoids recursive repo exploration.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

usage() {
  echo "Usage: $(basename "$0") <pillar> [max-depth]" >&2
  echo "Pillars: backend frontend data infra paper" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage

pillar="${1,,}"
depth="${2:-2}"

case "$pillar" in
  backend) root="$REPO_ROOT/backend" ;;
  frontend) root="$REPO_ROOT/frontend" ;;
  data) root="$REPO_ROOT/data" ;;
  infra) root="$REPO_ROOT/infra" ;;
  paper) root="$REPO_ROOT/paper" ;;
  *)
    echo "Unknown pillar: $pillar" >&2
    usage
    ;;
esac

[[ -d "$root" ]] || {
  echo "Missing directory: $root" >&2
  exit 1
}

prune_expr=( \( )
for i in "${!PRUNE_NAMES[@]}"; do
  if (( i > 0 )); then
    prune_expr+=( -o )
  fi
  prune_expr+=( -name "${PRUNE_NAMES[$i]}" )
done
prune_expr+=( \) -prune -o -print )

echo "# $pillar/ (depth <= $depth, pruned)"
find "$root" "${prune_expr[@]}" 2>/dev/null \
  | sed "s|^$root/||; s|^$root$|.|" \
  | awk -F/ -v d="$depth" '$0 == "." || NF <= d { print }' \
  | sort
