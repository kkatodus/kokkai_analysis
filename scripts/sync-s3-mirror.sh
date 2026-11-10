#!/usr/bin/env bash
# Mirror the S3 data lake (s3://kokkai-doc-bucket-<env>/kokkai-doc/) into s3_mirror/kokkai-doc/.
#
# Usage:
#   ./scripts/sync-s3-mirror.sh [--env prod|staging|dev] [--background] [--delete] [--dryrun]
#
#   --env         Which bucket to pull from (default: dev — the only bucket that currently exists)
#   --background  Detach from the terminal; progress goes to the log file only
#   --delete      Also remove local files that no longer exist in S3
#   --dryrun      Show what would be transferred without downloading
#
# Respects AWS_PROFILE / AWS_REGION. Safe to re-run: only new or changed files are fetched.
# On macOS the sync runs under `caffeinate` so the machine doesn't sleep mid-download.
set -euo pipefail

source "$(dirname "$0")/_common.sh"

ENV_NAME="dev"
BACKGROUND=0
EXTRA_ARGS=()
MAX_ATTEMPTS=5

while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    --env=*) ENV_NAME="${1#*=}"; shift ;;
    --background) BACKGROUND=1; shift ;;
    --delete) EXTRA_ARGS+=(--delete); shift ;;
    --dryrun) EXTRA_ARGS+=(--dryrun); shift ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$ENV_NAME" in
  prod|staging|dev) ;;
  *) echo "--env must be prod, staging or dev (got: $ENV_NAME)" >&2; exit 2 ;;
esac

SRC="s3://kokkai-doc-bucket-${ENV_NAME}/kokkai-doc/"
DEST="$REPO_ROOT/s3_mirror/kokkai-doc/"
LOG_DIR="$REPO_ROOT/s3_mirror/.sync-logs"
LOG_FILE="$LOG_DIR/sync-${ENV_NAME}-$(date +%Y%m%d-%H%M%S).log"
export AWS_REGION="${AWS_REGION:-ap-northeast-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install it with: brew install awscli" >&2
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials are missing or expired. Run 'aws configure' or 'aws sso login' first." >&2
  exit 1
fi

mkdir -p "$DEST" "$LOG_DIR"

# Re-launch detached; the child skips this branch because --background is not passed again.
if [ "$BACKGROUND" -eq 1 ]; then
  args=(--env "$ENV_NAME")
  if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then args+=("${EXTRA_ARGS[@]}"); fi
  nohup "$0" "${args[@]}" >/dev/null 2>&1 &
  echo "Sync running in background (pid $!)."
  echo "Follow progress: tail -f $LOG_DIR/sync-${ENV_NAME}-*.log"
  exit 0
fi

KEEP_AWAKE=()
if command -v caffeinate >/dev/null 2>&1; then KEEP_AWAKE=(caffeinate -i); fi

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

log "Syncing $SRC -> $DEST"
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  # --only-show-errors keeps the log readable; per-file progress for millions of objects is noise.
  if "${KEEP_AWAKE[@]+"${KEEP_AWAKE[@]}"}" aws s3 sync "$SRC" "$DEST" \
      --only-show-errors ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} 2>&1 | tee -a "$LOG_FILE"; then
    log "Done. Local mirror size: $(du -sh "$DEST" | cut -f1)"
    exit 0
  fi
  log "Attempt $attempt/$MAX_ATTEMPTS failed."
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    sleep $((attempt * 30))
  fi
done

log "Giving up after $MAX_ATTEMPTS attempts. Re-run the script to resume; finished files are kept."
exit 1
