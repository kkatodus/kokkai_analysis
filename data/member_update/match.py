"""Attach Postgres `person_id`s to scraped member rows.

In order, first hit wins:
1. `links.json`: a manual house+name → person_id link (`python -m member_update link`).
2. Carry-over: the same name and reading in the previous snapshot of the house.
3. Name: exactly one `person` whose name matches (旧字体 folded, maiden name in
   [...] ignored); with several, the one whose kana also matches.
4. Reading: exactly one `person` with the same kana (上野ほたる → 上野蛍).
   Reported separately so a wrong pick is easy to spot.
Anything else stays `person_id: null` and goes to the review queue.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

from speech_update.variants import normalise_name

MAIDEN_NAME = re.compile(r"\[.*?\]")


def name_key(name: Optional[str]) -> str:
	return normalise_name(MAIDEN_NAME.sub("", name or ""))


def member_key(row: dict) -> Tuple[str, str]:
	return name_key(row.get("name")), normalise_name(row.get("yomikata"))


def link_key(house: str, name: str) -> str:
	return f"{house}:{name_key(name)}"


@dataclass
class Unresolved:
	house: str
	row: dict
	reason: str                       # "not_in_person" | "ambiguous"
	candidates: List[int] = field(default_factory=list)

	def as_json(self) -> dict:
		return {
			"house": self.house, "name": self.row["name"], "yomikata": self.row["yomikata"],
			"kaiha": self.row["kaiha"], "district": self.row["district"], "link": self.row.get("link"),
			"reason": self.reason, "candidates": self.candidates,
		}


@dataclass
class MatchResult:
	by_method: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
	by_reading: List[Tuple[str, dict, int, str]] = field(default_factory=list)  # house, row, person_id, name_kanji
	unresolved: List[Unresolved] = field(default_factory=list)


class MemberMatcher:
	def __init__(self, persons: Iterable[Tuple[int, str, Optional[str]]], links: Optional[Dict[str, int]] = None):
		self.names: Dict[int, str] = {}
		self.by_name: Dict[str, List[int]] = defaultdict(list)
		self.by_kana: Dict[str, List[int]] = defaultdict(list)
		self.kana: Dict[int, str] = {}
		for pid, kanji, kana in persons:
			self.names[pid] = kanji
			self.by_name[name_key(kanji)].append(pid)
			if kana:
				self.kana[pid] = normalise_name(kana)
				self.by_kana[normalise_name(kana)].append(pid)
		self.links = links or {}

	def match_house(self, house: str, rows: List[dict], previous: List[dict], result: MatchResult) -> None:
		carried = {member_key(r): r["person_id"] for r in previous if r.get("person_id") is not None}
		for row in rows:
			pid, method, unresolved = self._match(house, row, carried)
			row["person_id"] = pid
			if pid is not None:
				result.by_method[method] += 1
				if method == "reading":
					result.by_reading.append((house, row, pid, self.names[pid]))
			else:
				result.unresolved.append(unresolved)

	def _match(self, house: str, row: dict, carried: Dict[Tuple[str, str], int]):
		linked = self.links.get(link_key(house, row["name"]))
		if linked is not None and linked in self.names:
			return linked, "link", None
		prev = carried.get(member_key(row))
		if prev is not None and prev in self.names:
			return prev, "carried", None

		name, kana = member_key(row)
		same_name = self.by_name.get(name, [])
		if len(same_name) == 1:
			return same_name[0], "name", None
		if len(same_name) > 1:
			hits = [p for p in same_name if self.kana.get(p) == kana]
			if len(hits) == 1:
				return hits[0], "name", None
			return None, None, Unresolved(house, row, "ambiguous", sorted(same_name))

		same_kana = self.by_kana.get(kana, []) if kana else []
		if len(same_kana) == 1:
			return same_kana[0], "reading", None
		if len(same_kana) > 1:
			return None, None, Unresolved(house, row, "ambiguous", sorted(same_kana))
		return None, None, Unresolved(house, row, "not_in_person")
