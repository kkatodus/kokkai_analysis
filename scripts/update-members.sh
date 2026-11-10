#!/usr/bin/env bash
# Scheduled entry point for the member list updater (specs/member-auto-update/).
# Runs `python -m member_update all --notify`; on failure retries once after
# 15 min, and only the retry's failure is sent to Slack.
#
#   ./scripts/update-members.sh              # what launchd runs
#   ./scripts/update-members.sh --dry-run    # extra args go to `member_update all`
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PY="$REPO/.venv-speech-update/bin/python"
if [[ ! -x "$PY" ]]; then
	echo "missing venv; create it with:" >&2
	echo "  /opt/homebrew/bin/python3 -m venv .venv-speech-update && .venv-speech-update/bin/pip install -r data/requirements-speech-update.txt" >&2
	exit 1
fi
# launchd starts with a bare PATH
export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
RETRY_DELAY="${MEMBER_UPDATE_RETRY_DELAY:-900}"

run() {
	(cd "$REPO/data" && caffeinate -i "$PY" -m member_update all --notify "$@")
}

MEMBER_UPDATE_NOTIFY_FAILURE=0 run "$@"
status=$?
# 75 = another run holds the lock; don't retry
if [[ $status -ne 0 && $status -ne 75 ]]; then
	echo "member update failed (exit $status); retrying in ${RETRY_DELAY}s" >&2
	sleep "$RETRY_DELAY"
	MEMBER_UPDATE_NOTIFY_FAILURE=1 run "$@"
	status=$?
fi
exit $status
