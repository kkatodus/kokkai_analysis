"""SpeakerResolver: NDL speaker → Postgres person_id (spec §4.5).

1. `get_politician_id_by_name(..., stop_for_input=False)`, unchanged: a single
   match on cleaned kanji name, else a single match on kana.
2. Same-name disambiguation when several people share the kanji name: if
   exactly one has `speakerYomi` as their kana, that person. Otherwise keep the
   ones who won an election on or before the meeting date for a party that
   matches `speakerGroup`. Exactly one left → that person.
3. Never fuzzy-match. Anything else is unmatched.
4. Confidence (specs/speaker-review): a match is flagged for review when the
   kanji differ beyond old/new character forms, when it was picked by election
   history, or when the meeting is outside the person's elected career. Human
   decisions in `speaker_review` override flagged matches.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from dbio.representative_db import get_person_by_column, get_politician_id_by_name
from utils.string_process import clean_repr_name

from .review_store import Decision, ReviewKey, load_decisions
from .variants import has_kana, same_name, same_reading

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


# a speech this far outside the person's wins is flagged (spec speaker-review §3.1)
CAREER_BEFORE = timedelta(days=365)
CAREER_AFTER = timedelta(days=7 * 365)


@dataclass(frozen=True)
class Resolution:
	person_id: Optional[int]
	reason: str  # "name" | "disambiguated" | "procedural" | "ambiguous" | "not_found" | "unlinked"
	confidence: str = "sure"  # "sure" | "review" (held until a human decides)
	review_key: Optional[ReviewKey] = None  # set whenever the match was flagged, decided or not


class SpeakerResolver:
	def __init__(self, cur, decisions: Optional[Dict[ReviewKey, Decision]] = None, flag: bool = True):
		"""`decisions` defaults to the `speaker_review` table; `flag=False` turns confidence checks off."""
		self.cur = cur
		self.flag = flag
		self._decisions = decisions
		self._base: Dict[Tuple[str, Optional[str], Optional[str]], Tuple[Optional[int], List[int]]] = {}
		self._by_kana: Dict[str, List[int]] = {}
		self._wins: Dict[int, List[Tuple[date, Optional[str]]]] = {}
		self._people: Optional[Dict[int, Tuple[str, Optional[str]]]] = None
		self.lookups = 0

	def resolve(self, speaker: Optional[str], yomi: Optional[str], group: Optional[str], meeting_date: str) -> Resolution:
		if not speaker or speaker in PROCEDURAL_SPEAKERS:
			return Resolution(None, "procedural")
		key = (speaker, yomi, group)
		if key not in self._base:
			self._base[key] = self._lookup(speaker, yomi, group)
		person_id, candidates = self._base[key]
		day = date.fromisoformat(meeting_date)
		if person_id is not None:
			return self._checked(Resolution(person_id, "name"), speaker, yomi, day, by_election=False)
		if len(candidates) > 1:
			by_kana = [pid for pid in candidates if pid in self._kana_matches(yomi)]
			if len(by_kana) == 1:
				return self._checked(Resolution(by_kana[0], "disambiguated"), speaker, yomi, day, by_election=False)
			pid = self._disambiguate(candidates, group, day)
			if pid is None:
				return Resolution(None, "ambiguous")
			return self._checked(Resolution(pid, "disambiguated"), speaker, yomi, day, by_election=True)
		return Resolution(None, "not_found")

	# --- confidence (specs/speaker-review §3.1) ---

	def flag_reason(self, speaker: str, yomi: Optional[str], person_id: int, day: date, by_election: bool) -> Optional[str]:
		name_kanji, name_kana = self.people().get(person_id, ("", None))
		if not same_name(speaker, name_kanji) and not (
			(has_kana(speaker) or has_kana(name_kanji)) and same_reading(yomi, name_kana)
		):
			return "kanji_differs"
		if by_election:
			return "election_pick"
		wins = [d for d, _ in self._wins_of(person_id)]
		if wins and day < min(wins) - CAREER_BEFORE:
			return "before_career"
		if wins and day > max(wins) + CAREER_AFTER:
			return "after_career"
		return None

	def _checked(self, res: Resolution, speaker: str, yomi: Optional[str], day: date, by_election: bool) -> Resolution:
		if not self.flag:
			return res
		reason = self.flag_reason(speaker, yomi, res.person_id, day, by_election)
		if reason is None:
			return res
		key = ReviewKey(speaker, yomi or "", res.person_id, reason)
		decision = self.decisions().get(key)
		if decision is None or decision.status == "pending":
			return Resolution(res.person_id, res.reason, "review", key)
		if decision.status == "confirmed":
			return Resolution(res.person_id, res.reason, "sure", key)
		if decision.status == "reassigned":
			return Resolution(decision.new_person_id, "reviewed", "sure", key)
		return Resolution(None, "unlinked", "sure", key)

	def decisions(self) -> Dict[ReviewKey, Decision]:
		if self._decisions is None:
			self._decisions = load_decisions(self.cur)
		return self._decisions

	def people(self) -> Dict[int, Tuple[str, Optional[str]]]:
		"""person_id → (name_kanji, name_kana); loads every person and election win once."""
		if self._people is None:
			self.cur.execute("SELECT person_id, name_kanji, name_kana FROM person")
			self._people = {int(pid): (kanji, kana) for pid, kanji, kana in self.cur.fetchall()}
			self.cur.execute("SELECT person_id, election_date, party, result FROM election_result")
			wins: Dict[int, List[Tuple[date, Optional[str]]]] = {pid: [] for pid in self._people}
			for pid, d, party, result in self.cur.fetchall():
				if (result or "").strip() not in LOSING_RESULTS:
					wins.setdefault(int(pid), []).append((d, party))
			self._wins.update(wins)
		return self._people

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
