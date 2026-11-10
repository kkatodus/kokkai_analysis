"""Project stage: 1D axis positions and 2D UMAP layouts per sub-topic (spec §4.6).

1D: x = 2 (e - mid) · (pro - con) / |pro - con|², mid = (pro + con)/2 → 0 is the axis midpoint,
    the "against" reference is at -1 and "for" at +1, positive leans "pro".
    y = rank index within the party-sorted list (as the live file).
2D: UMAP over the topic's politician embeddings + the two reference vectors, fitted twice:
    everyone scaled in the window ("2d") and current members only ("2d_current").
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import numpy as np

from .config import Config, SubTopic, Topic
from .embed import person_vector, reference_vectors
from .members import DEFAULT_COLOR, PARTY_COLOR
from .state import State

log = logging.getLogger("topic_scaling.project")


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
	E = np.vstack(vectors)
	is_current = np.array([pid in current_ids for pid, _ in rows])
	sub_blocks = []
	for sub in subs:
		refs = reference_vectors(cfg, state, sub, None)
		if refs is None:
			log.warning("%s: no reference vectors yet, skipped", sub.key)
			continue
		pro, con = refs
		# scaled so the "against" reference sits at -1 and "for" at +1
		axis = pro - con
		norm2 = float(axis @ axis) or 1.0
		mid = (pro + con) / 2
		xs = 2 * ((E - mid) @ axis) / norm2
		# 1D: sort by party then x; y is the rank
		order = sorted(range(len(rows)), key=lambda i: (metas.get(rows[i][0], {}).get("party") or "", float(xs[i])))
		one_d = _renumber([_point(metas.get(rows[i][0], {}), rows[i][0], xs[i], k, bool(is_current[i]), rows[i][1])
			for k, i in enumerate(order)])
		# 2D: everyone, then current only; refs are the first two rows
		two_d = _layout(cfg, E, rows, metas, is_current, pro, con, np.ones(len(rows), dtype=bool), rows_extra=None)
		two_d_current = _layout(cfg, E, rows, metas, is_current, pro, con, is_current, rows_extra=None) if is_current.any() else {"data": []}
		sub_blocks.append({
			"topic": topic.slug, "sub_topic": sub.slug, "sub_topic_jp": sub.name_jp,
			"axis": {"pro": sub.pro, "con": sub.con},
			"1d": {"data": one_d}, "2d": two_d, "2d_current": two_d_current,
		})
	if not sub_blocks:
		return None
	return {
		"topic": topic.slug, "topic_en": topic.name_en, "topic_jp": topic.name_jp, "window": topic.window_dict,
		"n_scaled": len(rows), "n_current": int(is_current.sum()), "sub_topics": sub_blocks,
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
