"""Project stage: 1D axis positions and 2D UMAP layouts per sub-topic (spec §4.6).

1D: x = 2 (e - mid) · (pro - con) / |pro - con|², mid = (pro + con)/2 → 0 is the axis midpoint,
    the "against" reference is at -1 and "for" at +1, positive leans "pro".
    y = rank index within the party-sorted list (as the live file).
2D: UMAP over the topic's politician embeddings + the two reference vectors, fitted twice:
    everyone scaled in the window ("2d") and current members only ("2d_current").
Midpoints: data/axis/midpoints.json (hand-labelled, see data/axis/midpoints/README.md) gives where on x stances
    really switch from con to pro. Calibrated sub-topics get axis.midpoint / neutral_from / neutral_to; sub-topics
    found to have no real split (one_sided_pro, unclear) are left out of the file. Sub-topics not in the file yet
    are published without a midpoint.
Keywords: a sub-topic with `keywords` in its axis file only places people whose summaries for the topic contain
    at least one of them, so someone who never talks about e.g. the defence budget is not ranked on that axis.
    x itself does not change (it comes from the person's topic-wide embedding), so the midpoints stay valid.
    People on none of a topic's axes drop out of that topic's plot; their 立場 summary for it is still published.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from .config import Config, SubTopic, Topic
from .embed import person_vector, reference_vectors
from .members import DEFAULT_COLOR, PARTY_COLOR
from .state import State, read_json

log = logging.getLogger("topic_scaling.project")

EMBEDDED_KEY = "_embedded_person_ids"


@lru_cache(maxsize=None)
def load_midpoints(path: Path) -> Dict[str, Dict[str, dict]]:
	"""{topic slug: {sub-topic slug: entry}} from midpoints.json; empty when the file is missing."""
	if not path.exists():
		log.warning("no midpoints file %s; every sub-topic published without a midpoint", path)
		return {}
	with open(path, encoding="utf-8") as f:
		return json.load(f).get("topics") or {}


def axis_block(sub: SubTopic, entry: Optional[dict]) -> dict:
	axis = {"pro": sub.pro, "con": sub.con}
	if entry and entry.get("status") == "calibrated":
		for k in ("midpoint", "neutral_from", "neutral_to", "confidence"):
			axis[k] = entry[k]
	return axis


def summary_text(state: State, topic: Topic, pid: int) -> Optional[str]:
	"""All summary runs for (person, topic) joined; None when there is no summary file."""
	summary = read_json(state.summary_path(str(pid), topic.name_en))
	if not summary:
		return None
	return "\n".join(summary.get("summaries") or [])


def on_axis(sub: SubTopic, text: Optional[str]) -> bool:
	"""Whether a person belongs on this sub-topic's axis. No keywords, or no summary to check, keeps them."""
	if not sub.keywords or text is None:
		return True
	return any(k in text for k in sub.keywords)


def umap_2d(matrix: np.ndarray, n_neighbors: int, seed: int) -> np.ndarray:
	import umap
	n = len(matrix)
	if n < 4:
		return np.zeros((n, 2), dtype=np.float32)
	k = max(2, min(n_neighbors, n - 1))
	return umap.UMAP(n_components=2, n_neighbors=k, random_state=seed, verbose=False).fit_transform(matrix).astype(np.float32)


def _point(meta: dict, pid: int, x: float, y: float, current: bool, extra: dict) -> dict:
	party = meta.get("party") or "無所属"
	return {
		"idx": 0, "x": round(float(x), 4), "y": round(float(y), 4),
		"repr": meta.get("name") or str(pid), "hiragana": meta.get("kana") or "",
		"house": meta.get("house") or "", "party": party, "party_full": meta.get("party_full"),
		"color": PARTY_COLOR.get(party, DEFAULT_COLOR), "ref_point": "none", "person_id": pid,
		"current": current, "n_opinions": extra.get("n_opinions"), "n_speeches": extra.get("n_speeches"),
		"last_speech": extra.get("last_speech"),
	}


def _ref_point(side: str, x: float, y: float) -> dict:
	label = "賛成" if side == "for" else "反対"
	return {"idx": 0, "x": round(float(x), 4), "y": round(float(y), 4), "repr": label, "hiragana": label, "house": "",
		"party": "", "party_full": None, "color": "blue" if side == "for" else "red", "ref_point": side, "person_id": None,
		"current": True, "n_opinions": None, "n_speeches": None, "last_speech": None}


def _renumber(points: List[dict]) -> List[dict]:
	for i, p in enumerate(points):
		p["idx"] = i
	return points


def project_topic(cfg: Config, state: State, topic: Topic, subs: List[SubTopic], pairs: List[dict],
		metas: Dict[int, dict], current_ids: set) -> Optional[dict]:
	"""Returns the topic block for the ideology file, or None when nothing is embedded yet."""
	vectors: List[np.ndarray] = []
	rows: List[Tuple[int, dict]] = []
	for rec in pairs:
		pid = int(rec["person_id"])
		pv = person_vector(cfg, state, topic, str(pid), None)
		if pv is None:
			continue
		vectors.append(pv[0])
		rows.append((pid, rec))
	if not rows:
		return None
	E_all = np.vstack(vectors)
	current_all = np.array([pid in current_ids for pid, _ in rows])
	texts = [summary_text(state, topic, pid) for pid, _ in rows]
	if any(t is None for t in texts):
		log.warning("%s: %d scaled people have no summary file; kept on every axis", topic.name_en, sum(t is None for t in texts))
	midpoints = load_midpoints(cfg.axis_dir / "midpoints.json").get(topic.slug, {})
	sub_blocks = []
	placed = np.zeros(len(rows), dtype=bool)
	for sub in subs:
		entry = midpoints.get(sub.slug)
		if entry and entry.get("status") != "calibrated":
			log.info("%s: %s (no real con/pro split), left out", sub.key, entry.get("status"))
			continue
		refs = reference_vectors(cfg, state, sub, None)
		if refs is None:
			log.warning("%s: no reference vectors yet, skipped", sub.key)
			continue
		keep = np.array([on_axis(sub, t) for t in texts])
		if not keep.any():
			log.warning("%s: nobody's summary mentions its keywords, skipped", sub.key)
			continue
		if not sub.keywords:
			log.warning("%s: no keywords in the axis file; everyone in %s is placed on it", sub.key, topic.name_en)
		log.info("%s: %d of %d on the axis", sub.key, int(keep.sum()), len(rows))
		placed |= keep
		sub_rows = [r for r, k in zip(rows, keep) if k]
		E = E_all[keep]
		is_current = current_all[keep]
		pro, con = refs
		# scaled so the "against" reference sits at -1 and "for" at +1
		axis = pro - con
		norm2 = float(axis @ axis) or 1.0
		mid = (pro + con) / 2
		xs = 2 * ((E - mid) @ axis) / norm2
		# 1D: sort by party then x; y is the rank
		order = sorted(range(len(sub_rows)), key=lambda i: (metas.get(sub_rows[i][0], {}).get("party") or "", float(xs[i])))
		one_d = _renumber([_point(metas.get(sub_rows[i][0], {}), sub_rows[i][0], xs[i], k, bool(is_current[i]), sub_rows[i][1])
			for k, i in enumerate(order)])
		# 2D: everyone on the axis, then current only; refs are the first two rows
		two_d = _layout(cfg, E, sub_rows, metas, is_current, pro, con, np.ones(len(sub_rows), dtype=bool), rows_extra=None)
		two_d_current = _layout(cfg, E, sub_rows, metas, is_current, pro, con, is_current, rows_extra=None) if is_current.any() else {"data": []}
		sub_blocks.append({
			"topic": topic.slug, "sub_topic": sub.slug, "sub_topic_jp": sub.name_jp,
			"axis": axis_block(sub, entry),
			"1d": {"data": one_d}, "2d": two_d, "2d_current": two_d_current,
		})
	if not sub_blocks:
		return None
	return {
		"topic": topic.slug, "topic_en": topic.name_en, "topic_jp": topic.name_jp, "window": topic.window_dict,
		# people on at least one axis
		"n_scaled": int(placed.sum()), "n_current": int((current_all & placed).sum()), "sub_topics": sub_blocks,
		# everyone embedded for the topic, axis or not; run_project pops it for the 立場 files (not published)
		EMBEDDED_KEY: sorted({str(pid) for pid, _ in rows}, key=int),
	}


def _layout(cfg: Config, E: np.ndarray, rows, metas, is_current, pro, con, mask, rows_extra) -> dict:
	idx = np.flatnonzero(mask)
	if len(idx) == 0:
		return {"data": []}
	M = np.vstack([con[None, :], pro[None, :], E[idx]])
	Y = umap_2d(M, cfg.umap_neighbors, cfg.seed)
	points = [_ref_point("against", Y[0, 0], Y[0, 1]), _ref_point("for", Y[1, 0], Y[1, 1])]
	for k, i in enumerate(idx):
		pid, rec = rows[i]
		points.append(_point(metas.get(pid, {}), pid, Y[k + 2, 0], Y[k + 2, 1], bool(is_current[i]), rec))
	return {"data": _renumber(points)}
