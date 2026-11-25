#!/usr/bin/env bash
# Scheduled entry point for the Postgres backup (specs/db-backup/).
# Dumps the local `kokkaidoc` database (custom format, compressed, minus the frozen
# `speeches_pre_repair` snapshot), verifies the dump, uploads it to
# s3://kokkai-doc-bucket-dev/backups/postgres/ as STANDARD_IA, then deletes the local
# copy. A lifecycle rule on the bucket expires backups after 60 days.
# On failure retries once after 15 min; only the retry's failure is sent to Slack.
#
#   ./scripts/backup-db.sh              # what launchd runs (Sunday 06:00)
#   ./scripts/backup-db.sh --dry-run    # dump + verify, no upload
#   ./scripts/backup-db.sh --keep-local # also keep the dump in s3_mirror/.db-backup/
#
# Every setting can be overridden with an environment variable (DB_BACKUP_*).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# launchd starts with a bare PATH
export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

STATE_DIR="${DB_BACKUP_STATE_DIR:-$REPO/s3_mirror/.db-backup}"
ENV_FILE="${DB_BACKUP_ENV_FILE:-$REPO/data/.env}"
DB_NAME="${DB_BACKUP_DB:-kokkaidoc}"
DB_HOST="${DB_BACKUP_HOST:-localhost}"
DB_USER="${DB_BACKUP_USER:-postgres}"
EXCLUDE_TABLES="${DB_BACKUP_EXCLUDE_TABLES:-speeches_pre_repair}"   # space-separated
BUCKET="${DB_BACKUP_BUCKET:-kokkai-doc-bucket-dev}"
S3_PREFIX="${DB_BACKUP_S3_PREFIX:-backups/postgres}"
AWS_PROFILE_NAME="${DB_BACKUP_AWS_PROFILE:-kokkai-speech-update}"
STORAGE_CLASS="${DB_BACKUP_STORAGE_CLASS:-STANDARD_IA}"
MIN_FREE_GB="${DB_BACKUP_MIN_FREE_GB:-10}"
RETRY_DELAY="${DB_BACKUP_RETRY_DELAY:-900}"
NOTIFY_FAILURE="${DB_BACKUP_NOTIFY_FAILURE:-1}"

DRY_RUN=0; KEEP_LOCAL=0
for arg in "$@"; do
	case "$arg" in
		--dry-run) DRY_RUN=1 ;;
		--keep-local) KEEP_LOCAL=1 ;;
		*) echo "unknown argument: $arg" >&2; exit 2 ;;
	esac
done

mkdir -p "$STATE_DIR/logs" "$STATE_DIR/tmp"
LOG="$STATE_DIR/logs/backup-$(date +%Y%m%d-%H%M%S).log"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG" >&2; }

# read one KEY=value from data/.env (quotes stripped); never echo the value
env_value() {
	grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

notify() {   # $1 = text; a notification failure never fails the run
	local hook; hook="$(env_value SLACK_WEBHOOK_URL)"
	if [[ -n "$hook" ]]; then
		curl -sS -m 15 -X POST -H 'Content-type: application/json' \
			--data "$(printf '{"text": %s}' "$(printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")" \
			"$hook" >/dev/null 2>>"$LOG" || log "WARN slack webhook failed"
	else
		osascript -e "display notification \"$1\" with title \"Kokkai DB backup\"" 2>/dev/null || true
	fi
}

write_last_run() {   # $1 status, $2 key, $3 bytes, $4 seconds
	printf '{"status": "%s", "key": "%s", "bytes": %s, "duration_s": %s, "dry_run": %s, "finished_at": "%s", "log": "%s"}\n' \
		"$1" "$2" "${3:-0}" "${4:-0}" "$DRY_RUN" "$(date +%Y-%m-%dT%H:%M:%S)" "$LOG" > "$STATE_DIR/last_run.json"
}

run_once() {
	local start ts dump key bytes human free_gb excl=() t
	start=$(date +%s)
	ts=$(date +%Y%m%d-%H%M%S)
	dump="$STATE_DIR/tmp/$DB_NAME-$ts.dump"
	key="$S3_PREFIX/$DB_NAME-$ts.dump"

	export PGPASSWORD; PGPASSWORD="$(env_value PSQL_DATABASE_PASSWORD)"
	[[ -n "$PGPASSWORD" ]] || { log "ERROR PSQL_DATABASE_PASSWORD not found in $ENV_FILE"; return 1; }

	free_gb=$(df -g "$STATE_DIR" | awk 'NR==2 {print $4}')
	if (( free_gb < MIN_FREE_GB )); then
		log "ERROR only ${free_gb} GB free under $STATE_DIR (need $MIN_FREE_GB)"; return 1
	fi

	# drop leftovers from an interrupted run
	find "$STATE_DIR/tmp" -name "$DB_NAME-*.dump" -mmin +720 -delete 2>/dev/null || true

	for t in $EXCLUDE_TABLES; do excl+=(--exclude-table="$t" --exclude-table-data="$t"); done
	log "pg_dump $DB_NAME (excluding: ${EXCLUDE_TABLES:-nothing}) -> $dump"
	if ! caffeinate -i pg_dump -h "$DB_HOST" -U "$DB_USER" -Fc -Z 6 "${excl[@]}" -f "$dump" "$DB_NAME" 2>>"$LOG"; then
		log "ERROR pg_dump failed"; rm -f "$dump"; return 1
	fi
	bytes=$(stat -f %z "$dump")
	human=$(du -h "$dump" | cut -f1)
	log "dump written: $human"

	# the dump is readable and has a table of contents
	if ! pg_restore --list "$dump" >/dev/null 2>>"$LOG"; then
		log "ERROR pg_restore --list failed; dump is corrupt"; rm -f "$dump"; return 1
	fi
	local tables; tables=$(pg_restore --list "$dump" | grep -c 'TABLE DATA')
	log "dump verified: $tables tables with data"

	if (( DRY_RUN )); then
		log "dry run: not uploading to s3://$BUCKET/$key"
	else
		log "uploading to s3://$BUCKET/$key ($STORAGE_CLASS)"
		if ! caffeinate -i aws s3 cp --profile "$AWS_PROFILE_NAME" --only-show-errors \
				--storage-class "$STORAGE_CLASS" "$dump" "s3://$BUCKET/$key" 2>>"$LOG"; then
			log "ERROR upload failed"; return 1
		fi
		# small pointer to the newest dump, for the restore procedure
		printf '%s\n' "$key" | aws s3 cp --profile "$AWS_PROFILE_NAME" --only-show-errors \
			--content-type text/plain - "s3://$BUCKET/$S3_PREFIX/latest.txt" 2>>"$LOG" || log "WARN could not write latest.txt"
		log "upload done"
	fi

	(( KEEP_LOCAL )) || rm -f "$dump"
	local secs=$(( $(date +%s) - start ))
	write_last_run ok "$key" "$bytes" "$secs"
	log "SUMMARY db=$DB_NAME bytes=$bytes tables=$tables key=$key dry_run=$DRY_RUN duration_s=$secs"
	(( DRY_RUN )) || notify "Kokkai DB backup: $human uploaded to s3://$BUCKET/$key ($tables tables, ${secs}s)"
	return 0
}

# single-run pid lock (exit 75 = another run holds it, same convention as update-speeches.sh)
LOCK="$STATE_DIR/lock"
if [[ -s "$LOCK" ]] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
	log "another backup is running (pid $(cat "$LOCK"))"; exit 75
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

if run_once; then exit 0; fi
status=$?
log "backup failed (exit $status); retrying in ${RETRY_DELAY}s"
sleep "$RETRY_DELAY"
if run_once; then exit 0; fi
status=$?
write_last_run failed "" 0 0
if [[ "$NOTIFY_FAILURE" == "1" ]]; then
	notify "Kokkai DB backup FAILED twice (exit $status). Log: $LOG"
fi
exit $status
