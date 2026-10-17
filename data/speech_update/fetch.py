"""Fetch stage: pull meetings in a date window and write new/changed issues."""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import MeetingRecord, meeting_from_api
from .ndl_client import NdlClient
from .state import write_atomic

log = logging.getLogger(__name__)

ISSUE_DATE_RE = re.compile(r"(\d{8})$")  # issueIDs end in the meeting date, YYYYMMDD


@dataclass
class FetchResult:
	date_from: date
	date_until: date
	checked: int = 0
	new: List[str] = field(default_factory=list)
	changed: List[str] = field(default_factory=list)
	removed_speeches: Dict[str, List[str]] = field(default_factory=dict)
	# changed meetings by issueID, kept only on --dry-run (nothing is written
	# to disk, so route reads them from here)
	meetings: Dict[str, MeetingRecord] = field(default_factory=dict)

	@property
	def written(self) -> List[str]:
		return self.new + self.changed


def latest_issue_date(issues_dir: Path) -> Optional[date]:
	"""Newest meeting date in the mirror, read from issueIDs (no file reads)."""
	newest = None
	with os.scandir(issues_dir) as it:
		for entry in it:
			m = ISSUE_DATE_RE.search(entry.name)
			if m and (newest is None or m.group(1) > newest):
				newest = m.group(1)
	if newest is None:
		return None
	return date(int(newest[:4]), int(newest[4:6]), int(newest[6:]))


def default_window(last_run: Optional[dict], issues_dir: Path, today: date, lookback_days: int) -> Tuple[date, date]:
	if last_run and last_run.get("until"):
		anchor = date.fromisoformat(last_run["until"])
	else:
		anchor = latest_issue_date(issues_dir) or today
	return anchor - timedelta(days=lookback_days), today


def issue_paths(issue_id: str) -> Tuple[str, str]:
	return f"issues/{issue_id}/meta.json", f"issues/{issue_id}/speeches.jsonl"


def read_issue(issue_dir: Path) -> Optional[Tuple[dict, List[dict]]]:
	meta_path, speeches_path = issue_dir / "meta.json", issue_dir / "speeches.jsonl"
	if not meta_path.exists() or not speeches_path.exists():
		return None
	meta = json.loads(meta_path.read_text(encoding="utf-8"))
	with open(speeches_path, encoding="utf-8") as f:
		speeches = [json.loads(l) for l in f if l.strip()]
	return meta, speeches


def _comparable_meta(meta: dict) -> dict:
	return {k: v for k, v in meta.items() if k != "nextRecordPosition"}


def diff_issue(existing: Optional[Tuple[dict, List[dict]]], meeting: MeetingRecord) -> Tuple[Optional[str], List[str]]:
	"""Return ("new" | "changed" | None, speechIDs that NDL removed)."""
	if existing is None:
		return "new", []
	old_meta, old_speeches = existing
	new_speeches = meeting.speech_dicts()
	old_ids = {s["speechID"] for s in old_speeches}
	removed = sorted(old_ids - {s["speechID"] for s in new_speeches})
	if _comparable_meta(old_meta) != _comparable_meta(meeting.meta_dict()) or old_speeches != new_speeches:
		return "changed", removed
	return None, removed


def write_issue(issues_dir: Path, meeting: MeetingRecord) -> None:
	issue_dir = issues_dir / meeting.issueID
	write_atomic(issue_dir / "speeches.jsonl", "".join(json.dumps(s, ensure_ascii=False) + "\n" for s in meeting.speech_dicts()))
	# meta.json last: a crash between the two leaves an issue that the next run sees as changed
	write_atomic(issue_dir / "meta.json", json.dumps(meeting.meta_dict(), ensure_ascii=False, indent=4))


def fetch(client: NdlClient, issues_dir: Path, date_from: date, date_until: date, dry_run: bool = False) -> FetchResult:
	result = FetchResult(date_from, date_until)
	for record in client.iter_meetings(date_from, date_until):
		meeting = meeting_from_api(record)
		result.checked += 1
		existing = read_issue(issues_dir / meeting.issueID)
		status, removed = diff_issue(existing, meeting)
		if removed:
			result.removed_speeches[meeting.issueID] = removed
			log.warning("NDL removed %d speech(es) from %s: %s (kept in per-person files)", len(removed), meeting.issueID, removed)
		if status is None:
			continue
		(result.new if status == "new" else result.changed).append(meeting.issueID)
		log.info("%s %s %s %s (%d speeches)", "would write" if dry_run else "write", status, meeting.issueID, meeting.nameOfMeeting, len(meeting.speechRecord))
		if dry_run:
			result.meetings[meeting.issueID] = meeting
		else:
			write_issue(issues_dir, meeting)
	return result
