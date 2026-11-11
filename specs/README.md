# Specs index

Future project plans and design documents live under `specs/`. Each subdirectory is one planned initiative; this file is the **entry point** — keep it updated whenever you start a new spec.

## Active specs

| Slug | Status | Summary |
|---|---|---|
| [`ensemble-scaling-reliability`](ensemble-scaling-reliability/README.md) | draft | Methods paper (KOKKAI DOC sequel): embedding-model instability in LLM-based ideological scaling + latent-space ensembles as the fix, validated vs UTAS and human Bradley-Terry comparisons |
| [`polis-low-resource-persona`](polis-low-resource-persona/README.md) | draft | POLIS paper: personas for low-resource Diet politicians via BO-tuned DARE-TIES merging of DPO anchor adapters, evaluated on UTAS answer agreement vs SFT/DPO/ICL baselines |
| [speech-auto-update](speech-auto-update/README.md) | planned | Scheduled incremental fetch of new NDL speeches → `issues/` + `repr_speeches_id_organized/`, upload changed files to S3 |
| [landing-page](landing-page/README.md) | draft | Landing page at `/` (dashboard moves to `/app`) with code-driven motion-graphics replicas of search, detail pane, meeting view, ranking, scatter and map; fictional sample data; redirects for old root links |
| [member-auto-update](member-auto-update/README.md) | in-progress | Monthly scrape of the official 衆/参 member lists → new `parliamentMembers/` snapshot with `person_id`s; members missing from `person` queued for a verified `add` |
| [speaker-review](speaker-review/README.md) | in-progress | Confidence levels for speech → politician matches; unsure pairs held for a human decision (`python -m speech_update review`), decisions applied nightly |
| [speech-quality-labels](speech-quality-labels/README.md) | in-progress | LLM labels for every exchange since 2000 and nightly: Diet function, contribution, failure patterns (private scandal, redundancy, evasion, softballs …) charged to questioner or answerer; $100/month cap with Slack spend reports |
| [speech-quality-ui](speech-quality-ui/README.md) | in-progress | Site rebuilt around the new exchange labels: per-person aggregate + exchange files from `label_result`, `/speeches/quality/*`, ranking card, やり取り tab, meeting-view segments, new 注意事項 |
| [topic-scaling-refresh](topic-scaling-refresh/README.md) | in-progress | Monthly re-summarise/re-embed/re-project of politicians per topic inside per-topic time windows; all-vs-current toggle in the scatter plot; topic and window suggestions posted to Slack for manual editing |
| [stance-summaries-panel](stance-summaries-panel/README.md) | built, awaiting first publish | Show the per-topic stance summaries behind the ideology embeddings in the detail pane as a 立場 tab: per-person `ideology/persons/{id}.json` from the monthly publish, `/ideology/person`, summary text + percentile bars per sub-topic + link to the source speeches |
| [db-backup](db-backup/README.md) | in-progress | Weekly `pg_dump` of the local `kokkaidoc` Postgres to `s3://kokkai-doc-bucket-dev/backups/postgres/` (STANDARD_IA, 60-day lifecycle), Sundays 06:00 via launchd |
| [dashboard-loading](dashboard-loading/README.md) | in-progress | Landing → `/app` takes ~8 s (34 MB page rendered per request in `iad1`): `loading.tsx` + layout overlay with dataset-named progress stages, usage tips and quiz/fact cards (real counts from a nightly `site_stats.json`); caching quick wins optional later; ideology split per sub-topic postponed |
| [topic-keyword-highlight](topic-keyword-highlight/README.md) | planned | Highlight the `search_words` that filed each speech under its topic in 発言（トピック別）: `topics/topics.json` published by `speech_update`, `GET /speeches/topics`, KWIC excerpt when collapsed, per-topic colours on 全発言 |

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
