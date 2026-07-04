#!/usr/bin/env bash
# Suggest agent guide(s) from a task description — run before loading docs.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

usage() {
  echo "Usage: $(basename "$0") \"<task description>\"" >&2
  exit 1
}

[[ $# -ge 1 ]] || usage

task="${*,,}"

declare -A scores=(
  [BACKEND]=0
  [FRONTEND]=0
  [DATA-PIPELINES]=0
  [DATA-LAYOUT]=0
  [INFRA]=0
  [RESEARCHER]=0
  [CONTRACTS]=0
  [ENVIRONMENT]=0
  [SPECS]=0
)

score() {
  local guide="$1"
  shift
  local word
  for word in "$@"; do
    if [[ "$task" == *"$word"* ]]; then
      scores[$guide]=$((scores[$guide] + 1))
    fi
  done
}

score BACKEND fastapi router routers uvicorn s3 storage api-key api key endpoint backend
score FRONTEND next.js nextjs react component ui page tsx frontend client server fetch
score DATA-PIPELINES scrape scraping pipeline llm python script notebook finetune collect process
score DATA-LAYOUT dataset data/data s3_mirror mirror path jsonl upload sync layout
score INFRA cdk deploy deployment aws cloudfront ecs vpc github actions workflow infra stack
score RESEARCHER paper umap embedding fine-tuning finetune stance ideological research latex
score CONTRACTS contract wire wiring frontend backend integration proxy revalidation
score ENVIRONMENT secret env environment .env local dev credentials stripe
score SPECS spec specs plan planned design roadmap future initiative

ordered=(SPECS BACKEND FRONTEND DATA-PIPELINES DATA-LAYOUT INFRA RESEARCHER CONTRACTS ENVIRONMENT)
matches=()
max=0

for guide in "${ordered[@]}"; do
  n="${scores[$guide]}"
  if (( n > max )); then
    max=$n
  fi
done

if (( max == 0 )); then
  echo "No strong match — start with AGENTS.md, then:"
  ./scripts/list-guides.sh
  exit 0
fi

for guide in "${ordered[@]}"; do
  if (( scores[$guide] == max )); then
    matches+=("$guide")
  fi
done

echo "Suggested guide(s) for: ${*}"
for guide in "${matches[@]}"; do
  if [[ "$guide" == "SPECS" ]]; then
    echo "  specs/README.md  (planned work index)"
  else
    echo "  docs/agents/${guide}.md"
  fi
done

if [[ " ${matches[*]} " == *" BACKEND "* ]] && [[ " ${matches[*]} " == *" FRONTEND "* ]]; then
  echo "  docs/agents/CONTRACTS.md  (cross-cutting: also read when wiring API ↔ UI)"
fi

if [[ " ${matches[*]} " == *" DATA-LAYOUT "* ]] && [[ " ${matches[*]} " == *" BACKEND "* ]]; then
  echo "Order: DATA-LAYOUT → BACKEND → FRONTEND → CONTRACTS"
fi

echo
if [[ "${matches[0]}" == "SPECS" ]]; then
  echo "List specs: ./scripts/list-specs.sh"
else
  echo "Load one guide: ./scripts/show-guide.sh ${matches[0],,}"
fi
