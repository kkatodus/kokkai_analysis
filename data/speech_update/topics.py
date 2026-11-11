"""Publish the topic list (name + search_words) to topics/topics.json so the site can
highlight the words that filed a speech under a topic (specs/topic-keyword-highlight §4)."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .state import write_atomic

log = logging.getLogger(__name__)

TOPICS_REL_PATH = "topics/topics.json"
PUBLISHED_FIELDS = ("topic_name_en", "topic_name", "search_words")


def build_topics(topics: List[dict]) -> dict:
	"""Only the three public fields, in config order (no prompts or references)."""
	return {
		"version": 1,
		"generated_at": datetime.now().isoformat(timespec="seconds"),
		"topics": [{k: t[k] for k in PUBLISHED_FIELDS} for t in topics],
	}


def _comparable(doc: Optional[dict]) -> Optional[dict]:
	if doc is None:
		return None
	return {k: v for k, v in doc.items() if k != "generated_at"}


def write_topics_if_changed(mirror_root: Path, topics: List[dict]) -> Optional[str]:
	"""Write topics.json when its content (ignoring generated_at) changed.
	Returns the mirror-relative path when written, else None."""
	path = mirror_root / TOPICS_REL_PATH
	doc = build_topics(topics)
	existing = None
	if path.exists():
		try:
			existing = json.loads(path.read_text(encoding="utf-8"))
		except ValueError:
			log.warning("%s is not valid JSON; rewriting it", path)
	if _comparable(existing) == _comparable(doc):
		return None
	write_atomic(path, json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
	log.info("topics.json updated (%d topics)", len(doc["topics"]))
	return TOPICS_REL_PATH
