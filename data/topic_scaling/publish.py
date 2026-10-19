"""Publish stage: write ideology.json.gz (v2), keep a dated copy, upload (spec §4.7)."""
from __future__ import annotations

import gzip
import json
import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .config import Config

log = logging.getLogger("topic_scaling.publish")

LIVE_NAME = "ideology.json.gz"


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
