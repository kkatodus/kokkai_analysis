#!/usr/bin/env bash
# Install, remove or inspect the monthly launchd job for the topic scaling refresh
# (specs/topic-scaling-refresh/). Runs scripts/update-topic-scaling.sh on the 2nd and 3rd of each
# month at 05:00 (after the nightly speech update and the 1st-of-month member refresh); launchd runs a missed job once
# the Mac wakes.
#
#   ./scripts/install-topic-scaling-schedule.sh install
#   ./scripts/install-topic-scaling-schedule.sh uninstall
#   ./scripts/install-topic-scaling-schedule.sh status
#   ./scripts/install-topic-scaling-schedule.sh run-now    # kick the job once
set -euo pipefail

LABEL="com.kokkaidoc.topic-scaling"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO/scripts/update-topic-scaling.sh"
LOG_DIR="$REPO/s3_mirror/.topic-scaling/logs"
DOMAIN="gui/$(id -u)"

install() {
	[[ -x "$SCRIPT" ]] || { echo "not executable: $SCRIPT" >&2; exit 1; }
	[[ -x "$REPO/.venv-topic-scaling/bin/python" ]] || { echo "missing venv; see docs/agents/DATA-PIPELINES.md" >&2; exit 1; }
	mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"
	cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$SCRIPT</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO</string>
	<key>StartCalendarInterval</key>
	<array>
		<dict>
			<key>Day</key>
			<integer>2</integer>
			<key>Hour</key>
			<integer>5</integer>
			<key>Minute</key>
			<integer>0</integer>
		</dict>
		<dict>
			<key>Day</key>
			<integer>3</integer>
			<key>Hour</key>
			<integer>5</integer>
			<key>Minute</key>
			<integer>0</integer>
		</dict>
	</array>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/launchd.out.log</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/launchd.err.log</string>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
EOF
	plutil -lint "$PLIST" >/dev/null
	launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
	launchctl bootstrap "$DOMAIN" "$PLIST"
	echo "installed $LABEL → $SCRIPT (2nd and 3rd of each month, 05:00)"
}

uninstall() {
	launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
	rm -f "$PLIST"
	echo "removed $LABEL"
}

status() {
	if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
		launchctl print "$DOMAIN/$LABEL" | grep -E "state|last exit code|program|runs" || true
	else
		echo "$LABEL is not loaded"
	fi
	local last="$REPO/s3_mirror/.topic-scaling/last_run.json"
	[[ -f "$last" ]] && { echo "last_run.json:"; cat "$last"; }
}

case "${1:-}" in
	install) install ;;
	uninstall) uninstall ;;
	status) status ;;
	run-now) launchctl kickstart "$DOMAIN/$LABEL" && echo "started $LABEL" ;;
	*) echo "usage: $0 install|uninstall|status|run-now" >&2; exit 2 ;;
esac
