"""Fetch, resize and record one portrait per person; resumable through index.json.

Output under s3_mirror/kokkai-doc/person_images/:
  {person_id}.jpg   JPEG, longest side ≤ 512 px
  index.json        {"generated_at", "persons": {person_id: record}}, where a record is
                    {"file", "source", "source_url", "image_url", "license", "attribution",
                     "credit", "width", "height", "fetched_at", ...} or {"status": "none",
                     "checked_at"} when no source had a picture.
"""
from __future__ import annotations

import io
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional

from .sources import Fetcher, ImageHit, NotFound, SourceError, house_photo, wikimedia_photo

log = logging.getLogger("person_images.job")
MAX_SIDE = 512
JPEG_QUALITY = 85


@dataclass
class Person:
	person_id: int
	name_kanji: str
	name_kana: Optional[str]
	member_link: Optional[str] = None   # current member's House profile page


def now_iso() -> str:
	return datetime.now().astimezone().isoformat(timespec="seconds")


class Index:
	def __init__(self, path: Path):
		self.path = path
		self.data = {"generated_at": None, "persons": {}}
		if path.exists():
			self.data = json.loads(path.read_text(encoding="utf-8"))
		self.dirty: List[str] = []   # mirror-relative paths changed since the last upload

	def get(self, person_id: int) -> Optional[dict]:
		return self.data["persons"].get(str(person_id))

	def set(self, person_id: int, record: dict) -> None:
		self.data["persons"][str(person_id)] = record

	def save(self) -> None:
		self.data["generated_at"] = now_iso()
		tmp = self.path.with_suffix(".json.tmp")
		tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")
		os.replace(tmp, self.path)

	def counts(self) -> Dict[str, int]:
		out: Dict[str, int] = {}
		for r in self.data["persons"].values():
			k = r.get("source") or r.get("status", "?")
			out[k] = out.get(k, 0) + 1
		return out


def to_jpeg(raw: bytes) -> tuple:
	"""(jpeg bytes, width, height) with the longest side at most MAX_SIDE."""
	from PIL import Image, ImageOps

	im = Image.open(io.BytesIO(raw))
	im = ImageOps.exif_transpose(im)
	if im.mode not in ("RGB", "L"):
		im = im.convert("RGB")
	im.thumbnail((MAX_SIDE, MAX_SIDE))
	out = io.BytesIO()
	im.convert("RGB").save(out, "JPEG", quality=JPEG_QUALITY, optimize=True)
	return out.getvalue(), im.width, im.height


def record_for(hit: ImageHit, file_name: str, width: int, height: int) -> dict:
	rec = {"file": file_name, "source": hit.source, "source_url": hit.source_url, "image_url": hit.image_url,
		"license": hit.license, "attribution": hit.attribution, "credit": hit.credit, "width": width, "height": height,
		"fetched_at": now_iso()}
	rec.update({k: v for k, v in hit.extra.items() if v})
	return rec


def candidates(f: Fetcher, p: Person) -> Iterable[ImageHit]:
	hit = house_photo(p.member_link)
	if hit:
		yield hit
	hit = wikimedia_photo(f, p.name_kanji)
	if hit:
		yield hit


def fetch_one(f: Fetcher, p: Person, out_dir: Path) -> dict:
	"""Try each source in order; the first that downloads and decodes wins."""
	errors = []
	for hit in candidates(f, p):
		try:
			raw = f.get(hit.image_url, timeout=120).content
			jpeg, w, h = to_jpeg(raw)
		except NotFound:
			errors.append(f"{hit.source}: not found")
			continue
		except (SourceError, OSError, ValueError) as e:
			errors.append(f"{hit.source}: {type(e).__name__}: {str(e)[:120]}")
			log.warning("person %s (%s) %s image failed: %s", p.person_id, p.name_kanji, hit.source, e)
			continue
		name = f"{p.person_id}.jpg"
		(out_dir / name).write_bytes(jpeg)
		return record_for(hit, name, w, h)
	rec = {"status": "none", "checked_at": now_iso()}
	if errors:
		rec["errors"] = errors
	return rec


def run(persons: List[Person], out_dir: Path, index: Index, refresh: bool = False, limit: Optional[int] = None,
		fetcher: Optional[Fetcher] = None, on_progress: Optional[Callable[[int, int, dict], None]] = None,
		save_every: int = 25) -> Dict[str, int]:
	"""Fetch portraits for persons not yet in the index (or all with refresh). Returns counts by outcome."""
	f = fetcher or Fetcher()
	out_dir.mkdir(parents=True, exist_ok=True)
	todo = [p for p in persons if refresh or index.get(p.person_id) is None]
	if limit is not None:
		todo = todo[:limit]
	stats: Dict[str, int] = {"done": 0, "found": 0, "none": 0}
	for i, p in enumerate(todo, 1):
		rec = fetch_one(f, p, out_dir)
		# a fresh "none" must not throw away a picture fetched earlier
		if rec.get("status") == "none" and (index.get(p.person_id) or {}).get("file"):
			rec = index.get(p.person_id)
		index.set(p.person_id, rec)
		if rec.get("file"):
			index.dirty.append(f"person_images/{rec['file']}")
			stats["found"] += 1
		else:
			stats["none"] += 1
		stats["done"] += 1
		if on_progress:
			on_progress(i, len(todo), rec)
		if i % save_every == 0:
			index.save()
	index.save()
	return stats
