# Specs index

Future project plans and design documents live under `specs/`. Each subdirectory is one planned initiative; this file is the **entry point** — keep it updated whenever you start a new spec.

## Active specs

| Slug | Status | Summary |
|---|---|---|
| *(none yet)* | — | Add a row here when you create the first spec under `specs/<slug>/` |

**Status values:** `draft` · `planned` · `in-progress` · `blocked` · `done` · `archived`

## How to add a new spec

1. Create `specs/<slug>/` (kebab-case, e.g. `manifesto-explorer-v2`).
2. Add `specs/<slug>/README.md` with goal, scope, open questions, and links to related code/guides.
3. **Update this file** — add a row to the table above with slug, status, and a one-line summary.
4. When implementation starts, link the relevant pillar guides from `docs/agents/` inside the spec README.

## Layout

```
specs/
  README.md          ← this index (update on every new spec)
  <slug>/
    README.md        ← spec detail for that project
    …                ← optional: mockups, ADRs, task lists
```

## For agents

- Check here **before** assuming a feature is already designed or in scope.
- Read only the spec folder that matches the task — do not load all of `specs/` recursively.
- List specs without opening every file: `./scripts/list-specs.sh`
- Specs describe intent; implemented behavior still lives in `backend/`, `frontend/`, `data/`, etc.
