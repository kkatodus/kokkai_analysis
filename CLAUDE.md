@AGENTS.md

## Claude Code

- Project skills: `.agents/skills/` (symlinked at `.claude/skills/`). List with `./scripts/list-skills.sh`; if symlinks break, run `./scripts/sync-skills.sh`.
- Before exploring the repo tree, run `./scripts/agent-help.sh` or `./scripts/route-task.sh "<task>"`.
- Load one area guide via `./scripts/show-guide.sh <name>` instead of opening all of `docs/agents/`.
- Planned work: read [specs/README.md](specs/README.md) first; list folders with `./scripts/list-specs.sh`.
- Personal overrides: `CLAUDE.local.md` at repo root (gitignored).
