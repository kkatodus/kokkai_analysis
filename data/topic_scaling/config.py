"""Paths, settings, topics (with windows) and sub-topic axes.

Every path/setting can be overridden with an environment variable (TOPIC_SCALING_*).
Topics come from data/resource/experiment_config.json; each needs `slug`, `window.from`
and (optionally) `scaling.enabled` / `scaling.min_opinions`. Sub-topic axes come from
data/axis/{topic_jp}/{topic_jp}_axis.json (`slug`, `topic`, `pro`, `con`) with the generated
reference speeches in examples/{topic}_example_speeches.json.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

SLUG_RE = re.compile(r"^[a-z0-9]+$")


@dataclass(frozen=True)
class Config:
	mirror_root: Path          # s3_mirror/kokkai-doc
	state_dir: Path            # s3_mirror/.topic-scaling
	env_file: Path             # data/.env
	topics_file: Path          # data/resource/experiment_config.json
	axis_dir: Path             # data/axis
	bucket: str
	s3_prefix: str
	aws_profile: str
	embed_model: str
	summary_model: str
	summary_runs: int
	summary_prompt_version: str
	cap: float                 # shared monthly cap (USD) with the quality labels
	reserve: float             # kept free for the nightly label job
	batch_size: int            # requests per Gemini batch
	max_batches: int           # batches submitted per run
	min_opinions: int          # default gate, overridable per topic
	umap_neighbors: int
	seed: int

	@property
	def persons_dir(self) -> Path:
		return self.mirror_root / "repr_speeches_id_organized"

	@property
	def issues_dir(self) -> Path:
		return self.mirror_root / "issues"

	@property
	def members_dir(self) -> Path:
		return self.mirror_root / "parliamentMembers"

	@property
	def ideology_dir(self) -> Path:
		return self.mirror_root / "ideology"

	@property
	def embed_slug(self) -> str:
		return re.sub(r"[^A-Za-z0-9.-]+", "_", self.embed_model)


def load_config() -> Config:
	env = os.environ.get
	mirror_root = Path(env("TOPIC_SCALING_MIRROR", REPO_ROOT / "s3_mirror" / "kokkai-doc"))
	return Config(
		mirror_root=mirror_root,
		state_dir=Path(env("TOPIC_SCALING_STATE_DIR", mirror_root.parent / ".topic-scaling")),
		env_file=Path(env("TOPIC_SCALING_ENV_FILE", DATA_DIR / ".env")),
		topics_file=Path(env("TOPIC_SCALING_TOPICS_FILE", DATA_DIR / "resource" / "experiment_config.json")),
		axis_dir=Path(env("TOPIC_SCALING_AXIS_DIR", DATA_DIR / "axis")),
		bucket=env("SPEECH_UPDATE_BUCKET", "kokkai-doc-bucket-dev"),
		s3_prefix=env("SPEECH_UPDATE_S3_PREFIX", "kokkai-doc"),
		aws_profile=env("SPEECH_UPDATE_AWS_PROFILE", "kokkai-speech-update"),
		embed_model=env("TOPIC_SCALING_EMBED_MODEL", "sbintuitions/sarashina-embedding-v2-1b"),
		summary_model=env("TOPIC_SCALING_SUMMARY_MODEL", "gemini-3.5-flash-lite"),
		summary_runs=int(env("TOPIC_SCALING_SUMMARY_RUNS", "3")),
		summary_prompt_version=env("TOPIC_SCALING_SUMMARY_PROMPT_VERSION", "s1"),
		cap=float(env("SPEECH_LABEL_MONTHLY_CAP_USD", "100")),
		reserve=float(env("TOPIC_SCALING_RESERVE_USD", env("SPEECH_LABEL_RESERVE_USD", "5"))),
		batch_size=int(env("TOPIC_SCALING_BATCH_SIZE", "600")),
		max_batches=int(env("TOPIC_SCALING_MAX_BATCHES", "20")),
		min_opinions=int(env("TOPIC_SCALING_MIN_OPINIONS", "3")),
		umap_neighbors=int(env("TOPIC_SCALING_UMAP_NEIGHBORS", "30")),
		seed=int(env("TOPIC_SCALING_SEED", "42")),
	)


# --- topics ---

@dataclass(frozen=True)
class Topic:
	topic_id: int
	name_jp: str
	name_en: str
	slug: str
	search_words: List[str]
	window_from: Optional[date]
	window_to: Optional[date]
	enabled: bool
	min_opinions: int
	skip_reason: Optional[str] = None   # set when the topic can't be scaled

	@property
	def scalable(self) -> bool:
		return self.skip_reason is None

	def in_window(self, day: str) -> bool:
		"""`day` is an ISO date string from meta.date; bad dates are excluded."""
		if not day or len(day) < 10 or self.window_from is None:
			return False
		try:
			d = date.fromisoformat(day[:10])
		except ValueError:
			return False
		if d < self.window_from:
			return False
		return self.window_to is None or d <= self.window_to

	@property
	def window_dict(self) -> dict:
		return {
			"from": self.window_from.isoformat() if self.window_from else None,
			"to": self.window_to.isoformat() if self.window_to else None,
		}


def _parse_date(value) -> Optional[date]:
	if value in (None, ""):
		return None
	return date.fromisoformat(str(value)[:10])


def load_topics(path: Path, default_min_opinions: int = 3) -> List[Topic]:
	with open(path, encoding="utf-8") as f:
		raw = json.load(f)
	topics: List[Topic] = []
	seen = set()
	for t in raw:
		window = t.get("window") or {}
		scaling = t.get("scaling") or {}
		slug = t.get("slug") or ""
		reason = None
		if not slug or not SLUG_RE.match(slug):
			reason = "no slug"
		elif slug in seen:
			reason = f"duplicate slug {slug}"
		elif not window.get("from"):
			reason = "no window"
		elif not scaling.get("enabled", True):
			reason = "scaling disabled"
		seen.add(slug)
		topics.append(Topic(
			topic_id=int(t["topic_id"]),
			name_jp=t["topic_name"],
			name_en=t["topic_name_en"],
			slug=slug,
			search_words=list(t.get("search_words") or []),
			window_from=_parse_date(window.get("from")),
			window_to=_parse_date(window.get("to")),
			enabled=bool(scaling.get("enabled", True)),
			min_opinions=int(scaling.get("min_opinions", default_min_opinions)),
			skip_reason=reason,
		))
	return topics


# --- sub-topic axes ---

@dataclass(frozen=True)
class SubTopic:
	topic: Topic
	slug: str
	name_jp: str
	pro: str
	con: str
	examples_path: Path

	@property
	def key(self) -> str:
		return f"{self.topic.slug}/{self.slug}"

	def examples(self) -> dict:
		"""{'pro': [str, …], 'con': [str, …]} generated reference speeches."""
		with open(self.examples_path, encoding="utf-8") as f:
			d = json.load(f)
		out = {}
		for side in ("pro", "con"):
			block = d.get(side) or {}
			texts = block.get("opinions") if isinstance(block, dict) else block
			texts = [t for t in (texts or []) if isinstance(t, str) and t.strip()]
			if not texts:
				raise ValueError(f"{self.examples_path}: no {side} example speeches")
			out[side] = texts
		return out


class AxisError(RuntimeError):
	pass


def load_axes(axis_dir: Path, topic: Topic) -> List[SubTopic]:
	"""Sub-topics for one topic. Raises AxisError when the axis file or a slug/example is missing,
	so a misconfigured topic is loud rather than silently unscaled."""
	topic_dir = axis_dir / topic.name_jp
	axis_path = topic_dir / f"{topic.name_jp}_axis.json"
	if not axis_path.exists():
		raise AxisError(f"{topic.name_en}: no axis file {axis_path}")
	with open(axis_path, encoding="utf-8") as f:
		entries = json.load(f)
	subs: List[SubTopic] = []
	seen = set()
	for e in entries:
		slug = e.get("slug") or ""
		if not SLUG_RE.match(slug):
			raise AxisError(f"{topic.name_en}: axis entry {e.get('topic')!r} has no slug; add one in {axis_path}")
		if slug in seen:
			raise AxisError(f"{topic.name_en}: duplicate sub-topic slug {slug} in {axis_path}")
		seen.add(slug)
		examples_path = topic_dir / "examples" / f"{e['topic']}_example_speeches.json"
		if not examples_path.exists():
			raise AxisError(f"{topic.name_en}/{slug}: missing reference speeches {examples_path}")
		subs.append(SubTopic(topic=topic, slug=slug, name_jp=e["topic"], pro=e.get("pro", ""), con=e.get("con", ""),
			examples_path=examples_path))
	if not subs:
		raise AxisError(f"{topic.name_en}: axis file {axis_path} is empty")
	return subs
