"""Publish stage: write ideology.json.gz (v2), keep a dated copy, upload (spec §4.7).

Also writes the per-person stance files ideology/persons/{person_id}.json from the same selection and
summary set (specs/stance-summaries-panel §4), so the detail pane's 立場 tab never drifts from the plot."""
from __future__ import annotations

import gzip
import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .config import Config, Topic
from .state import State, read_json

log = logging.getLogger("topic_scaling.publish")

LIVE_NAME = "ideology.json.gz"
PERSONS_DIR = "persons"
PERSON_FILE_VERSION = 1


def build_document(cfg: Config, topic_blocks: List[dict], members_as_of: Optional[str]) -> dict:
	return {
		"version": 2,
		"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
		"embed_model": cfg.embed_model,
		"summary_model": cfg.summary_model,
		"current_members_as_of": members_as_of,
		"data": topic_blocks,
	}


def write_document(cfg: Config, doc: dict, history: bool = True) -> List[str]:
	"""Writes the live file and a dated copy; returns mirror-relative paths written."""
	cfg.ideology_dir.mkdir(parents=True, exist_ok=True)
	live = cfg.ideology_dir / LIVE_NAME
	tmp = live.with_name(LIVE_NAME + ".tmp")
	with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=9) as f:
		json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
	os.replace(tmp, live)
	written = [f"ideology/{LIVE_NAME}"]
	if history:
		hist_dir = cfg.ideology_dir / "history"
		hist_dir.mkdir(exist_ok=True)
		stamp = datetime.now().strftime("%Y-%m-%d")
		hist = hist_dir / f"ideology-{stamp}.json.gz"
		shutil.copyfile(live, hist)
		written.append(f"ideology/history/{hist.name}")
	log.info("wrote %s (%.1f MB)", live, live.stat().st_size / 1e6)
	return written


def upload(cfg: Config, rel_paths: List[str]) -> int:
	from speech_update.upload import Uploader
	log.info("uploading %d file(s) to s3://%s/%s/ (profile %s)", len(rel_paths), cfg.bucket, cfg.s3_prefix, cfg.aws_profile)
	return Uploader(cfg.mirror_root, cfg.bucket, cfg.s3_prefix, cfg.aws_profile).upload(rel_paths, on_done=lambda done: None)


def read_live(cfg: Config) -> Optional[dict]:
	live = cfg.ideology_dir / LIVE_NAME
	if not live.exists():
		return None
	with gzip.open(live, "rt", encoding="utf-8") as f:
		return json.load(f)


# --- per-person stance files (specs/stance-summaries-panel §4) ---

@dataclass
class PersonFiles:
	persons: int = 0                  # files built (one per person with at least one publishable topic)
	changed: List[str] = field(default_factory=list)   # mirror-relative paths whose bytes changed
	no_provenance: int = 0            # pairs published without speech_ids (cache can't reproduce the hash)
	stale: int = 0                    # pairs skipped: summary.json older than the selection
	missing: int = 0                  # pairs skipped: no summary.json
	dry_run: bool = False

	def line(self) -> str:
		verb = "would change" if self.dry_run else "changed"
		return (f"Person files: {self.persons:,} built, {len(self.changed):,} {verb}, "
			f"{self.no_provenance} without provenance, {self.stale} stale summaries"
			+ (f", {self.missing} missing summaries" if self.missing else ""))


def plotted_pairs(doc: dict) -> Dict[str, set]:
	"""topic_en -> person_ids (as str) that appear in at least one sub-topic's 1d data."""
	out: Dict[str, set] = {}
	for block in doc.get("data") or []:
		ids = out.setdefault(block["topic_en"], set())
		for sub in block.get("sub_topics") or []:
			for p in (sub.get("1d") or {}).get("data") or []:
				if p.get("person_id") is not None:
					ids.add(str(p["person_id"]))
	return out


def person_topic_entry(cfg: Config, state: State, topic: Topic, pid: str, rec: dict, pf: PersonFiles) -> Optional[dict]:
	from .select import contributing_speech_ids
	summary = read_json(state.summary_path(pid, topic.name_en))
	if not summary:
		pf.missing += 1
		return None
	if summary.get("opinion_hash") != rec.get("opinion_hash"):
		pf.stale += 1
		return None
	entry = {
		"topic": topic.slug, "topic_en": topic.name_en, "topic_jp": topic.name_jp, "window": topic.window_dict,
		"n_speeches": rec.get("n_speeches"), "n_opinions": rec.get("n_opinions"),
		"first_speech": rec.get("first_speech"), "last_speech": rec.get("last_speech"),
		"model": summary.get("model"), "prompt_version": summary.get("prompt_version"),
		"summarised_at": summary.get("generated_at"),
		"summaries": list(summary.get("summaries") or []),
	}
	ids = contributing_speech_ids(topic, pid, cfg.persons_dir / pid / f"{topic.name_en}.jsonl", state)
	if ids and ids[1] == rec.get("opinion_hash"):
		entry["speech_ids"] = ids[0]
	else:
		pf.no_provenance += 1
	return entry


def write_person_files(cfg: Config, state: State, doc: dict, topics: List[Topic], dry_run: bool = False) -> PersonFiles:
	"""Builds ideology/persons/{pid}.json for every plotted person; writes (unless dry_run) only files whose
	bytes changed and returns them in .changed for the uploader. Never deletes orphans: nothing links to them,
	and the frontend shows a topic only when the person is in the loaded ideology data for it."""
	pf = PersonFiles(dry_run=dry_run)
	plotted = plotted_pairs(doc)
	sel = state.selection() or {}
	by_person: Dict[str, List[Tuple[int, dict]]] = {}
	for order, topic in enumerate(topics):
		pids = plotted.get(topic.name_en)
		if not pids:
			continue
		recs = {str(r["person_id"]): r for r in ((sel.get("topics") or {}).get(topic.name_en) or {}).get("pairs") or []}
		for pid in sorted(pids, key=int):
			rec = recs.get(pid)
			if rec is None:
				pf.missing += 1
				continue
			entry = person_topic_entry(cfg, state, topic, pid, rec, pf)
			if entry:
				by_person.setdefault(pid, []).append((order, entry))
	out_dir = cfg.ideology_dir / PERSONS_DIR
	if not dry_run:
		out_dir.mkdir(parents=True, exist_ok=True)
	for pid in sorted(by_person, key=int):
		body = {
			"version": PERSON_FILE_VERSION, "person_id": int(pid),
			"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
			"ideology_generated_at": doc.get("generated_at"),
			"topics": [e for _, e in sorted(by_person[pid], key=lambda t: t[0])],
		}
		pf.persons += 1
		path = out_dir / f"{pid}.json"
		if path.exists() and _same_content(path, body):
			continue
		pf.changed.append(f"ideology/{PERSONS_DIR}/{pid}.json")
		if not dry_run:
			tmp = path.with_name(path.name + ".tmp")
			tmp.write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
			os.replace(tmp, path)
	log.info(pf.line())
	return pf


def _same_content(path: Path, body: dict) -> bool:
	"""True when the existing file matches body apart from its timestamps, so a monthly run that changed
	nothing uploads nothing (the stamps alone would otherwise rewrite all ~2,000 files)."""
	try:
		old = json.loads(path.read_text(encoding="utf-8"))
	except (OSError, ValueError):
		return False
	strip = lambda d: {k: v for k, v in d.items() if k not in ("generated_at", "ideology_generated_at")}
	return strip(old) == strip(body)
