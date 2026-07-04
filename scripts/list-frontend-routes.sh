#!/usr/bin/env bash
# Next.js pages and app/api handlers — compact route index.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

app="$REPO_ROOT/frontend/app"

echo "Pages (app router)"
find "$app" -name page.tsx 2>/dev/null \
  | sed "s|^$app||; s|/page\.tsx$||; s|^$|/|" \
  | sort

echo
echo "API route handlers (app/api)"
find "$app/api" -name route.ts 2>/dev/null \
  | sed "s|^$app||; s|/route\.ts$||" \
  | sort
