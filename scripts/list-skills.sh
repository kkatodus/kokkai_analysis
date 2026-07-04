#!/usr/bin/env bash
# List available agent skills under .agents/skills/.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

find "$SKILLS_ROOT" -name SKILL.md 2>/dev/null \
  | sed 's|.*/skills/||; s|/SKILL.md$||' | sort -u
