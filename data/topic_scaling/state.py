"""Run lock, state files and atomic writes.

Layout (s3_mirror/.topic-scaling/):
  lock                 flock; a second run exits immediately
  last_run.json        summary of the last run
  select.json          output of the select stage (pairs, hashes, gate counts)
  opinions/{person}/{Topic}.jsonl   cached opinion sentences per speech (classifier output)
  summaries/{person}/{Topic}/summary.json + opinions.json
  embeddings/{model}/{Topic}/{person}.npz, refs/{sub}.npz
  volume/{Topic}.json  monthly search-word counts (suggest)
  suggestions/YYYY-MM.md
  batches/             request files while a batch is being submitted
  logs/
"""
from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
from typing import Any, Optional


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


def write_json(path: Path, obj: Any) -> None:
	write_atomic(path, json.dumps(obj, ensure_ascii=False, indent=1) + "\n")


def read_json(path: Path, default: Any = None) -> Any:
	if not path.exists():
		return default
	with open(path, encoding="utf-8") as f:
		return json.load(f)


class State:
	def __init__(self, state_dir: Path):
		self.dir = state_dir
		self.logs_dir = state_dir / "logs"
		self.opinions_dir = state_dir / "opinions"
		self.summaries_dir = state_dir / "summaries"
		self.embeddings_dir = state_dir / "embeddings"
		self.volume_dir = state_dir / "volume"
		self.suggestions_dir = state_dir / "suggestions"
		self.batches_dir = state_dir / "batches"
		for d in (self.logs_dir, self.opinions_dir, self.summaries_dir, self.embeddings_dir, self.volume_dir,
				self.suggestions_dir, self.batches_dir):
			d.mkdir(parents=True, exist_ok=True)
		self._lock_file = None

	# --- lock ---

	def acquire_lock(self) -> None:
		f = open(self.dir / "lock", "a+")
		try:
			fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
		except BlockingIOError:
			f.close()
			raise LockHeld(f"another topic scaling run is active (lock: {self.dir / 'lock'})")
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

	# --- json state files ---

	@property
	def select_path(self) -> Path:
		return self.dir / "select.json"

	def selection(self) -> Optional[dict]:
		return read_json(self.select_path)

	def save_selection(self, sel: dict) -> None:
		write_json(self.select_path, sel)

	@property
	def last_run_path(self) -> Path:
		return self.dir / "last_run.json"

	def last_run(self) -> Optional[dict]:
		return read_json(self.last_run_path)

	def save_last_run(self, summary: dict) -> None:
		write_json(self.last_run_path, summary)

	# --- per-pair paths ---

	def summary_path(self, person_id: str, topic_en: str) -> Path:
		return self.summaries_dir / str(person_id) / topic_en / "summary.json"

	def opinions_cache_path(self, person_id: str, topic_en: str) -> Path:
		return self.opinions_dir / str(person_id) / f"{topic_en}.jsonl"
