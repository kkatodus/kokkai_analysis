"""Split a meeting into question-and-answer exchanges (specs/speech-quality-labels §4.2).

Each NDL speech starts with a header such as ○山田委員 (衆 committee member),
○山田太郎君 (参 member, or any member in a plenary), ○岸田内閣総理大臣,
○国務大臣（林芳正君）, ○委員長（山田太郎君）. From the header a turn is one of:

  chair       委員長 / 議長 / 会長 / 主査 / 理事 presiding (incl. 代理)
  questioner  a member speaking as a member (…委員, …君)
  answerer    everyone else: ministers, officials, 参考人, members answering for a bill
  record      the 会議録情報 front matter (speechOrder 0)

An exchange starts at a questioner turn whose speaker differs from the current
questioner and runs until the next such turn, or until the chair closes the
questioning or moves to another item (質疑は終局 / 議題といたします / 討論に入ります …).
Chair turns inside it are kept as context; turns outside any exchange (opening
business, bill explanations, debate) belong to none.
A plenary 代表質問 and its answers come out as one exchange.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

CONTINUED = "（続）"  # ○山田太郎君（続）: the same speaker resuming after an interruption
HEADER = re.compile(r"^○([^　\s]+)")
CHAIR_ROLES = (
	"委員長代理", "委員長", "副議長", "議長", "会長代理", "会長", "副主査", "主査",
	"小委員長代理", "小委員長", "分科会長", "理事", "仮議長", "座長代理", "座長",
)


# a chair turn with one of these ends the current exchange
CLOSES_QUESTIONING = re.compile(
	r"質疑は終局|質疑を終局|議題といたします|議題とします|趣旨説明|討論に入ります|"
	r"散会いたします|この程度にとどめ|これにて質疑|質疑はこれにて"
)


def header(text: str) -> str:
	m = HEADER.match(text or "")
	h = m.group(1) if m else ""
	return h[: -len(CONTINUED)] if h.endswith(CONTINUED) else h


def turn_kind(speech: dict) -> str:
	if speech.get("speechOrder") == 0 or speech.get("speaker") == "会議録情報":
		return "record"
	h = header(speech.get("speech", ""))
	if not h:
		return "answerer"
	if h.endswith("）"):
		# 参 / plenary style: ○役職（氏名君）; the role is before the bracket
		role = h.split("（", 1)[0]
		if role in CHAIR_ROLES:
			return "chair"
		return "answerer"
	# 衆 committee style: ○氏名役職 (the name itself may hold a bracket: ○山本（ジ）委員)
	if any(h.endswith(r) for r in CHAIR_ROLES if r != "理事"):
		return "chair"
	if h.endswith("委員") or h.endswith("君"):
		return "questioner"
	return "answerer"


@dataclass
class Turn:
	speech_id: str
	order: int
	speaker: str
	group: Optional[str]
	header: str
	kind: str
	text: str


@dataclass
class Exchange:
	issue_id: str
	index: int                       # 0-based position among the meeting's exchanges
	questioner: str
	questioner_group: Optional[str]
	turns: List[Turn] = field(default_factory=list)

	@property
	def speech_ids(self) -> List[str]:
		return [t.speech_id for t in self.turns]

	@property
	def answerers(self) -> List[str]:
		seen: List[str] = []
		for t in self.turns:
			if t.kind == "answerer" and t.speaker not in seen:
				seen.append(t.speaker)
		return seen

	@property
	def chars(self) -> int:
		return sum(len(t.text) for t in self.turns)

	def text_of(self, kind: str) -> str:
		return "\n".join(t.text for t in self.turns if t.kind == kind)


def to_turn(speech: dict) -> Turn:
	return Turn(
		speech_id=speech["speechID"],
		order=int(speech.get("speechOrder") or 0),
		speaker=speech.get("speaker") or "",
		group=speech.get("speakerGroup"),
		header=header(speech.get("speech", "")),
		kind=turn_kind(speech),
		text=speech.get("speech") or "",
	)


def segment(issue_id: str, speeches: Iterable[dict]) -> List[Exchange]:
	exchanges: List[Exchange] = []
	current: Optional[Exchange] = None
	for s in sorted(speeches, key=lambda s: int(s.get("speechOrder") or 0)):
		t = to_turn(s)
		if t.kind == "record":
			continue
		if t.kind == "questioner" and (current is None or t.speaker != current.questioner):
			current = Exchange(issue_id, len(exchanges), t.speaker, t.group)
			exchanges.append(current)
		if current is not None:
			current.turns.append(t)
			if t.kind == "chair" and CLOSES_QUESTIONING.search(t.text):
				current = None
	return exchanges
