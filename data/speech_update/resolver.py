"""SpeakerResolver: NDL speaker → Postgres person_id (spec §4.5).

1. `get_politician_id_by_name(..., stop_for_input=False)`, unchanged: a single
   match on cleaned kanji name, else a single match on kana.
2. Same-name disambiguation when several people share the kanji name: if
   exactly one has `speakerYomi` as their kana, that person. Otherwise keep the
   ones who won an election on or before the meeting date for a party that
   matches `speakerGroup`. Exactly one left → that person.
3. Never fuzzy-match. Anything else is unmatched.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Tuple

from dbio.representative_db import get_person_by_column, get_politician_id_by_name
from utils.string_process import clean_repr_name

log = logging.getLogger(__name__)

# speakers that are never people
PROCEDURAL_SPEAKERS = {"会議録情報"}

LOSING_RESULTS = {"落選", "-", ""}

# short / historical forms seen in speakerGroup or election_result.party
PARTY_ALIASES = {
	"自民党": "自由民主党",
	"社会党": "日本社会党",
	"共産党": "日本共産党",
	"維新": "日本維新の会",
	"立憲": "立憲民主党",
	"立憲民主": "立憲民主党",  # 会派 names drop the 党: 立憲民主・無所属
	"国民": "国民民主党",
}
GROUP_SPLIT_RE = re.compile(r"[・･\s　]+")


def _norm_party(p: str) -> str:
	p = re.sub(r"[\s　]+", "", p or "")
	return PARTY_ALIASES.get(p, p)


def party_matches(party: Optional[str], speaker_group: Optional[str]) -> bool:
	"""Does an election's party match an NDL speakerGroup (会派) like 自由民主党・無所属の会?"""
	# whole-name comparison only: 民主党 is a substring of 自由民主党
	party = _norm_party(party or "")
	if not party or not speaker_group:
		return False
	if _norm_party(speaker_group) == party:
		return True
	return any(_norm_party(part) == party for part in GROUP_SPLIT_RE.split(speaker_group or "") if part)


@dataclass(frozen=True)
class Resolution:
	person_id: Optional[int]
	reason: str  # "name" | "disambiguated" | "procedural" | "ambiguous" | "not_found"


class SpeakerResolver:
	def __init__(self, cur):
		self.cur = cur
		self._base: Dict[Tuple[str, Optional[str], Optional[str]], Tuple[Optional[int], List[int]]] = {}
		self._by_kana: Dict[str, List[int]] = {}
		self._wins: Dict[int, List[Tuple[date, Optional[str]]]] = {}
		self.lookups = 0

	def resolve(self, speaker: Optional[str], yomi: Optional[str], group: Optional[str], meeting_date: str) -> Resolution:
		if not speaker or speaker in PROCEDURAL_SPEAKERS:
			return Resolution(None, "procedural")
		key = (speaker, yomi, group)
		if key not in self._base:
			self._base[key] = self._lookup(speaker, yomi, group)
		person_id, candidates = self._base[key]
		if person_id is not None:
			return Resolution(person_id, "name")
		if len(candidates) > 1:
			by_kana = [pid for pid in candidates if pid in self._kana_matches(yomi)]
			if len(by_kana) == 1:
				return Resolution(by_kana[0], "disambiguated")
			pid = self._disambiguate(candidates, group, date.fromisoformat(meeting_date))
			return Resolution(pid, "disambiguated") if pid is not None else Resolution(None, "ambiguous")
		return Resolution(None, "not_found")

	def _lookup(self, speaker: str, yomi: Optional[str], group: Optional[str]) -> Tuple[Optional[int], List[int]]:
		self.lookups += 1
		pid = get_politician_id_by_name(self.cur, speaker, yomi or "", group or "", stop_for_input=False)
		if pid is not None:
			return int(pid), []
		same_name = get_person_by_column(self.cur, "name_kanji", clean_repr_name(speaker))
		return None, [int(p.person_id) for p in same_name]

	def _disambiguate(self, candidates: List[int], group: Optional[str], meeting_date: date) -> Optional[int]:
		left = [
			pid for pid in candidates
			if any(d <= meeting_date and party_matches(party, group) for d, party in self._wins_of(pid))
		]
		return left[0] if len(left) == 1 else None

	def _kana_matches(self, yomi: Optional[str]) -> List[int]:
		if not yomi:
			return []
		if yomi not in self._by_kana:
			self._by_kana[yomi] = [int(p.person_id) for p in get_person_by_column(self.cur, "name_kana", clean_repr_name(yomi))]
		return self._by_kana[yomi]

	def _wins_of(self, person_id: int) -> List[Tuple[date, Optional[str]]]:
		if person_id not in self._wins:
			self.cur.execute(
				"SELECT election_date, party, result FROM election_result WHERE person_id = %s",
				(person_id,),
			)
			self._wins[person_id] = [
				(d, party) for d, party, result in self.cur.fetchall()
				if (result or "").strip() not in LOSING_RESULTS
			]
		return self._wins[person_id]
