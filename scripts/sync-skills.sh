#!/usr/bin/env bash
# Copy .agents/skills to tool-specific dirs when symlinks are not supported (e.g. Windows).
set -euo pipefail

source "$(dirname "$0")/_common.sh"

for dest in .cursor/skills .claude/skills; do
  target="$REPO_ROOT/$dest"
  rm -rf "$target"
  cp -a "$SKILLS_ROOT" "$target"
  echo "synced $dest"
done
