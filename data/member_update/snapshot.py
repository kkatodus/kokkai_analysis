"""parliamentMembers/{house}_{YYYYMMDD}.json: find the latest, diff, write.

The backend serves the file that sorts last per house, so a new dated file
replaces the old one once uploaded. Old files are kept.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

from speech_update.state import write_atomic

from .match import member_key

SNAPSHOT_RE = re.compile(r"^(shugiin|sangiin)_(\d{8})\.json$")


def latest_snapshot(members_dir: Path, house: str) -> Optional[Path]:
	files = sorted(p for p in members_dir.glob(f"{house}_*.json") if SNAPSHOT_RE.match(p.name))
	return files[-1] if files else None


def read_rows(path: Optional[Path]) -> List[dict]:
	if path is None:
		return []
	return json.loads(path.read_text(encoding="utf-8"))["reprs"]


def render(rows: List[dict]) -> str:
	# same layout as the existing files: 4-space indent, raw UTF-8, no trailing newline
	return json.dumps({"reprs": rows}, ensure_ascii=False, indent=4)


def snapshot_path(members_dir: Path, house: str, day: date) -> Path:
	return members_dir / f"{house}_{day:%Y%m%d}.json"


def write_snapshot(path: Path, rows: List[dict]) -> None:
	write_atomic(path, render(rows))


def diff(old: List[dict], new: List[dict]) -> Dict[str, list]:
	"""Joined / left members and changes in name, 会派, district or person_id.

	Rows pair up by person_id first, then by name + reading, so a corrected or
	changed name shows as a change rather than a join plus a leave.
	"""
	pairs = []
	o_left = list(old)
	o_by_pid = {r["person_id"]: r for r in old if r.get("person_id") is not None}
	o_by_key = {member_key(r): r for r in old}
	joined = []
	for r in new:
		match = o_by_pid.get(r.get("person_id")) if r.get("person_id") is not None else None
		match = match or o_by_key.get(member_key(r))
		if match is not None and any(m is match for m in o_left):
			o_left = [m for m in o_left if m is not match]
			pairs.append((match, r))
		else:
			joined.append(r)
	changed = []
	for a, b in pairs:
		fields = {f: (a.get(f), b.get(f)) for f in ("name", "kaiha", "district", "person_id") if a.get(f) != b.get(f)}
		if fields:
			changed.append((b["name"], fields))
	return {"joined": joined, "left": o_left, "changed": changed}
