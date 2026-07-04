# Skills (deprecated path)

Project skills live in **[`.agents/skills/`](../.agents/skills/)** — the cross-tool [Agent Skills](https://agentskills.io) location.

Cursor and Claude Code both discover them via symlinks:

- `.cursor/skills` → `.agents/skills`
- `.claude/skills` → `.agents/skills`

Edit skills only under `.agents/skills/`. If symlinks break (e.g. on Windows without symlink support), run:

```bash
./scripts/sync-skills.sh
```

List skills: `./scripts/list-skills.sh`

## Agent helper scripts

See [AGENTS.md](../AGENTS.md) for the full table. Quick entry: `./scripts/agent-help.sh`
