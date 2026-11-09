"""A. Window suggestions from monthly search-word volume (spec §4.9 A).

Counts, per topic and month, the speeches in issues/ that contain a search word.
Cached per issue in state/volume/issues.jsonl (one line per issue: {issue, date, topics:{Topic: n}})
so a monthly run only scans new meetings. Suggests:
  • the earliest month where the 12-month rolling volume exceeds 20% of its maximum
    (compared with the configured window.from);
  • "possibly closed" when the last 12 months are under 10% of the peak.
"""
from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from ..config import Config, Topic
from ..state import State, write_atomic

log = logging.getLogger("topic_scaling.suggest.volume")

BARS = "▁▂▃▄▅▆▇█"
SINCE_YEAR = 1990


def issue_date(issue_id: str) -> str:
	d = issue_id[-8:]
	return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def count_issue(issues_dir: Path, issue_id: str, topics: List[Topic]) -> Dict[str, int]:
	counts = {t.name_en: 0 for t in topics}
	path = issues_dir / issue_id / "speeches.jsonl"
	if not path.exists():
		return counts
	with open(path, encoding="utf-8") as f:
		for line in f:
			if not line.strip():
				continue
			text = (json.loads(line).get("speech") or "")
			for t in topics:
				if any(w in text for w in t.search_words):
					counts[t.name_en] += 1
	return counts


def load_counts(state: State) -> Dict[str, dict]:
	path = state.volume_dir / "issues.jsonl"
	out = {}
	if path.exists():
		with open(path, encoding="utf-8") as f:
			for line in f:
				if line.strip():
					d = json.loads(line)
					out[d["issue"]] = d
	return out


def update_counts(cfg: Config, state: State, topics: List[Topic], max_new: Optional[int] = None) -> Dict[str, dict]:
	from ..select import words_hash
	cache = load_counts(state)
	wh = {t.name_en: words_hash(t.search_words) for t in topics}
	ids = [i for i in os.listdir(cfg.issues_dir) if len(i) >= 8 and i[-8:-4].isdigit() and int(i[-8:-4]) >= SINCE_YEAR]
	todo = []
	for i in ids:
		c = cache.get(i)
		if c and all(c.get("words", {}).get(t) == h for t, h in wh.items()):
			continue
		todo.append(i)
	if max_new is not None:
		todo = todo[:max_new]
	if todo:
		log.info("volume: counting %d issue(s)", len(todo))
	new_lines = []
	for n, i in enumerate(sorted(todo), 1):
		counts = count_issue(cfg.issues_dir, i, topics)
		prev = cache.get(i) or {"issue": i, "date": issue_date(i), "topics": {}, "words": {}}
		prev["topics"].update(counts)
		prev["words"].update(wh)
		cache[i] = prev
		new_lines.append(prev)
		if n % 2000 == 0:
			log.info("volume: %d/%d", n, len(todo))
	if new_lines:
		write_atomic(state.volume_dir / "issues.jsonl", "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in cache.values()))
	return cache


def monthly_series(cache: Dict[str, dict], topic_en: str) -> Dict[str, int]:
	by_month: Dict[str, int] = defaultdict(int)
	for d in cache.values():
		by_month[d["date"][:7]] += (d.get("topics") or {}).get(topic_en, 0)
	return dict(sorted(by_month.items()))


def rolling12(series: Dict[str, int]) -> List[Tuple[str, float]]:
	months = list(series)
	vals = [series[m] for m in months]
	out = []
	for i in range(len(months)):
		w = vals[max(0, i - 11):i + 1]
		out.append((months[i], sum(w) / 12.0))
	return out


def sparkline(series: Dict[str, int], buckets: int = 24) -> str:
	if not series:
		return ""
	months = list(series)
	per = max(1, len(months) // buckets)
	vals = [sum(series[m] for m in months[i:i + per]) for i in range(0, len(months), per)]
	top = max(vals) or 1
	return "".join(BARS[min(7, int(v / top * 7.999))] for v in vals)


def suggest_window(topic: Topic, series: Dict[str, int]) -> Optional[str]:
	r = rolling12(series)
	if not r:
		return f"{topic.name_en:18s} no speeches match its search words"
	peak = max(v for _, v in r) or 1
	rises = next((m for m, v in r if v >= 0.2 * peak), None)
	last = r[-1][1]
	note = []
	cfg_from = topic.window_from.isoformat() if topic.window_from else "—"
	if rises:
		rises_date = date.fromisoformat(rises + "-01")
		if topic.window_from and abs((rises_date - topic.window_from).days) > 400:
			note.append(f"rises {rises} → consider from {rises}")
		else:
			note.append(f"rises {rises} ✓")
	if last < 0.1 * peak:
		note.append(f"last 12 months {100 * last / peak:.0f}% of peak → consider closing")
	return f"{topic.name_en:18s} from {cfg_from} · {sparkline(series)} · " + ", ".join(note)


def run_volume(cfg: Config, state: State, topics: List[Topic]) -> List[str]:
	active = [t for t in topics if t.search_words]
	cache = update_counts(cfg, state, active)
	lines = ["Window suggestions (monthly search-word volume since %d):" % SINCE_YEAR]
	for t in active:
		s = suggest_window(t, monthly_series(cache, t.name_en))
		if s:
			lines.append("  " + s)
	return lines
