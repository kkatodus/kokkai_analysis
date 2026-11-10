# Member list auto-update

**Status:** in-progress (built 2026-10-15; first run 2026-10-15 uploaded `*_20261015.json`, live on prod; schedule not installed yet) · **Code:** `data/member_update/` · **Related:** [speech-auto-update](../speech-auto-update/README.md), [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md)

## 1. Goal

Keep the current-member lists the site shows (`parliamentMembers/shugiin_*.json`, `sangiin_*.json`) and the representative DB (Postgres `person` / `election_result`, `electionHistory/`, `politicians/table.csv`) up to date without manual scraping. It runs once a month.

Before this, the lists were refreshed by hand: Selenium in `collect_repr_list.py`, plus Gemini-researched histories for new people in `collect_all_repr_list.ipynb`. The snapshots in S3 dated from 2025-09-11 (参) and 2026-03-15 (衆).

## 2. Design

| Step | What happens |
|---|---|
| Scrape | 衆: `shugiin.go.jp/…/syu/{1..10}giin.htm` (Shift_JIS). 参: `sangiin.go.jp/…/giin/current/giin.htm` redirects to the current session's list. Plain HTTP, stdlib HTML parser, 2 s between requests (12 requests in all). |
| Format | Same fields and layout as the existing files, so the frontend and backend don't change. Only a trailing 君 is stripped (the old cleaner turned 畑野君枝 into 畑野枝). 衆 rows now carry their profile `link`. |
| Sanity | A house with fewer than 430 (衆) / 225 (参) rows, or rows with empty fields, is skipped with a warning and its snapshot is left alone. That happens during dissolution or after a layout change. A fetch error makes the run fail, so the wrapper retries. |
| Match | `person_id` from, in order: `links.json` (manual) → previous snapshot (same name + reading) → unique name in `person` (旧字体 folded, `[旧姓]` ignored) → unique reading (reported as "matched by reading only"). Never fuzzy. |
| Unresolved | Kept with `person_id: null` (the frontend copes), listed in `pending_members.json`, posted to Slack. The user adds them (§3). Nothing is fabricated. |
| Write | A new `{house}_{YYYYMMDD}.json` only when the rows differ from the latest file. The backend serves the file that sorts last in S3. Older files are kept. |
| Upload | Changed paths only, via the speech updater's `Uploader` (profile `kokkai-speech-update`, never deletes), to `kokkai-doc-bucket-dev`. Prod reads that bucket too, so an upload is live on kokkaidoc.com (INFRA.md § Data lake). |
| Notify | Slack summary every run: joined, left, and 会派/district/name changes, reading-only matches, pending members. |

State lives in `s3_mirror/.member-update/`: `lock`, `last_run.json`, `changed_paths.txt`, `pending_members.json`, `links.json`, `new_members/` (templates), `backups/` (table.csv before each `add`), `logs/`.

Schedule: launchd `com.kokkaidoc.member-update` runs on the 1st of each month at 05:00 (an hour after the daily speech update), from the `../kokkai_analysis-dev` worktree like the speech job.

## 3. Adding a member who isn't in `person`

```bash
cd data
PY="../.venv-speech-update/bin/python"
$PY -m member_update pending                 # lists them and writes new_members/<house>_<name>.json
# fill in election_data from 総務省 notices / the house profile page / Wikipedia results tables
$PY -m member_update add ../s3_mirror/.member-update/new_members/shugiin_新人太郎.json [--dry-run]
$PY -m member_update all                     # attaches the new person_id, uploads snapshot + history + table.csv
$PY -m speech_update route --retry-unmatched && $PY -m speech_update upload   # files their speeches
```

`add` refuses when someone already has the same name or reading; use `link` (or `--force` for a genuinely different person). It writes only new ids' `electionHistory` files. Regenerating existing ones from Postgres isn't byte-exact for ~2% of people, so existing files are never rewritten.

## 4. Not done / follow-ups

- **Install the schedule**: `./scripts/install-member-update-schedule.sh install` from `../kokkai_analysis-dev`.
- `backend/app/routers/parliamentMember.py` takes the *last listed* file per house. That's fine on S3 (keys come back sorted), but `LocalStorage` uses `os.listdir` (unordered), so a local backend may serve an older snapshot. A `sorted()` would fix it. That's a backend change, and pushing it to `dev` deploys.
- New 会派 short names (志士, い党, みら) have no entry in the frontend's `PARTY2PARTY` / `PARTY2RGBCOLOR`, so they get a hashed colour in the seat charts.
- After a general election the 衆 list changes almost entirely. Most winners are former members and match automatically, but expect a batch of `pending` first-timers.
- Departed members' `person` rows are kept (they're historical members); only the snapshot changes.
