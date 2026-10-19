#!/usr/bin/env bash
# Scheduled entry point for the monthly topic scaling refresh (specs/topic-scaling-refresh/).
# Runs `python -m topic_scaling all --notify`; on failure retries once after 15 min, and
# only the retry's failure is sent to Slack.
#
#   ./scripts/update-topic-scaling.sh                    # what launchd runs
#   ./scripts/update-topic-scaling.sh --dry-run          # extra args go to `topic_scaling all`
#   ./scripts/update-topic-scaling.sh --publish-partial  # during the backfill
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PY="$REPO/.venv-topic-scaling/bin/python"
if [[ ! -x "$PY" ]]; then
	echo "missing venv; create it with:" >&2
	echo "  /opt/homebrew/bin/python3.12 -m venv .venv-topic-scaling && .venv-topic-scaling/bin/pip install -r data/requirements-topic-scaling.txt" >&2
	exit 1
fi
# launchd starts with a bare PATH
export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PYTORCH_ENABLE_MPS_FALLBACK=1
export TOKENIZERS_PARALLELISM=false
RETRY_DELAY="${TOPIC_SCALING_RETRY_DELAY:-900}"

run() {
	(cd "$REPO/data" && caffeinate -i "$PY" -m topic_scaling all --notify "$@")
}

TOPIC_SCALING_NOTIFY_FAILURE=0 run "$@"
status=$?
# 75 = another run holds the lock; don't retry
if [[ $status -ne 0 && $status -ne 75 ]]; then
	echo "topic scaling failed (exit $status); retrying in ${RETRY_DELAY}s" >&2
	sleep "$RETRY_DELAY"
	TOPIC_SCALING_NOTIFY_FAILURE=1 run "$@"
	status=$?
fi
exit $status
