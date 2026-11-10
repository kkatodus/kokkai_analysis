# Postgres backup to S3

**Status:** in-progress (built 2026-11-10)

## Goal

The local Postgres database `kokkaidoc` is the only copy of the `speeches` table (11 GB), the speaker-review decisions, `person_alias`, and the speech-quality label results. The S3 mirror is derived from it and can be rebuilt, but the database itself had no backup beyond ad-hoc dumps in `~`. This job keeps a rolling set of weekly dumps in S3.

## Design

- **Entry point:** `scripts/backup-db.sh` (bash, no Python). `scripts/install-db-backup-schedule.sh install|uninstall|status|run-now` manages launchd label `com.kokkaidoc.db-backup`, **Sundays 06:00**, after the 04:00 speech update. Runs from the main `kokkai_analysis` checkout on `prd`, like the other jobs.
- **Dump:** `pg_dump -Fc -Z 6` of `kokkaidoc`, excluding `speeches_pre_repair` (an 8 GB frozen copy of the table before the 2026-10-14 rebuild, referenced by nothing; archived once by hand, see below). Expected size ≈ 2.5 GB, 5–10 min.
- **Verify:** `pg_restore --list` must succeed; the table count is logged.
- **Upload:** `aws s3 cp --storage-class STANDARD_IA` with the `kokkai-speech-update` profile to `s3://kokkai-doc-bucket-dev/backups/postgres/kokkaidoc-<YYYYMMDD-HHMMSS>.dump`, plus `backups/postgres/latest.txt` holding the newest key. The local dump is deleted after upload (`--keep-local` keeps it).
- **Retention:** bucket lifecycle rule `expire-db-backups-60d` on prefix `backups/` (60-day expiry, abort incomplete multipart uploads after 2 days) → about 8 dumps, ≈ 20 GB in STANDARD_IA, well under $1/month. The job user has no `s3:DeleteObject`, so a bug in the script cannot remove backups.
- **Failure handling:** one retry after 15 min; the retry's failure is posted to Slack (`SLACK_WEBHOOK_URL` from `data/.env`). Success posts a one-line summary. A pid lock makes overlapping runs exit 75. Refuses to run with under 10 GB free.
- **State:** `s3_mirror/.db-backup/` → `logs/backup-<ts>.log`, `last_run.json`, `tmp/` (dump in flight), `lock`.
- **Config:** every value is an env var `DB_BACKUP_*` (see the script header). `--dry-run` dumps and verifies without uploading.

## AWS changes (one-time, done with the account's default profile)

1. IAM inline policy `kokkai-doc-bucket-dev-rw` on user `kokkai-speech-update`: added `s3:ListBucket` on prefix `backups/*` and `s3:PutObject`/`GetObject`/`AbortMultipartUpload`/`ListMultipartUploadParts` on `backups/*`. No delete.
2. Bucket lifecycle rule `expire-db-backups-60d` (above).
3. `speeches_pre_repair` dumped once to `s3://kokkai-doc-bucket-dev/archive/postgres/speeches_pre_repair-20261110.dump` (the `archive/` prefix has no lifecycle rule). Dropping the table locally would free 8 GB; not done.

## Restore procedure

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
KEY=$(aws s3 cp --profile kokkai-speech-update s3://kokkai-doc-bucket-dev/backups/postgres/latest.txt -)
aws s3 cp --profile kokkai-speech-update "s3://kokkai-doc-bucket-dev/$KEY" /tmp/kokkaidoc.dump
createdb -h localhost -U postgres kokkaidoc_restore
pg_restore -h localhost -U postgres -d kokkaidoc_restore --no-owner /tmp/kokkaidoc.dump
psql -h localhost -U postgres -d kokkaidoc_restore -c 'select count(*) from speeches'
```

Restore into a scratch database first; swap names only after the counts look right. **Test this once a quarter** and note the date here:

| Date | Dump | Result |
|---|---|---|
| | | |

## Open questions

- Daily instead of weekly? The data changes slowly (a few hundred speeches a day) and the nightly job can regenerate recent days from NDL, so weekly is the cost-aware default.
- Drop `speeches_pre_repair` after confirming the archive dump restores.
