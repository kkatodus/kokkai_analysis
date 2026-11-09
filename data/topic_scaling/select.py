"""Select stage: window filter + opinion gate per (politician, topic) (spec §4.3).

For each topic with a window and each politician with a {Topic}.jsonl:
  1. keep speeches whose meta.date is inside the window;
  2. split them into sentences containing a search word and keep the ones the
     jp-speech-classifier labels 意見文 (cached per speechID + search-word hash);
  3. gate on min_opinions;
  4. opinion_hash = sha1 of the sorted speechIDs that contributed opinions, which is the
     change key for summarize/embed.

`--estimate` skips the classifier and counts search-word sentences instead (an upper
bound on opinions, as in ensemble_scaling/a1_volume_gate.py) — fast, for sizing a backfill.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Tuple

from .config import Config, Topic
from .state import State, read_json, write_atomic

log = logging.getLogger("topic_scaling.select")

CLASSIFIER = "kkatodus/jp-speech-classifier"
TARGET_CLASS = "意見文"
SENTENCE_SPLIT = re.compile(r"。")


def words_hash(search_words: Iterable[str]) -> str:
	return hashlib.sha1("\n".join(sorted(search_words)).encode("utf-8")).hexdigest()[:12]


def candidate_sentences(text: str, search_words: List[str]) -> List[str]:
	out = []
	for seg in SENTENCE_SPLIT.split(text or ""):
		seg = seg.strip()
		if seg and any(w in seg for w in search_words):
			out.append(seg)
	return out


def sanitize(sentence: str, speaker: Optional[str]) -> str:
	"""Strip the ○name prefix and the speaker's own name (same as create_idea_summaries)."""
	text = sentence.strip()
	text = re.sub(r"^○[^　\s]+(?:委員|大臣|国務大臣|議員|君)?[　\s]*", "", text)
	if speaker:
		for v in {speaker, speaker.replace(" ", ""), re.sub(r"[\s　君]", "", speaker)}:
			if v:
				text = text.replace(v, "")
	return re.sub(r"\s+", " ", text).strip()


class OpinionClassifier:
	"""BERT sentence classifier; loaded lazily so `--estimate` never imports torch."""

	def __init__(self, model_name: str = CLASSIFIER, batch_size: int = 64):
		import torch
		from transformers import AutoTokenizer, BertForSequenceClassification
		self.torch = torch
		self.device = "mps" if torch.backends.mps.is_available() else "cpu"
		self.tokenizer = AutoTokenizer.from_pretrained(model_name)
		self.model = BertForSequenceClassification.from_pretrained(model_name).to(self.device).eval()
		self.batch_size = batch_size
		self.name = model_name

	def opinions(self, sentences: List[str]) -> List[bool]:
		flags: List[bool] = []
		for i in range(0, len(sentences), self.batch_size):
			batch = sentences[i:i + self.batch_size]
			enc = self.tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=512).to(self.device)
			with self.torch.no_grad():
				pred = self.model(**enc).logits.argmax(dim=1).tolist()
			flags.extend(self.model.config.id2label[p] == TARGET_CLASS for p in pred)
		return flags


class LazyClassifier:
	"""Loads the BERT model on first use, so a fully cached run never touches torch."""

	def __init__(self, model_name: str = CLASSIFIER):
		self.name = model_name
		self._clf: Optional[OpinionClassifier] = None

	def opinions(self, sentences: List[str]) -> List[bool]:
		if self._clf is None:
			self._clf = OpinionClassifier(self.name)
		return self._clf.opinions(sentences)


# --- opinion cache: one line per speech {speechID, words, opinions:[...]} ---

def load_cache(path: Path) -> Dict[str, dict]:
	if not path.exists():
		return {}
	out = {}
	with open(path, encoding="utf-8") as f:
		for line in f:
			if line.strip():
				d = json.loads(line)
				out[d["speechID"]] = d
	return out


def save_cache(path: Path, cache: Dict[str, dict]) -> None:
	write_atomic(path, "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in cache.values()))


# --- reading topic files ---

def iter_topic_speeches(path: Path) -> Iterator[dict]:
	with open(path, encoding="utf-8") as f:
		for line in f:
			if line.strip():
				yield json.loads(line)


def person_dirs(persons_dir: Path, limit: Optional[int] = None) -> List[str]:
	ids = [d for d in os.listdir(persons_dir) if d.isdigit() and (persons_dir / d).is_dir()]
	ids.sort(key=int)
	return ids[:limit] if limit else ids


@dataclass
class Pair:
	person_id: str
	topic_en: str
	speaker: str
	n_speeches: int          # in-window speeches
	n_opinions: int
	opinion_hash: str
	last_speech: Optional[str]
	first_speech: Optional[str]
	opinions: List[str] = field(default_factory=list)   # kept in memory for summarize

	def record(self) -> dict:
		return {k: v for k, v in self.__dict__.items() if k != "opinions"}


def select_pair(topic: Topic, person_id: str, path: Path, state: State, classifier,
		estimate: bool) -> Optional[Pair]:
	wh = words_hash(topic.search_words)
	in_window = [s for s in iter_topic_speeches(path) if topic.in_window((s.get("meta") or {}).get("date") or s.get("date") or "")]
	if not in_window:
		return None
	speaker = in_window[0].get("speaker") or ""
	cache_path = state.opinions_cache_path(person_id, topic.name_en)
	cache = load_cache(cache_path) if not estimate else {}
	dirty = False
	to_classify: List[Tuple[str, List[str]]] = []
	per_speech: Dict[str, List[str]] = {}
	for s in in_window:
		sid = s.get("speechID")
		if not sid:
			continue
		cached = cache.get(sid)
		if cached and cached.get("words") == wh and cached.get("model") == (classifier.name if classifier else cached.get("model")):
			per_speech[sid] = cached["opinions"]
			continue
		cands = candidate_sentences(s.get("speech") or "", topic.search_words)
		if estimate:
			per_speech[sid] = cands
		elif cands:
			to_classify.append((sid, cands))
		else:
			per_speech[sid] = []
			cache[sid] = {"speechID": sid, "words": wh, "model": classifier.name if classifier else None, "opinions": []}
			dirty = True
	if to_classify:
		assert classifier is not None
		flat = [c for _, cands in to_classify for c in cands]
		flags = classifier.opinions(flat)
		i = 0
		for sid, cands in to_classify:
			kept = [c for c, ok in zip(cands, flags[i:i + len(cands)]) if ok]
			i += len(cands)
			per_speech[sid] = kept
			cache[sid] = {"speechID": sid, "words": wh, "model": classifier.name, "opinions": kept}
			dirty = True
	if dirty:
		save_cache(cache_path, cache)
	contributing = sorted(sid for sid, ops in per_speech.items() if ops)
	opinions = [sanitize(o, speaker) for sid in contributing for o in per_speech[sid]]
	opinions = [o for o in opinions if o]
	dates = sorted(((s.get("meta") or {}).get("date") or "") for s in in_window)
	return Pair(
		person_id=person_id, topic_en=topic.name_en, speaker=speaker, n_speeches=len(in_window),
		n_opinions=len(opinions), opinion_hash=hashlib.sha1("\n".join(contributing).encode()).hexdigest(),
		last_speech=dates[-1] or None, first_speech=dates[0] or None, opinions=opinions,
	)


def summary_hash(state: State, person_id: str, topic_en: str) -> Optional[str]:
	d = read_json(state.summary_path(person_id, topic_en))
	return d.get("opinion_hash") if d else None


def run_select(cfg: Config, state: State, topics: List[Topic], estimate: bool = False,
		only_topics: Optional[List[str]] = None, limit: Optional[int] = None) -> Tuple[dict, Dict[Tuple[str, str], Pair]]:
	"""Returns (selection dict written to select.json, pairs keyed by (person_id, topic_en))."""
	classifier = None if estimate else LazyClassifier()
	ids = person_dirs(cfg.persons_dir, limit)
	selection = {
		"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
		"estimate": estimate, "classifier": None if estimate else CLASSIFIER,
		"persons_scanned": len(ids), "topics": {},
	}
	pairs: Dict[Tuple[str, str], Pair] = {}
	for topic in topics:
		if only_topics and topic.name_en not in only_topics:
			continue
		entry = {"slug": topic.slug, "window": topic.window_dict, "min_opinions": topic.min_opinions,
			"skip_reason": topic.skip_reason, "persons_in_window": 0, "scaled": 0, "below_gate": 0,
			"changed": 0, "pairs": []}
		selection["topics"][topic.name_en] = entry
		if not topic.scalable:
			log.warning("%s skipped: %s", topic.name_en, topic.skip_reason)
			continue
		n = 0
		for pid in ids:
			path = cfg.persons_dir / pid / f"{topic.name_en}.jsonl"
			if not path.exists():
				continue
			pair = select_pair(topic, pid, path, state, classifier, estimate)
			if pair is None:
				continue
			entry["persons_in_window"] += 1
			if pair.n_opinions < topic.min_opinions:
				entry["below_gate"] += 1
				continue
			rec = pair.record()
			rec["changed"] = estimate or summary_hash(state, pid, topic.name_en) != pair.opinion_hash
			entry["changed"] += int(rec["changed"])
			entry["scaled"] += 1
			entry["pairs"].append(rec)
			pairs[(pid, topic.name_en)] = pair
			n += 1
			if n % 200 == 0:
				log.info("%s: %d scaled so far", topic.name_en, n)
		log.info("%s: %d in window, %d scaled, %d below gate, %d changed", topic.name_en,
			entry["persons_in_window"], entry["scaled"], entry["below_gate"], entry["changed"])
	if not estimate:
		state.save_selection(selection)
	return selection, pairs
