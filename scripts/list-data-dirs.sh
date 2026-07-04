#!/usr/bin/env bash
# Top-level dataset directories under data/data/ — no deep tree walk.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

data_root="$REPO_ROOT/data/data"
mirror_root="$REPO_ROOT/s3_mirror/kokkai-doc"

echo "Pipeline datasets (data/data/)"
if [[ -d "$data_root" ]]; then
  for d in "$data_root"/*; do
    [[ -d "$d" ]] || continue
    name="$(basename "$d")"
    count="$(find "$d" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
    printf "  %-40s (%s entries)\n" "$name/" "$count"
  done | sort
else
  echo "  (missing: $data_root)"
fi

echo
echo "API mirror (s3_mirror/kokkai-doc/)"
if [[ -d "$mirror_root" ]]; then
  for d in "$mirror_root"/*; do
    [[ -d "$d" ]] || continue
    name="$(basename "$d")"
    count="$(find "$d" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
    printf "  %-40s (%s entries)\n" "$name/" "$count"
  done | sort
else
  echo "  (missing: $mirror_root)"
fi

echo
echo "Mapping table: ./scripts/show-guide.sh data-layout"
