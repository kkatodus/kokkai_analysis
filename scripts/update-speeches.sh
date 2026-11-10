#!/usr/bin/env bash
# Scheduled entry point for the NDL speech updater (specs/speech-auto-update/).
# Runs `python -m speech_update all --notify`; on failure retries once after
# 15 min, and only the retry's failure is sent to Slack.
#
#   ./scripts/update-speeches.sh              # what launchd runs
#   ./scripts/update-speeches.sh --dry-run    # extra args go to `speech_update all`
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
RETRY_DELAY="${SPEECH_UPDATE_RETRY_DELAY:-900}"

run() {
	(cd "$REPO/data" && caffeinate -i "$PY" -m speech_update all --notify "$@")
}

SPEECH_UPDATE_NOTIFY_FAILURE=0 run "$@"
status=$?
# 75 = another run holds the lock; don't retry
if [[ $status -ne 0 && $status -ne 75 ]]; then
	echo "speech update failed (exit $status); retrying in ${RETRY_DELAY}s" >&2
	sleep "$RETRY_DELAY"
	SPEECH_UPDATE_NOTIFY_FAILURE=1 run "$@"
	status=$?
fi
exit $status
