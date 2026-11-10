"""Embed stage: one vector per (politician, topic) and two reference vectors per sub-topic (spec §4.5).

Cache: state/embeddings/{model}/{Topic}/{person}.npz (embedding, opinion_hash) and
       state/embeddings/{model}/{Topic}/refs/{sub}.npz (pro, con, examples_hash).
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .config import Config, SubTopic, Topic
from .state import State, read_json

log = logging.getLogger("topic_scaling.embed")


MAX_SEQ_LENGTH = 2048   # summaries are ~500–1500 chars; caps attention memory on MPS


class Embedder:
	def __init__(self, model_name: str, batch_size: int = 8, max_seq_length: int = MAX_SEQ_LENGTH):
		import torch
		from sentence_transformers import SentenceTransformer
		self.torch = torch
		device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
		# fp16 on Apple silicon: half the memory, roughly twice the throughput of fp32
		dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
		log.info("loading %s on %s (%s)", model_name, device, str(dtype).replace("torch.", ""))
		self.st = SentenceTransformer(model_name, device=device, trust_remote_code=True, model_kwargs={"torch_dtype": dtype})
		self.st.max_seq_length = min(max_seq_length, self.st.max_seq_length or max_seq_length)
		self.batch_size = batch_size
		self.name = model_name

	def _encode(self, texts: List[str], batch_size: int) -> np.ndarray:
		return self.st.encode(texts, batch_size=batch_size, convert_to_numpy=True, show_progress_bar=False,
			normalize_embeddings=False).astype(np.float32)

	def encode(self, texts: List[str]) -> np.ndarray:
		"""Encode in batches; on an MPS/CUDA out-of-memory, free the cache and retry one text at a time."""
		try:
			return self._encode(texts, self.batch_size)
		except RuntimeError as e:
			if "out of memory" not in str(e).lower():
				raise
			log.warning("embedding batch of %d hit OOM; retrying one at a time", len(texts))
			self._empty_cache()
			return np.vstack([self._encode([t], 1) for t in texts])

	def _empty_cache(self) -> None:
		t = self.torch
		if t.backends.mps.is_available():
			t.mps.empty_cache()
		elif t.cuda.is_available():
			t.cuda.empty_cache()

	def mean(self, texts: List[str]) -> np.ndarray:
		return self.encode(texts).mean(axis=0)


def _cache_dir(cfg: Config, state: State, topic: Topic) -> Path:
	d = state.embeddings_dir / cfg.embed_slug / topic.name_en
	d.mkdir(parents=True, exist_ok=True)
	return d


def person_vector(cfg: Config, state: State, topic: Topic, person_id: str, embedder: Optional[Embedder]) -> Optional[Tuple[np.ndarray, dict]]:
	"""Embedding for the current summary.json, (re)computed when the cached hash differs.
	Returns None when there is no summary yet or no embedder to compute it."""
	summary = read_json(state.summary_path(person_id, topic.name_en))
	if not summary or not summary.get("summaries"):
		return None
	path = _cache_dir(cfg, state, topic) / f"{person_id}.npz"
	if path.exists():
		z = np.load(path, allow_pickle=False)
		if str(z["opinion_hash"]) == summary["opinion_hash"]:
			return z["embedding"], summary
	if embedder is None:
		return None
	vec = embedder.mean(summary["summaries"])
	tmp = path.with_suffix(".tmp.npz")
	np.savez(tmp, embedding=vec, opinion_hash=np.array(summary["opinion_hash"]))
	tmp.replace(path)
	return vec, summary


def reference_vectors(cfg: Config, state: State, sub: SubTopic, embedder: Optional[Embedder]) -> Optional[Tuple[np.ndarray, np.ndarray]]:
	ex_hash = hashlib.sha1(sub.examples_path.read_bytes()).hexdigest()
	d = _cache_dir(cfg, state, sub.topic) / "refs"
	d.mkdir(exist_ok=True)
	path = d / f"{sub.slug}.npz"
	if path.exists():
		z = np.load(path, allow_pickle=False)
		if str(z["examples_hash"]) == ex_hash:
			return z["pro"], z["con"]
	if embedder is None:
		return None
	ex = sub.examples()
	pro, con = embedder.mean(ex["pro"]), embedder.mean(ex["con"])
	tmp = path.with_suffix(".tmp.npz")
	np.savez(tmp, pro=pro, con=con, examples_hash=np.array(ex_hash))
	tmp.replace(path)
	return pro, con


def run_embed(cfg: Config, state: State, topics: List[Topic], axes: Dict[str, List[SubTopic]],
		selection: dict, only_topics: Optional[List[str]] = None) -> Dict[str, int]:
	"""Embed every scaled pair in `selection` that has a summary, plus the reference speeches."""
	embedder: Optional[Embedder] = None
	counts: Dict[str, int] = {}
	for topic in topics:
		if not topic.scalable or (only_topics and topic.name_en not in only_topics):
			continue
		entry = selection["topics"].get(topic.name_en) or {}
		n = 0
		for rec in entry.get("pairs") or []:
			pid = str(rec["person_id"])
			summary = read_json(state.summary_path(pid, topic.name_en))
			if not summary:
				continue
			cached = _cache_dir(cfg, state, topic) / f"{pid}.npz"
			if cached.exists() and str(np.load(cached, allow_pickle=False)["opinion_hash"]) == summary.get("opinion_hash"):
				continue
			if embedder is None:
				embedder = Embedder(cfg.embed_model)
			person_vector(cfg, state, topic, pid, embedder)
			n += 1
		for sub in axes.get(topic.name_en, []):
			if reference_vectors(cfg, state, sub, None) is None:
				if embedder is None:
					embedder = Embedder(cfg.embed_model)
				reference_vectors(cfg, state, sub, embedder)
		counts[topic.name_en] = n
		log.info("%s: %d new embedding(s)", topic.name_en, n)
	return counts
