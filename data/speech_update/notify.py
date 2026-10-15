"""Slack incoming-webhook notifications, with a macOS notification fallback.

A notification failure never fails the run.
"""
from __future__ import annotations

import logging
import os
import subprocess
from typing import List

import requests

log = logging.getLogger(__name__)

MAX_LISTED = 20


class Notifier:
	def __init__(self, webhook_url: str | None, enabled: bool = True, title: str = "Kokkai speech update"):
		self.webhook_url = (webhook_url or "").strip().strip('"').strip("'") or None
		self.enabled = enabled
		self.title = title

	def send(self, text: str) -> None:
		if not self.enabled:
			log.info("notification (not sent): %s", text)
			return
		if self.webhook_url:
			try:
				r = requests.post(self.webhook_url, json={"text": text}, timeout=15)
				if r.ok:
					return
				log.warning("Slack webhook returned %s: %s", r.status_code, r.text[:200])
			except requests.RequestException as e:
				log.warning("Slack webhook failed: %s", e)
		else:
			log.warning("SLACK_WEBHOOK_URL not set; falling back to a macOS notification")
		self._mac_notification(text)

	def _mac_notification(self, text: str) -> None:
		first_line = text.splitlines()[0][:200].replace('"', "'")
		try:
			subprocess.run(
				["osascript", "-e", f'display notification "{first_line}" with title "{self.title}"'],
				check=False, timeout=10, capture_output=True,
			)
		except Exception as e:  # noqa: BLE001
			log.warning("macOS notification failed: %s", e)

	# --- message formats (spec §4.9) ---

	def success(self, summary: dict) -> None:
		self.send(
			"✅ Speech update {window_from} → {window_until}: {meetings_checked} meetings checked, "
			"{meetings_new} new / {meetings_changed} changed; {speeches_added} speeches added, "
			"{speeches_updated} updated; {files_uploaded} files uploaded; {duration_s:.0f}s".format(**summary)
			+ (" · {review_pending} speaker match(es) awaiting review".format(**summary) if summary.get("review_pending") else "")
		)

	def failure(self, stage: str, error: str, log_path: str) -> None:
		self.send(f"❌ Speech update failed in *{stage}*: {error}\nLog: `{log_path}`")

	def unmatched(self, entries: List[dict]) -> None:
		names = sorted({(e["speaker"], e.get("speakerYomi") or "", e.get("speakerGroup") or "") for e in entries})
		lines = [f"• {n} ({y}) {g}" for n, y, g in names[:MAX_LISTED]]
		if len(names) > MAX_LISTED:
			lines.append(f"…and {len(names) - MAX_LISTED} more")
		self.send(
			f"⚠️ {len(names)} new unmatched member speaker(s):\n" + "\n".join(lines)
			+ "\nAdd them to Postgres `person` (create_local_db_for_politicians.py), then run "
			"`cd data && ../.venv-speech-update/bin/python -m speech_update route --retry-unmatched "
			"&& ../.venv-speech-update/bin/python -m speech_update upload`"
		)


	def review_needed(self, keys: List[tuple], pending: int) -> None:
		lines = [f"• {k[0]} ({k[1]}) → #{k[2]} [{k[3]}]" for k in keys[:MAX_LISTED]]
		if len(keys) > MAX_LISTED:
			lines.append(f"…and {len(keys) - MAX_LISTED} more")
		self.send(
			f"🔎 {len(keys)} new speaker match(es) need review ({pending} pending in total); "
			"their speeches are held until you decide:\n" + "\n".join(lines)
			+ "\nReview: `cd data && ../.venv-speech-update/bin/python -m speech_update.review` "
			"(decisions go live in the next nightly run)"
		)


def from_env(enabled: bool, title: str = "Kokkai speech update") -> Notifier:
	return Notifier(os.environ.get("SLACK_WEBHOOK_URL"), enabled=enabled, title=title)
