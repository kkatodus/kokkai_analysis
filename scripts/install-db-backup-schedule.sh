#!/usr/bin/env bash
# Install, remove or inspect the weekly launchd job for the Postgres backup
# (specs/db-backup/). Runs scripts/backup-db.sh every Sunday at 06:00 (after the
# 04:00 speech update); launchd runs a missed job once the Mac wakes.
#
#   ./scripts/install-db-backup-schedule.sh install
#   ./scripts/install-db-backup-schedule.sh uninstall
#   ./scripts/install-db-backup-schedule.sh status
#   ./scripts/install-db-backup-schedule.sh run-now    # kick the job once
set -euo pipefail

LABEL="com.kokkaidoc.db-backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$REPO/scripts/backup-db.sh"
LOG_DIR="$REPO/s3_mirror/.db-backup/logs"
DOMAIN="gui/$(id -u)"

install() {
	[[ -x "$SCRIPT" ]] || { echo "not executable: $SCRIPT" >&2; exit 1; }
	command -v /opt/homebrew/opt/postgresql@17/bin/pg_dump >/dev/null || { echo "missing pg_dump (postgresql@17)" >&2; exit 1; }
	command -v /opt/homebrew/bin/aws >/dev/null || { echo "missing aws cli" >&2; exit 1; }
	mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"
	cat > "$PLIST" <<EOP
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
	<dict>
		<key>Weekday</key>
		<integer>0</integer>
		<key>Hour</key>
		<integer>6</integer>
		<key>Minute</key>
		<integer>0</integer>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG_DIR/launchd.out.log</string>
	<key>StandardErrorPath</key>
	<string>$LOG_DIR/launchd.err.log</string>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
EOP
	plutil -lint "$PLIST" >/dev/null
	launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
	launchctl bootstrap "$DOMAIN" "$PLIST"
	echo "installed $LABEL → $SCRIPT (Sundays 06:00)"
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
	local last="$REPO/s3_mirror/.db-backup/last_run.json"
	[[ -f "$last" ]] && { echo "last_run.json:"; cat "$last"; }
}

case "${1:-}" in
	install) install ;;
	uninstall) uninstall ;;
	status) status ;;
	run-now) launchctl kickstart "$DOMAIN/$LABEL" && echo "started $LABEL" ;;
	*) echo "usage: $0 install|uninstall|status|run-now" >&2; exit 2 ;;
esac
