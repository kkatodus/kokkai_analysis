#!/usr/bin/env bash
# Python pipeline entry scripts under data/ — filenames only, no file contents.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

data="$REPO_ROOT/data"

echo "Python scripts (data/*.py)"
find "$data" -maxdepth 1 -name '*.py' -print 2>/dev/null \
  | sed "s|^$data/||" \
  | sort

echo
echo "Notebooks (data/*.ipynb)"
find "$data" -maxdepth 1 -name '*.ipynb' -print 2>/dev/null \
  | sed "s|^$data/||" \
  | sort

echo
echo "Details: ./scripts/show-guide.sh data-pipelines"
