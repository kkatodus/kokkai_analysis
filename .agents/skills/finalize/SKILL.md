---
name: finalize
description: >-
  Finish a change set: sync agent docs with the repo, commit, push, and open a
  pull request against main. Use when the user says finalize, wrap up, ship it,
  or create a PR for the current work.
disable-model-invocation: true
---

# Finalize

Close out the current work: **sync agent docs**, then **commit and open a PR
against `main`**.

## Prerequisites

- Git repo with a `main` (or `master`) default branch and `gh` CLI available.
- User wants docs + code changes included unless they say "docs only" or "PR only".

## Workflow

```
- [ ] 1. Sync agent docs (update-agent-docs)
- [ ] 2. Review full diff
- [ ] 3. Branch, commit, push
- [ ] 4. Open PR against main
- [ ] 5. Report PR URL
```

### 1. Sync agent docs

**Always run first** — load and follow [.agents/skills/update-agent-docs/SKILL.md](../update-agent-docs/SKILL.md):

1. `./.agents/skills/update-agent-docs/scripts/audit-agent-docs.sh`
2. Fix drift in `docs/agents/`, `AGENTS.md`, `specs/README.md` as needed
3. `./scripts/sync-skills.sh` if any skill files changed
4. Re-run audit until clean or intentional gaps are documented

Include agent-doc changes in the same PR as the feature work when both exist.

### 2. Review full diff

In parallel:

```bash
git status
git diff
git diff --cached
git log -5 --oneline
git branch -vv
```

Understand **all** commits and uncommitted changes that will land in the PR.
If unrelated dirty files exist, **do not** `git add .` — stage only files for this
change set (named paths or hunks).

### 3. Branch, commit, push

1. Create a descriptive branch from current HEAD if not already on one:

   ```bash
   git checkout -b docs/sync-agent-guides   # example; match the actual change
   ```

2. Stage relevant files only.
3. Commit with a message focused on **why** (HEREDOC format):

   ```bash
   git commit -m "$(cat <<'EOF'
   docs: sync agent guides with u-tokyo-asahi survey data

   EOF
   )"
   ```

4. Push (set upstream if new branch):

   ```bash
   git push -u origin HEAD
   ```

**Git safety:** never force-push to `main`/`master`; never skip hooks unless the
user explicitly asks; never commit secrets (`.env`, credentials).

If the user has **not** asked to commit and there is nothing to commit, skip to
PR creation only when commits already exist on the branch.

### 4. Open PR against main

Determine base branch (`main` or `master` — prefer `main` if both exist).

```bash
git log main..HEAD --oneline
git diff main...HEAD
```

Create the PR:

```bash
gh pr create --base main --title "Short title" --body "$(cat <<'EOF'
## Summary
- …

## Agent docs
- Audit script run; guides updated: …
- Intentional gaps: …

## Test plan
- [ ] …

EOF
)"
```

Use the user's **creating-pull-requests** rule: analyze all commits on the branch,
not just the latest.

### 5. Report

Return the **PR URL** and a short summary: what changed, which guides were synced,
anything left intentionally undocumented.

## When to skip steps

| User says | Action |
|---|---|
| "finalize without doc sync" | Skip step 1; still open PR |
| "sync docs only" | Run update-agent-docs only; commit if asked; no PR unless asked |
| "PR only" / commits already pushed | Skip commit; run step 4 |
| No git repo / no remote | Report blocker; deliver doc edits only |

## Related skills

- **update-agent-docs** — doc sync only (no git)
- **split-to-prs** — when the change set should be multiple PRs instead of one
