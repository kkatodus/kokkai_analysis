#!/usr/bin/env bash
# Compare repo state to agent docs — run before syncing docs/agents/*.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../../scripts/_common.sh"

DATA_LAYOUT="$DOCS_AGENTS/DATA-LAYOUT.md"
DATA_PIPELINES="$DOCS_AGENTS/DATA-PIPELINES.md"
BACKEND="$DOCS_AGENTS/BACKEND.md"
INFRA="$DOCS_AGENTS/INFRA.md"
SPECS_INDEX="$REPO_ROOT/specs/README.md"

section() { echo; echo "=== $1 ==="; }
missing() { echo "  MISSING FROM DOCS: $*"; }
extra() { echo "  DOCUMENTED BUT ABSENT: $*"; }
ok() { echo "  OK: $*"; }

# --- data/data/ top-level dirs ---
section "data/data/ (→ DATA-LAYOUT.md)"
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  if ! grep -qF "\`$dir/\`" "$DATA_LAYOUT" 2>/dev/null && ! grep -qF "\`$dir\`" "$DATA_LAYOUT" 2>/dev/null; then
    missing "$dir"
  fi
done < <(find "$REPO_ROOT/data/data" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort)

# --- s3_mirror/kokkai-doc/ ---
section "s3_mirror/kokkai-doc/ (→ DATA-LAYOUT.md mapping table)"
mirror="$REPO_ROOT/s3_mirror/kokkai-doc"
if [[ -d "$mirror" ]]; then
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    if ! grep -qF "$dir" "$DATA_LAYOUT" 2>/dev/null; then
      missing "s3_mirror/kokkai-doc/$dir"
    fi
  done < <(find "$mirror" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort)
else
  echo "  (s3_mirror/kokkai-doc not present locally — skip)"
fi

# --- pipeline entry scripts ---
section "data/*.py pipelines (→ DATA-PIPELINES.md)"
while IFS= read -r script; do
  [[ -z "$script" ]] && continue
  if ! grep -qF "$script" "$DATA_PIPELINES" 2>/dev/null; then
    missing "$script"
  fi
done < <(find "$REPO_ROOT/data" -maxdepth 1 -name '*.py' -printf '%f\n' 2>/dev/null | sort)

# --- backend routers ---
section "backend routers (→ BACKEND.md)"
routers_dir="$REPO_ROOT/backend/app/routers"
if [[ -d "$routers_dir" ]]; then
  for f in "$routers_dir"/*.py; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f" .py)"
    [[ "$base" == "__init__" ]] && continue
    if ! grep -qF "$base" "$BACKEND" 2>/dev/null; then
      missing "routers/$base.py"
    fi
  done
fi

# --- GitHub workflows ---
section "GitHub workflows (→ INFRA.md)"
workflows_dir="$REPO_ROOT/.github/workflows"
if [[ -d "$workflows_dir" ]]; then
  for wf in "$workflows_dir"/*.yml "$workflows_dir"/*.yaml; do
    [[ -f "$wf" ]] || continue
    name="$(basename "$wf")"
    if ! grep -qF "$name" "$INFRA" 2>/dev/null; then
      missing ".github/workflows/$name"
    fi
  done
  # workflows documented but missing
  while IFS= read -r doc_wf; do
    [[ -z "$doc_wf" ]] && continue
    if [[ ! -f "$workflows_dir/$doc_wf" ]]; then
      extra ".github/workflows/$doc_wf"
    fi
  done < <(grep -oE 'deploy-[a-z-]+\.yml' "$INFRA" 2>/dev/null | sort -u)
fi

# --- CDK stacks ---
section "infra stacks (→ INFRA.md)"
stacks_dir="$REPO_ROOT/infra/lib/stacks"
if [[ -d "$stacks_dir" ]]; then
  for f in "$stacks_dir"/*.ts; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f" .ts)"
    [[ "$base" == *.d ]] && continue
    # Match Stack class name or file stem
    stem="${base%-stack}"
    if ! grep -qiF "$stem" "$INFRA" 2>/dev/null && ! grep -qF "$base" "$INFRA" 2>/dev/null; then
      missing "infra/lib/stacks/$base.ts"
    fi
  done
fi
# frontend-stack may live outside stacks/
for candidate in frontend-stack.ts FrontendStack; do
  if find "$REPO_ROOT/infra" -name '*frontend*stack*' -type f 2>/dev/null | grep -q .; then
    break
  fi
done
if grep -qF 'FrontendStack' "$INFRA" 2>/dev/null; then
  if ! find "$REPO_ROOT/infra" -name '*frontend*' -type f 2>/dev/null | grep -qi stack; then
    extra "FrontendStack (documented in INFRA.md, no stack file found)"
  fi
fi

# --- specs ---
section "specs/ (→ specs/README.md)"
if [[ -d "$REPO_ROOT/specs" ]]; then
  for spec_dir in "$REPO_ROOT/specs"/*/; do
    [[ -d "$spec_dir" ]] || continue
    slug="$(basename "$spec_dir")"
    if ! grep -qF "$slug" "$SPECS_INDEX" 2>/dev/null; then
      missing "specs/$slug/ (add row to specs/README.md)"
    fi
  done
fi

# --- agent guides index ---
section "docs/agents/ (→ AGENTS.md pillars table)"
for f in "$DOCS_AGENTS"/*.md; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f" .md)"
  if ! grep -qF "${name}.md" "$REPO_ROOT/AGENTS.md" 2>/dev/null; then
    missing "docs/agents/$name.md not linked from AGENTS.md"
  fi
done

section "Next steps"
echo "  1. Fix MISSING items in the relevant guide(s)"
echo "  2. Fix DOCUMENTED BUT ABSENT items (remove or note planned/legacy)"
echo "  3. Re-run this script until clean or only known exceptions remain"
echo "  4. ./scripts/sync-skills.sh if skills changed"
