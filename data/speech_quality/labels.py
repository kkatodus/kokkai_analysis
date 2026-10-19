"""Exchanges to label and the labels written back (specs/speech-quality-labels §4.2, §4.7).

A unit is one committee exchange since 2000 with an answer (plenary is out of scope),
keyed by its first speech. `content_hash` changes when NDL corrects the text, which
makes the exchange due for a new label.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional

from speech_update.state import write_atomic

from .prompt import PROMPT_VERSION, SCHEMA, exchange_prompt, system_prompt
from .segment import Exchange, segment

SINCE = "2000-01-01"
MIN_CHARS = 200          # shorter exchanges are procedural one-liners
TOKENS_PER_CHAR = 0.6    # Gemini on Japanese, measured 0.56 on the gold set (max 0.63)
OUTPUT_TOKENS_EST = 160  # measured 137 with v3


@dataclass
class Unit:
	issue_id: str
	date: str
	house: str
	meeting: str
	exchange: Exchange
	earlier: List[str]

	@property
	def key(self) -> str:
		return self.exchange.turns[0].speech_id

	@property
	def content_hash(self) -> str:
		h = hashlib.sha1()
		for t in self.exchange.turns:
			h.update(t.speech_id.encode())
			h.update(t.text.encode())
		return h.hexdigest()[:16]

	def prompt_dict(self) -> dict:
		ex = self.exchange
		return {
			"date": self.date, "house": self.house, "meeting": self.meeting,
			"questioner": ex.questioner, "questioner_group": ex.questioner_group, "earlier": self.earlier,
			"turns": [{"kind": t.kind, "speaker": t.speaker, "text": t.text} for t in ex.turns],
		}

	def user_prompt(self) -> str:
		return exchange_prompt(self.prompt_dict())

	def tokens_est(self) -> int:
		return int((len(SYSTEM) + len(self.user_prompt())) * TOKENS_PER_CHAR)


SYSTEM = system_prompt()


def issue_date(issue_id: str) -> str:
	d = issue_id[-8:]
	return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def units_for_issue(issues_dir: Path, issue_id: str) -> List[Unit]:
	d = issues_dir / issue_id
	try:
		meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
		with open(d / "speeches.jsonl", encoding="utf-8") as f:
			speeches = [json.loads(l) for l in f if l.strip()]
	except (OSError, ValueError):
		return []
	date = meta.get("date") or issue_date(issue_id)
	if date < SINCE or meta.get("nameOfMeeting") == "本会議":
		return []
	exs = segment(issue_id, speeches)
	out = []
	for ex in exs:
		if not ex.answerers or ex.chars < MIN_CHARS:
			continue
		earlier = [f"{e.questioner}: {e.text_of('questioner')[:120]}".replace("\r\n", " ") for e in exs[: ex.index]]
		out.append(Unit(issue_id, date, meta.get("nameOfHouse") or "", meta.get("nameOfMeeting") or "", ex, earlier))
	return out


def issues_newest_first(issues_dir: Path) -> List[str]:
	ids = [i for i in (p.name for p in issues_dir.iterdir()) if len(i) >= 8 and i[-8:].isdigit() and issue_date(i) >= SINCE]
	return sorted(ids, key=lambda i: (i[-8:], i), reverse=True)


def due(units: Iterable[Unit], done: Dict[str, str], pending: set) -> Iterator[Unit]:
	for u in units:
		if u.key in pending or done.get(u.key) == u.content_hash:
			continue
		yield u


def batch_line(u: Unit) -> dict:
	return {
		"key": u.key,
		"request": {
			"systemInstruction": {"parts": [{"text": SYSTEM}]},
			"contents": [{"role": "user", "parts": [{"text": u.user_prompt()}]}],
			"generationConfig": {
				"temperature": 0,
				"responseMimeType": "application/json",
				"responseJsonSchema": SCHEMA,
				# batch mode rejects "minimal"; v3 scored 0.92 at low vs 0.93 at minimal (spec §4.1)
				"thinkingConfig": {"thinkingLevel": "low"},
			},
		},
	}


# --- writing labels onto speech lines (§3.5, §4.7) ---

def productive(labels: dict) -> bool:
	"""§3.5: contribution ≠ none and no questioner-side issue covering most of the exchange."""
	if labels.get("contribution") == "none":
		return False
	for i in labels.get("issues") or []:
		if i.get("extent") == "most" and i.get("by") in ("questioner", "both"):
			return False
	return True


def speech_fields(row: dict) -> dict:
	q = {k: row[k] for k in ("function", "contribution", "issues", "responsible", "outcomes", "topic")}
	q.update(model=row["model"], prompt=row["prompt_version"], speech_ids=row["speech_ids"])
	return {
		"quality": q,
		"is_relevant": str(row["function"] != "none"),
		"is_productive": str(productive(row)),
		"quality_reason": row["reason"],
	}


QUALITY_KEYS = ("quality", "is_relevant", "is_productive", "quality_reason")


def write_issue(issues_dir: Path, issue_id: str, rows: List[dict]) -> bool:
	"""Put each label on its exchange's first speech and clear stale ones. True if the file changed."""
	path = issues_dir / issue_id / "speeches.jsonl"
	if not path.exists():
		return False
	by_start = {r["start_speech_id"]: r for r in rows}
	with open(path, encoding="utf-8") as f:
		raw = [l for l in f if l.strip()]
	out, changed = [], False
	for l in raw:
		line = json.loads(l)
		row = by_start.get(line.get("speechID"))
		new = {k: v for k, v in line.items() if k not in QUALITY_KEYS}
		if row:
			new.update(speech_fields(row))
		if new != line:
			changed = True
		out.append(new)
	if changed:
		write_atomic(path, "".join(json.dumps(l, ensure_ascii=False) + "\n" for l in out))
	return changed


RESULT_COLS = ("start_speech_id", "issue_id", "speech_ids", "model", "prompt_version", "function", "contribution",
	"issues", "responsible", "outcomes", "topic", "reason")


def write_issues(cur, issues_dir: Path, issue_ids: Iterable[str]) -> List[str]:
	"""Rewrite labels for these issues from label_result; returns mirror-relative paths changed."""
	ids = sorted(set(issue_ids))
	if not ids:
		return []
	cur.execute(f"SELECT {', '.join(RESULT_COLS)} FROM label_result WHERE issue_id = ANY(%s)", (ids,))
	rows: Dict[str, List[dict]] = {}
	for r in cur.fetchall():
		d = dict(zip(RESULT_COLS, r))
		rows.setdefault(d["issue_id"], []).append(d)
	changed = []
	for i in ids:
		if write_issue(issues_dir, i, rows.get(i, [])):
			changed.append(f"issues/{i}/speeches.jsonl")
	return changed


def parse_response(resp: dict) -> Optional[dict]:
	"""Labels from a GenerateContentResponse, or None if it failed or doesn't fit the schema."""
	try:
		parts = resp["candidates"][0]["content"]["parts"]
		labels = json.loads("".join(p.get("text", "") for p in parts if not p.get("thought")))
	except (KeyError, IndexError, ValueError, TypeError):
		return None
	need = ("function", "issues", "contribution", "responsible", "outcomes", "topic", "reason")
	if not isinstance(labels, dict) or any(k not in labels for k in need):
		return None
	return labels


def usage(resp: dict) -> tuple:
	u = resp.get("usageMetadata") or {}
	return u.get("promptTokenCount", 0), u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)


__all__ = ["Unit", "units_for_issue", "issues_newest_first", "due", "batch_line", "write_issues", "parse_response",
	"usage", "productive", "PROMPT_VERSION", "OUTPUT_TOKENS_EST"]
