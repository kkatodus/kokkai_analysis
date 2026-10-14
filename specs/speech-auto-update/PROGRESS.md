# Speech auto-update: progress & handoff

**Last updated:** 2026-10-14 (session 2) · **Spec:** [README.md](README.md) · **Next:** add 原田和広 / 木村義雄 to `person` → §4.10 repair → Phase 2 (launchd)

Read this first when picking the work back up in a fresh session. The design is in `README.md`; this file covers where things stand, what the environment looks like, and the traps found along the way.

---

## 1. Where things stand

| Phase (spec §9) | State |
|---|---|
| 0 · Prerequisites | ✅ Done |
| 1 · Build `data/speech_update/` + dry-run + backfill | ✅ Done 2026-10-14. Backfill uploaded, and a re-run is a no-op (§6) |
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

## 6. Session 2 (2026-10-14): Phase 1 build

**Code** (on `dev`): `data/speech_update/` (`models`, `config`, `ndl_client`, `fetch`, `resolver`, `route`, `upload`, `state`, `notify`, `__main__`, `check_resolver`, `tests/`), `data/utils/speech_topics.py`, `upsert_speeches_bulk()` in `dbio/representative_db.py`, `scripts/update-speeches.sh`, `data/requirements-speech-update.txt`.

**Venv:** `.venv-speech-update/` at the repo root (gitignored), Homebrew Python 3.15. Create it with `/opt/homebrew/bin/python3 -m venv .venv-speech-update && .venv-speech-update/bin/pip install -r data/requirements-speech-update.txt`. Run everything from `data/`.

**Decisions made while building**
- Upload uses **boto3** (thread pool, profile `kokkai-speech-update`) instead of per-directory `aws s3 cp`, because a backfill touches ~8.6k files in ~2.5k directories. Content types match what `aws s3` set on the existing objects.
- Postgres `speeches` writes are **off by default** (`SPEECH_UPDATE_DB_SPEECHES=0`; `--db-speeches` turns them on) until the §4.10 repair is done. After the repair, flip the default in `config.py` or set the env var in the wrapper.
- Resolver additions on top of spec §4.5, both for same-name candidates only: (a) a unique `name_kana == speakerYomi` match wins; (b) `立憲民主` → `立憲民主党` alias, since NDL 会派 names drop the 党. Party matching compares whole names only (`民主党` is a substring of `自由民主党`).
- Unmatched speakers with **no `speakerGroup`** (officials, witnesses) are skipped silently and counted. Only speakers that have a group go to `unmatched_speakers.jsonl` and Slack.
- Slack is off for manual runs. `--notify` turns it on, and the wrapper passes it. The wrapper's first attempt sets `SPEECH_UPDATE_NOTIFY_FAILURE=0`, so only the retry's failure is posted.
- Frontend revalidation (Q4): **skipped.** Revalidation is a Next.js server action (`app/actions/revalidate`). No token-callable endpoint exists.
- The legacy scripts (`collect_all_speeches.py`, `reorganize_all_repr_speeches.py`) are unchanged. The one exception is the `\s` escape fix in `utils/string_process.py` (it's a raw string now; behaviour is the same).

**Gotchas**
- NDL's CloudFront returns **403 to the default `python-requests` User-Agent**. The client sets its own UA.
- The latest issue in the mirror is **2025-12-18**, so with no state the default window is `2025-10-19 → today`.

**Verification**
- 24 unit tests pass: `cd data && ../.venv-speech-update/bin/python -m unittest discover -s speech_update/tests -t .`
- Resolver regression over **all 4,525** person dirs: 588,389 / 588,393 distinct (speaker, yomi, group, date) keys agree (100.00%). The 4 misses (福島みずほ ×3, 櫻田義孝 ×1) have no yomi/group. The old script filled them from its name-only cache; the new code skips them as non-members.
- **Full dry run** (`python -m speech_update all --dry-run`, 5.5 min, 104 NDL requests): 1,040 meetings · **892 new, 143 changed** · 98,589 speeches → 77,066 matched (83 via same-name disambiguation), 20,093 non-member skipped · `all_speeches` **+68,186 added / 8,880 updated across 796 people** · would upload 2,070 issue files + 6,524 person files.
  - The 143 "changed" issues are genuine. NDL replaced preliminary records with final ones that now have `pdfURL`, `startPage` and new create/update times. Speech counts are unchanged.
- Unmatched member speakers in that window (before the resolver fixes above; 鬼木誠 and 大津力 resolve now):
  - **寺田学** → `person` 2603 and 5724 are duplicate rows for the same person (identical election histories). Merge or delete one, then `route --retry-unmatched`.
  - **大津力** → 5278 (`おおつとむ`) and 5727 (`おおつつとむ`) also look like duplicates. The resolver now picks 5727 by yomi.
  - **原田和広** (はらだまさひろ, 立憲) and **木村義雄** (きむらよしお, 自民) → not in `person`. Add them, then `route --retry-unmatched`.
  - Other likely duplicate pairs in `person`: 金田勝年 5673/5728, 高橋千鶴子 1746/5725. 鬼木誠 1070/3960 and 山田太郎 848/3819 are genuinely different people.

**`person` dedupe (2026-10-14, user-approved).** Backup: `~/kokkaidoc-person-pre-dedupe-20261014.dump` (`person`, `election_result`, `x_account`). Web research confirmed each pair is one person. Kept the older rows, which have the fuller histories, and dropped **5724 (寺田学 → 2603), 5725 (高橋千鶴子 → 1746), 5728 (金田勝年 → 5673), 5727 (大津力 → 5278)**. 5278 is the ID `parliamentMembers/sangiin_20250911.json` uses. Every election on a dropped row already existed on the kept one. 5673 inherited X account `katutosh555`. Readings fixed: 5673 → かねだかつとし, 5278 → おおつつとむ. `person` now has 4,814 rows.
- **Follow-up (2026-10-14, user-approved):** deleted `person` 5838 (an empty duplicate of 藤田誠 5839), so `person` has 4,813 rows. The only shared names left are 佐藤静雄, 山田太郎 and 鬼木誠, all genuinely different people. Edited `s3_mirror/kokkai-doc/politicians/table.csv(.gz)` to drop 5724/5725/5727/5728/5838 and fix the two readings (CRLF kept; originals in `s3_mirror/.speech-update/backups/`). (Uploaded later the same day, see below.) `electionHistory/{5724,5725,5727,5728,5838}.jsonl` stay in S3 as orphans.

**Backfill (2026-10-14):** `python -m speech_update all`, window 2025-10-19 → 2026-10-14, 9.5 min. 1,040 meetings (892 new, 143 changed) · all_speeches **+68,559 added / 8,880 updated across 799 people** (262 via same-name disambiguation) · **5,993 files uploaded** to `s3://kokkai-doc-bucket-dev/kokkai-doc/`. Spot-checked sizes in S3 against the mirror. A second run checked 18 meetings, found 0 changes and uploaded nothing. `last_run.json` until = 2026-10-14.
- Still unmatched (`s3_mirror/.speech-update/unmatched_speakers.jsonl`): **原田和広** (はらだまさひろ, 立憲民主党・無所属) and **木村義雄** (きむらよしお, 自由民主党・無所属の会), 1 issue each. Add them to `person`, then run `route --retry-unmatched` + `upload`.

**New members (2026-10-14):** added to Postgres with web-verified election histories:
- **5868 木村義雄**: 衆院 旧香川1区/香川2区 1986–2005 (7 wins), 2009 loss; 参院比例 2010 loss, 2013 win, 2019 loss, 2022 loss, then 繰り上げ当選 2026-01-30 into the 2022 seat. Source: Wikipedia results table; 参議院 profile 7013016.
- **5869 原田和広**: 第50回衆院選 比例東北ブロック (立憲) 繰り上げ当選 2025-09-18 (総務省 notice). His 2026 result couldn't be verified, so it's omitted.

Wrote `electionHistory/{5868,5869}.jsonl` (same generator reproduces existing files byte-for-byte) and appended both to `politicians/table.csv(.gz)` (CRLF; signatures quoted iff they start with a digit, matching the file). Routed the **201** mirror issues where either speaks: all_speeches +4,018 (1,825 for the two new people, **2,193 for existing people whose speeches in these older meetings had never been routed**) / 105 updated across 137 people.
- The 105 "updates" only **added** `is_relevant`/`is_productive`/`quality_reason`, which some `issues/` files carry. Checked against the S3 originals: no field was dropped or altered. The merge now keeps extra fields on existing lines anyway (test added).
- Some person files already contained duplicate `speechID` lines (e.g. 1212 has 24). They're left as they are.
- **Bigger gap found:** those 201 meetings contain **44 more former members missing from `person`** (e.g. 小池百合子, 塩崎恭久, 江田五月, 櫻内義雄, 山本孝史). They're now in `unmatched_speakers.jsonl` (190 entries). The 2,193 unrouted speeches above suggest the old reorganize run never covered every issue either. A full-mirror audit (route every issue `--dry-run`, then list missing members) is worth a separate task.
- **Uploaded 2026-10-14:** 342 files (the 340 changed paths + `politicians/table.csv(.gz)`). Sizes checked against the mirror; nothing left in `changed_paths.txt`.

## 7. Next steps (Phase 1)

1. `data/requirements-speech-update.txt` + a venv for it.
2. `data/speech_update/models.py`: move `SpeechRecord`/`MeetingRecord`/`from_dict` out of `collect_all_speeches.py`.
3. `ndl_client.py` (paging, ≥3 s spacing, retries) → `fetch.py` (date window, 60-day lookback, change detection, atomic writes).
4. `resolver.py` (spec §4.5) + a regression check against existing `all_speeches.jsonl` (target ≥99% agreement).
5. `route.py` (merge by `speechID`, newest-first, topic files, `--retry-unmatched`, `upsert_speeches_bulk` behind `--no-db-speeches`; DB writes stay off until the §4.10 repair).
6. `upload.py` (changed paths only, issues first, `AWS_PROFILE=kokkai-speech-update`, no delete) · `state.py` (lock, resumable state in `s3_mirror/.speech-update/`) · `notify.py` (Slack).
1–6 ✅ done in session 2 (see §6).
7. **First run:** ✅ dry run + backfill done (§6). (Original plan: (optionally) a staged upload to `SPEECH_UPDATE_S3_PREFIX=kokkai-doc-staging-test`, then `cd data && ../.venv-speech-update/bin/python -m speech_update all` for the real backfill. Then fix the `person` duplicates/missing members and run `route --retry-unmatched` + `upload`.)
8. ⏭ Add the 2 unmatched members; resolve the two blocked cleanups above; §4.10 table repair; Phase 2 launchd (`install-speech-update-schedule.sh`, run `./scripts/update-speeches.sh` daily 04:00).
8. Then the §4.10 table repair, then Phase 2 (launchd).
