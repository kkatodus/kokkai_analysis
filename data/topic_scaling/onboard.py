"""Onboard a topic the user added to experiment_config.json (spec §4.9 F).

  python -m topic_scaling onboard <TopicNameEn>            backfill {Topic}.jsonl for every politician
  python -m topic_scaling onboard <TopicNameEn> --refresh  rebuild the files (search words changed)
  python -m topic_scaling onboard <TopicNameEn> --axes     generate axes + reference speeches from its summaries

The nightly speech updater routes new speeches to the topic file from then on because it
reads the same config. Scaling needs summaries first (next `all` run), then `--axes`.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple

from .config import Config, Topic
from .state import write_atomic

log = logging.getLogger("topic_scaling.onboard")


def matches(text: str, search_words: List[str]) -> bool:
	return any(w in text for w in search_words)


def backfill_topic_files(cfg: Config, topic: Topic, refresh: bool = False, limit: Optional[int] = None) -> Tuple[int, int, List[str]]:
	"""Scan all_speeches.jsonl per person; write {Topic}.jsonl where any speech matches.
	Returns (persons scanned, files written, mirror-relative paths written)."""
	ids = sorted((d for d in os.listdir(cfg.persons_dir) if d.isdigit()), key=int)
	if limit:
		ids = ids[:limit]
	written: List[str] = []
	for n, pid in enumerate(ids, 1):
		src = cfg.persons_dir / pid / "all_speeches.jsonl"
		dst = cfg.persons_dir / pid / f"{topic.name_en}.jsonl"
		if not src.exists() or (dst.exists() and not refresh):
			continue
		keep = []
		with open(src, encoding="utf-8") as f:
			for line in f:
				if not line.strip():
					continue
				if matches(json.loads(line).get("speech") or "", topic.search_words):
					keep.append(line if line.endswith("\n") else line + "\n")
		if keep:
			write_atomic(dst, "".join(keep))
			written.append(f"repr_speeches_id_organized/{pid}/{topic.name_en}.jsonl")
		elif dst.exists() and refresh:
			dst.unlink()
		if n % 500 == 0:
			log.info("onboard %s: %d/%d persons, %d files", topic.name_en, n, len(ids), len(written))
	return len(ids), len(written), written
