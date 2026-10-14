# Speech auto-update: progress & handoff

**Last updated:** 2026-10-13 (end of session 1) · **Spec:** [README.md](README.md) (status `planned`) · **Next:** Phase 1

Read this first when picking the work back up in a fresh session. The design is in `README.md`; this file covers where things stand, what the environment looks like, and the traps found along the way.

---

## 1. Where things stand

| Phase (spec §9) | State |
|---|---|
| 0 · Prerequisites | ✅ Done except the Mac requirements file, which gets created as the first Phase 1 task |
| 1 · Build `data/speech_update/` + dry-run + backfill | ⏭ **Next.** Nothing written yet |
| 2 · launchd schedule | Not started |
| 3 · Cloud move (optional) | Not started |
| §4.10 · One-off Postgres `speeches` repair | Not started (needs the Phase 1 resolver/route code) |

**All spec questions Q1–Q10 are decided** (spec §8). Short version: work in `s3_mirror/` directly · match speakers via Postgres · newest-first ordering · revalidate frontend if a token is available · daily 04:00 · Slack webhook · ignore S3 `speeches/` · upload to the dev bucket only · upsert into Postgres `speeches` (after repair) · the "backfill" became the table repair.

## 2. Git / PR state

- Commit `c6a5d21a` "Add S3 mirror sync script and speech auto-update spec" is **on `origin/dev`** (cherry-picked; conflicts in `scripts/agent-help.sh` and `specs/README.md` resolved by keeping both sides).
- **PR #51 `dev → prd`** is open: https://github.com/kkatodus/kokkai_analysis/pull/51. It covers 57 commits, mostly POLIS research. No `infra/`, `backend/` or `frontend/` changes, so merging doesn't deploy.
- The local branch `speech-auto-update-spec` (`f6b1d134`, same content, based on `main`) is now redundant. Delete it once you're happy: `git switch dev && git branch -D speech-auto-update-spec`.
- Branch model (INFRA.md): `dev` → dev env, `stg` → staging, `prd` → prod. `main` doesn't deploy. There's no `stg` branch on the remote.
- `data/NOTES.MD` has the user's own uncommitted edits. **Don't commit it.**

## 3. Environment on this Mac (verified 2026-10-13)

### S3 mirror
- `s3_mirror/kokkai-doc/` = full copy of `s3://kokkai-doc-bucket-dev/kokkai-doc/`: **465,884 files, 50 GB**. A dry-run sync showed it matches the bucket. The bucket's 2 extra objects are empty folder placeholders.
- Prefixes: `electionHistory/` (4,818) · `geo/` · `ideology/` · `issues/` (**107,280** meetings) · `parliamentMembers/` · `politicians/` · `relevance_and_productivity/` · `repr_speeches_id_organized/` (4,525 people) · `speeches/` (107,157, duplicates `issues/`, not read by the backend).
- Refresh: `./scripts/sync-s3-mirror.sh [--background] [--env dev]`. Logs go to `s3_mirror/.sync-logs/`.
- Only **`kokkai-doc-bucket-dev`** exists. `-staging` and `-prod` (named in `infra/lib/config/environments.ts`) don't.
- The S3 speech data was last written around **2025-12-28**. The first Phase 1 run needs to backfill Dec 2025 → now.

### Postgres
- Homebrew **PostgreSQL 17.11**, `brew services start postgresql@17`, binaries in `/opt/homebrew/opt/postgresql@17/bin` (not on PATH by default in tool shells; export it).
- DB `kokkaidoc`, user `postgres`, `localhost:5432`, restored from the old machine's dump. `pg_hba` is **trust** for localhost, so the password isn't actually checked.
- Tables: `person` 4,818 · `election_result` 22,576 · `x_account` 1,825 · `speeches` 7,048,027 rows / 7.8 GB, dates 1947-05-20 → 2025-10-24. Extension `pg_trgm` is installed.
- FK integrity OK, no duplicate `speech_id`. Every `person_id` in S3 `electionHistory/` and `repr_speeches_id_organized/` exists in `person`.
- 8 `name_kanji` values are shared by more than one person. The resolver's same-name step (spec §4.5) handles these.
- `get_politician_id_by_name(cur, '菅野和太郎', 'かんのわたろう', '自由民主党', stop_for_input=False)` → `10` ✔ (matches S3).

### Credentials / config
- `data/.env` contains `PSQL_DATABASE_PASSWORD`, `SLACK_WEBHOOK_URL` (quoted value; verified with a test post → `200 ok`), plus the older API keys. Permissions were still `644` at last check; the user was asked to `chmod 600`.
- AWS CLI v2 at `/opt/homebrew/bin/aws`, region `ap-northeast-1`.
  - Default credentials = **account root** login (`arn:aws:iam::<acct>:root`). Don't use these for the job.
  - Profile **`kokkai-speech-update`** (IAM user, inline policy = `iam-policy.json`). Verified: put/get/list under `kokkai-doc/` are allowed; delete, bucket-root list, writes outside `kokkai-doc/`, other buckets and IAM are denied.
- NDL API needs no key. Verified that `https://kokkai.ndl.go.jp/api/meeting?from=2026-09-01&until=2026-10-13&recordPacking=json&maximumRecords=10` works (16 meetings, paged via `nextRecordPosition`).

## 4. Key findings (details in spec)

1. **Postgres `speeches.person_id` is wrong for ~93% of rows.** Only 486,315 / 7,048,027 rows match `speaker`. Cause: `data/create_speech_db_with_persons.py` `continue`s without appending to `persons`, then does `zip(speeches, persons)`, so every speech after `会議録情報` gets the next speaker's id, and some speeches were dropped. Nothing in the repo reads this table. Repair plan: spec §4.10 (back up → fix script → TRUNCATE + rebuild via the new resolver → verify).
2. **The S3 per-politician files are fine.** They're built by `reorganize_all_repr_speeches.py`, which doesn't have the bug. Spot-checked persons 10, 1317, 2194, 3456: each file contains only its own speaker.
3. There's **no meeting gap** between the DB and S3: S3 `issues/` contains all 105,403 DB issue IDs plus 1,877 more. (An earlier "75,573" figure came from a half-finished local sync. Ignore it.)
4. `repr_speeches_id_organized/*/all_speeches.jsonl` lines = NDL speech record + `"meta": <issue meta.json>`, roughly newest-first. The `issueID` field is only inside `meta`.
5. The existing `collect_all_speeches.py` can't be reused as-is: it skips existing issue dirs, has no date window, and raises at module level on purpose. Lift its dataclasses and `from_dict()` into a module (spec §4.7).

## 5. Gotchas hit this session

- `./scripts/show-guide.sh` crashes on macOS bash 3.2 (`${1,,}`: bad substitution). Read `docs/agents/*.md` directly, or fix the script.
- `data/requirements.txt` pins `torch==2.9.1+cu126` (CUDA) and **won't install on macOS**. The job needs its own small requirements file (`psycopg2-binary==2.9.11`, `python-dotenv==1.2.1`, `requests`, `pydantic`). No project venv exists yet. A throwaway venv was used for testing.
- Tool shells are **zsh**: unquoted `$VAR` holding `--flag value` does **not** word-split. Use bash scripts or arrays.
- `aws s3 rm` prints `delete:` even for objects that don't exist. Verify with `s3api head-object`.
- `load_dotenv()` with no path fails when Python reads from stdin (`find_dotenv` assertion). Pass the path explicitly.
- `dev` tracks both `data/NOTES.MD` and `data/NOTES.md`. On macOS one always shows as modified (noted in PR #51). Never `git add -A` on a `dev` checkout.

## 6. Next steps (Phase 1)

1. `data/requirements-speech-update.txt` + a venv for it.
2. `data/speech_update/models.py`: move `SpeechRecord`/`MeetingRecord`/`from_dict` out of `collect_all_speeches.py`.
3. `ndl_client.py` (paging, ≥3 s spacing, retries) → `fetch.py` (date window, 60-day lookback, change detection, atomic writes).
4. `resolver.py` (spec §4.5) + a regression check against existing `all_speeches.jsonl` (target ≥99% agreement).
5. `route.py` (merge by `speechID`, newest-first, topic files, `--retry-unmatched`, `upsert_speeches_bulk` behind `--no-db-speeches`; DB writes stay off until the §4.10 repair).
6. `upload.py` (changed paths only, issues first, `AWS_PROFILE=kokkai-speech-update`, no delete) · `state.py` (lock, resumable state in `s3_mirror/.speech-update/`) · `notify.py` (Slack).
7. **First run:** `python -m speech_update all --dry-run --from 2026-09-01` → review the diff summary with the user → real backfill from Dec 2025.
8. Then the §4.10 table repair, then Phase 2 (launchd).
