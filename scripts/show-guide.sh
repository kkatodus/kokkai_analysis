#!/usr/bin/env bash
# Print a single agent guide by short name — avoids guessing paths.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

usage() {
  echo "Usage: $(basename "$0") <guide>" >&2
  echo "Names: backend frontend data-pipelines data-layout infra researcher contracts environment" >&2
  echo "       (or BACKEND.md-style names)" >&2
  ./scripts/list-guides.sh >&2
  exit 1
}

[[ $# -ge 1 ]] || usage

normalize_guide() {
  local key="${1,,}"
  key="${key%.md}"
  key="${key//_/-}"
  case "$key" in
    backend|back) echo "BACKEND" ;;
    frontend|front|ui) echo "FRONTEND" ;;
    data-pipelines|data-pipeline|pipelines|pipeline|data) echo "DATA-PIPELINES" ;;
    data-layout|layout|datasets|dataset) echo "DATA-LAYOUT" ;;
    infra|infrastructure|cdk|deploy|aws) echo "INFRA" ;;
    researcher|research|paper|papers) echo "RESEARCHER" ;;
    contracts|contract|api) echo "CONTRACTS" ;;
    environment|env|secrets) echo "ENVIRONMENT" ;;
    agents|index) echo "AGENTS" ;;
    *)
      local upper="${key^^}"
      upper="${upper//-/_}"
      echo "$upper"
      ;;
  esac
}

name="$(normalize_guide "$1")"

if [[ "$name" == "AGENTS" ]]; then
  target="$REPO_ROOT/AGENTS.md"
else
  target="$DOCS_AGENTS/${name}.md"
fi

[[ -f "$target" ]] || {
  echo "Unknown guide: $1 (resolved to $name)" >&2
  usage
}

cat "$target"
