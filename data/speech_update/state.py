"""Run lock, resumable per-run state and atomic file writes.

Layout (s3_mirror/.speech-update/):
  lock                      flock; a second run exits immediately
  last_run.json             summary of the last fully successful run
  changed_issues.json       issues fetched but not routed yet (cleared after route)
  changed_paths.txt         mirror paths written but not uploaded yet (cleared after upload)
  unmatched_speakers.jsonl  member speakers the resolver couldn't place
  logs/
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
from typing import Iterable, List, Optional, Set


class LockHeld(RuntimeError):
	pass


def write_atomic(path: Path, text: str) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	tmp = path.with_name(path.name + ".tmp")
	with open(tmp, "w", encoding="utf-8") as f:
		f.write(text)
		f.flush()
		os.fsync(f.fileno())
	os.replace(tmp, path)


class State:
	def __init__(self, state_dir: Path):
		self.dir = state_dir
		self.logs_dir = state_dir / "logs"
		self.logs_dir.mkdir(parents=True, exist_ok=True)
		self._lock_file = None

	# --- lock ---

	def acquire_lock(self) -> None:
		f = open(self.dir / "lock", "a+")
		try:
			fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
		except BlockingIOError:
			f.close()
			raise LockHeld(f"another speech update is running (lock: {self.dir / 'lock'})")
		f.seek(0)
		f.truncate()
		f.write(str(os.getpid()))
		f.flush()
		self._lock_file = f

	def release_lock(self) -> None:
		if self._lock_file:
			fcntl.flock(self._lock_file, fcntl.LOCK_UN)
			self._lock_file.close()
			self._lock_file = None

	# --- last_run.json ---

	@property
	def last_run_path(self) -> Path:
		return self.dir / "last_run.json"

	def last_run(self) -> Optional[dict]:
		if not self.last_run_path.exists():
			return None
		return json.loads(self.last_run_path.read_text(encoding="utf-8"))

	def save_last_run(self, summary: dict) -> None:
		write_atomic(self.last_run_path, json.dumps(summary, ensure_ascii=False, indent=2) + "\n")

	# --- changed_issues.json ---

	@property
	def changed_issues_path(self) -> Path:
		return self.dir / "changed_issues.json"

	def pending_issues(self) -> List[str]:
		if not self.changed_issues_path.exists():
			return []
		return json.loads(self.changed_issues_path.read_text(encoding="utf-8"))

	def add_pending_issues(self, issue_ids: Iterable[str]) -> None:
		merged = sorted(set(self.pending_issues()) | set(issue_ids))
		write_atomic(self.changed_issues_path, json.dumps(merged) + "\n")

	def clear_pending_issues(self, done: Iterable[str]) -> None:
		left = sorted(set(self.pending_issues()) - set(done))
		if left:
			write_atomic(self.changed_issues_path, json.dumps(left) + "\n")
		else:
			self.changed_issues_path.unlink(missing_ok=True)

	# --- changed_paths.txt (paths relative to the mirror root) ---

	@property
	def changed_paths_path(self) -> Path:
		return self.dir / "changed_paths.txt"

	def pending_paths(self) -> Set[str]:
		if not self.changed_paths_path.exists():
			return set()
		return {l for l in self.changed_paths_path.read_text(encoding="utf-8").splitlines() if l}

	def add_pending_paths(self, rel_paths: Iterable[str]) -> None:
		merged = self.pending_paths() | set(rel_paths)
		write_atomic(self.changed_paths_path, "".join(p + "\n" for p in sorted(merged)))

	def clear_pending_paths(self, done: Iterable[str]) -> None:
		left = self.pending_paths() - set(done)
		if left:
			write_atomic(self.changed_paths_path, "".join(p + "\n" for p in sorted(left)))
		else:
			self.changed_paths_path.unlink(missing_ok=True)

	# --- unmatched_speakers.jsonl ---

	@property
	def unmatched_path(self) -> Path:
		return self.dir / "unmatched_speakers.jsonl"

	def unmatched(self) -> List[dict]:
		if not self.unmatched_path.exists():
			return []
		with open(self.unmatched_path, encoding="utf-8") as f:
			return [json.loads(l) for l in f if l.strip()]

	def record_unmatched(self, entries: List[dict], replacing_issues: Iterable[str] = ()) -> List[dict]:
		"""Merge entries in, keyed by (speaker, yomi, group, issueID).

		Entries for `replacing_issues` are dropped first, so re-routing an issue
		clears speakers that now resolve. Returns entries that weren't there before.
		"""
		key = lambda e: (e["speaker"], e.get("speakerYomi"), e.get("speakerGroup"), e["issueID"])
		replacing = set(replacing_issues)
		before = self.unmatched()
		seen_before = {key(e) for e in before}
		kept = [e for e in before if e["issueID"] not in replacing]
		kept_keys = {key(e) for e in kept}
		for e in entries:
			if key(e) not in kept_keys:
				kept.append(e)
				kept_keys.add(key(e))
		write_atomic(self.unmatched_path, "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in kept))
		return [e for e in entries if key(e) not in seen_before]
