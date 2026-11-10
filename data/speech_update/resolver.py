"""SpeakerResolver: NDL speaker → Postgres person_id (spec §4.5).

1. A single match on cleaned kanji name, else a single match on kana, over
   `person` names and their `person_alias` rows (aliases.py).
2. Same-name disambiguation when several people share the kanji name: if
   exactly one has `speakerYomi` as their kana, that person. Otherwise keep the
   ones who won an election on or before the meeting date for a party that
   matches `speakerGroup`. Exactly one left → that person.
3. Never fuzzy-match. Anything else is unmatched.
4. Confidence (specs/speaker-review): a match is flagged for review when the
   kanji differ beyond old/new character forms, when it was picked by election
   history, or when the meeting is outside the person's elected career. Human
   decisions in `speaker_review` override flagged matches.
5. Service terms: a speech outside every elected term of the person, made
   without a parliamentary group (so not as a sitting member), is not
   attributed at all ("not_serving"). With a group the speaker *was* a member,
   so the election data is incomplete or it's someone else: flagged for review.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from utils.string_process import clean_repr_name

from .aliases import all_names
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


# service terms (spec speaker-review §3.1): a Diet win starts a term that runs for
# the house's term length, or until the next election in that house the person
# stood in, plus a grace period (an upper-house term outlasts the election day)
TERM_LENGTH = {"衆": timedelta(days=4 * 365 + 1), "参": timedelta(days=6 * 365 + 2)}
TERM_GRACE = timedelta(days=30)
LOCAL_ELECTION_RE = re.compile(r"議会|知事|市長|区長|町長|村長")
UPPER_DISTRICT_RE = re.compile(r"(?:県|都|府|道)選挙区$|比例区$|全国区$|地方区$")
LOWER_DISTRICT_RE = re.compile(r"区$|ブロック$")
Term = Tuple[date, date]


# NDL fills speakerGroup for some witnesses and officials from the person's later
# party (正力松太郎 testifying in 1953 under 自由民主党), so a group alone doesn't
# mean the speaker sat in the Diet. These roles and speech headers never do.
NON_MEMBER_ROLES = {"参考人", "証人", "公述人"}
NON_MEMBER_HEADER_RE = re.compile(r"政府委員|説明員|政府参考人|参考人|公述人|証人|最高裁判所|会計検査院|人事院")


def member_group(speech: dict) -> Optional[str]:
	"""The speech's speakerGroup if it was made as a Diet member, else None."""
	if (speech.get("speakerRole") or "") in NON_MEMBER_ROLES:
		return None
	header = (speech.get("speech") or "").split("\u3000", 1)[0][:40]
	if header.startswith("○") and NON_MEMBER_HEADER_RE.search(header):
		return None
	return speech.get("speakerGroup") or None


def election_house(election_name: Optional[str], district: Optional[str]) -> Optional[str]:
	"""'衆' / '参' for a Diet election, None for local or House of Peers elections."""
	name = election_name or ""
	if LOCAL_ELECTION_RE.search(name) or "貴族院" in name:
		return None
	if "衆議院" in name:
		return "衆"
	if "参議院" in name:
		return "参"
	d = (district or "").strip()
	if UPPER_DISTRICT_RE.search(d):
		return "参"
	if LOWER_DISTRICT_RE.search(d):
		return "衆"
	return None


def service_terms(elections: List[Tuple[date, Optional[str], bool]]) -> List[Term]:
	"""elections: (date, house, won) sorted by date → [(start, end incl. grace)]."""
	terms = []
	for i, (d, house, won) in enumerate(elections):
		if not won or house is None:
			continue
		end = d + TERM_LENGTH[house]
		later = [d2 for d2, h2, _ in elections[i + 1:] if h2 == house and d2 > d]
		if later:
			end = min(end, later[0])
		terms.append((d, end + TERM_GRACE))
	return terms


@dataclass(frozen=True)
class Resolution:
	person_id: Optional[int]
	reason: str  # "name" | "disambiguated" | "reviewed" | "procedural" | "ambiguous" | "not_found" | "unlinked" | "not_serving"
	confidence: str = "sure"  # "sure" | "review" (held until a human decides)
	review_key: Optional[ReviewKey] = None  # set whenever the match was flagged, decided or not


class SpeakerResolver:
	def __init__(self, cur, decisions: Optional[Dict[ReviewKey, Decision]] = None, flag: bool = True):
		"""`decisions` defaults to the `speaker_review` table; `flag=False` turns confidence checks off."""
		self.cur = cur
		self.flag = flag
		self._decisions = decisions
		self._base: Dict[Tuple[str, Optional[str], Optional[str]], Tuple[Optional[int], List[int]]] = {}
		self._by_kanji: Dict[str, List[int]] = {}
		self._by_kana: Dict[str, List[int]] = {}
		self._names: Dict[int, List[Tuple[str, Optional[str]]]] = {}
		self._wins: Dict[int, List[Tuple[date, Optional[str]]]] = {}
		self._people: Optional[Dict[int, Tuple[str, Optional[str]]]] = None
		self._terms: Dict[int, List[Term]] = {}
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
			return self._checked(Resolution(person_id, "name"), speaker, yomi, group, day, by_election=False)
		if len(candidates) > 1:
			by_kana = [pid for pid in candidates if pid in self._kana_matches(yomi)]
			if len(by_kana) == 1:
				return self._checked(Resolution(by_kana[0], "disambiguated"), speaker, yomi, group, day, by_election=False)
			pid = self._disambiguate(candidates, group, day)
			if pid is None:
				return Resolution(None, "ambiguous")
			return self._checked(Resolution(pid, "disambiguated"), speaker, yomi, group, day, by_election=True)
		return Resolution(None, "not_found")

	# --- confidence (specs/speaker-review §3.1) ---

	def in_term(self, person_id: int, day: date) -> bool:
		self.people()
		return any(start <= day <= end for start, end in self._terms.get(person_id, ()))

	def flag_reason(self, speaker: str, yomi: Optional[str], group: Optional[str], person_id: int, day: date, by_election: bool) -> Optional[str]:
		names = self._names.get(person_id) or [self.people().get(person_id, ("", None))]
		serving = self.in_term(person_id, day)
		if not serving and not group:
			return "not_serving"
		if not any(
			same_name(speaker, kanji) or ((has_kana(speaker) or has_kana(kanji)) and same_reading(yomi, kana))
			for kanji, kana in names
		):
			return "kanji_differs"
		if by_election:
			return "election_pick"
		if not serving:
			return "out_of_term"
		return None

	def _checked(self, res: Resolution, speaker: str, yomi: Optional[str], group: Optional[str], day: date, by_election: bool) -> Resolution:
		if not self.flag:
			return res
		reason = self.flag_reason(speaker, yomi, group, res.person_id, day, by_election)
		if reason is None:
			return res
		key = ReviewKey(speaker, yomi or "", res.person_id, reason)
		decision = self.decisions().get(key)
		if reason == "not_serving" and (decision is None or decision.status == "pending"):
			# not attributed without asking; a "confirmed" decision can still override
			return Resolution(None, "not_serving", "sure", key)
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
		"""person_id → (name_kanji, name_kana); loads every person, election win and term once."""
		if self._people is None:
			self.set_names(all_names(self.cur))
			self.cur.execute(
				"SELECT person_id, election_date, election_name, district, party, result FROM election_result ORDER BY person_id, election_date"
			)
			wins: Dict[int, List[Tuple[date, Optional[str]]]] = {pid: [] for pid in self._people}
			elections: Dict[int, List[Tuple[date, Optional[str], bool]]] = {}
			for pid, d, name, district, party, result in self.cur.fetchall():
				won = (result or "").strip() not in LOSING_RESULTS
				if won:
					wins.setdefault(int(pid), []).append((d, party))
				elections.setdefault(int(pid), []).append((d, election_house(name, district), won))
			self._wins.update(wins)
			self._terms = {pid: service_terms(rows) for pid, rows in elections.items()}
		return self._people

	def set_names(self, rows: List[Tuple[int, str, Optional[str]]]) -> None:
		"""Index (person_id, name_kanji, name_kana) rows: each person's own row first, then aliases."""
		self._people = {}
		self._names, self._by_kanji, self._by_kana = {}, {}, {}
		for pid, kanji, kana in rows:
			self._people.setdefault(pid, (kanji, kana))
			self._names.setdefault(pid, []).append((kanji, kana))
			for index, key in ((self._by_kanji, kanji), (self._by_kana, kana)):
				key = clean_repr_name(key or "")
				if key and pid not in index.setdefault(key, []):
					index[key].append(pid)

	def _lookup(self, speaker: str, yomi: Optional[str], group: Optional[str]) -> Tuple[Optional[int], List[int]]:
		self.lookups += 1
		self.people()
		same_name = self._by_kanji.get(clean_repr_name(speaker), [])
		if len(same_name) == 1:
			return same_name[0], []
		if same_name:
			return None, list(same_name)
		same_kana = self._kana_matches(yomi)
		return (same_kana[0] if len(same_kana) == 1 else None), []

	def _disambiguate(self, candidates: List[int], group: Optional[str], meeting_date: date) -> Optional[int]:
		left = [
			pid for pid in candidates
			if any(d <= meeting_date and party_matches(party, group) for d, party in self._wins_of(pid))
		]
		return left[0] if len(left) == 1 else None

	def _kana_matches(self, yomi: Optional[str]) -> List[int]:
		self.people()
		return self._by_kana.get(clean_repr_name(yomi), []) if yomi else []

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
