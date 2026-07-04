#!/usr/bin/env bash
# List planned projects under specs/ — read specs/README.md for the curated index.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

specs_root="$REPO_ROOT/specs"
index="$specs_root/README.md"

echo "Specs index: specs/README.md"
echo

if [[ -f "$index" ]]; then
  rows="$(awk '
    /^\| Slug / { header=1; next }
    header && /^\|[-| ]+\|/ { in_table=1; next }
    in_table && /^\|/ {
      if ($0 ~ /none yet/) next
      print $0
      next
    }
    in_table && !/^\|/ { exit }
  ' "$index")"
  if [[ -n "$rows" ]]; then
    echo "Active (from specs/README.md):"
    echo "$rows"
    echo
  fi
fi

echo "Spec directories:"
found=0
for d in "$specs_root"/*; do
  [[ -d "$d" ]] || continue
  slug="$(basename "$d")"
  [[ "$slug" == "README.md" ]] && continue
  found=1
  summary=""
  if [[ -f "$d/README.md" ]]; then
    summary="$(sed -n '1s/^# //p; 2p' "$d/README.md" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-80)"
  fi
  printf "  %-30s %s\n" "$slug/" "$summary"
done

if (( found == 0 )); then
  echo "  (none — update specs/README.md when you add a project)"
fi
