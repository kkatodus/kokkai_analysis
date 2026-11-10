"""NDL meeting/speech records and the on-disk shapes written to the mirror.

`SpeechRecord`, `MeetingRecord` and `from_dict()` are lifted from
`collect_all_speeches.py`, which can't be imported (it crawls at import time).
Field order matters: `to_dict()` output is what lands in `speeches.jsonl`,
`meta.json` and the per-person files, and it matches the existing files.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, fields, is_dataclass
from typing import Any, List, Optional, Union, get_args, get_origin

# meta.json keys, in the order the existing files use. `nextRecordPosition`
# is a leftover from the old collector (it stored the paging cursor); new
# writes set it to None so the shape stays the same.
META_KEYS = (
	"issueID", "imageKind", "searchObject", "session", "nameOfHouse",
	"nameOfMeeting", "issue", "date", "closing", "pdfURL", "nextRecordPosition",
)


@dataclass(frozen=True)
class SpeechRecord:
	speechID: str
	speechOrder: int
	speaker: str
	speakerYomi: Optional[str]
	speakerGroup: Optional[str]
	speakerPosition: Optional[str]
	speakerRole: Optional[str]
	speech: str
	startPage: Optional[int]
	createTime: Optional[str]
	updateTime: Optional[str]
	speechURL: Optional[str]


@dataclass(frozen=True)
class MeetingRecord:
	issueID: str
	imageKind: Optional[str]
	searchObject: Optional[int]
	session: Optional[int]
	nameOfHouse: Optional[str]
	nameOfMeeting: Optional[str]
	issue: Optional[str]
	date: str
	closing: Optional[str]
	pdfURL: Optional[str]
	speechRecord: List[SpeechRecord]

	def meta_dict(self) -> dict:
		d = {k: getattr(self, k) for k in META_KEYS if k != "nextRecordPosition"}
		d["nextRecordPosition"] = None
		return d

	def speech_dicts(self) -> List[dict]:
		return [asdict(s) for s in self.speechRecord]


# --- Generic recursive constructor (from collect_all_speeches.py) ---

def from_dict(cls, data):
	if data is None:
		return None

	if is_dataclass(cls):
		kwargs = {}
		for f in fields(cls):
			raw = data.get(f.name, None)
			kwargs[f.name] = _convert_value_with_defaults(_resolve_type(cls, f), raw)
		return cls(**kwargs)

	origin = get_origin(cls)
	if origin in (list, List):
		(elem_type,) = get_args(cls)
		# accept dict-as-singleton for one-or-many APIs
		if isinstance(data, dict):
			data = [data]
		return [_convert_value_with_defaults(elem_type, x) for x in data]

	return _cast_primitive(cls, data)


def _resolve_type(cls, f) -> Any:
	# `from __future__ import annotations` turns field types into strings
	if isinstance(f.type, str):
		import typing
		return typing.get_type_hints(cls)[f.name]
	return f.type


def _convert_value_with_defaults(tp, val):
	origin = get_origin(tp)

	if origin is Union:  # Optional[T] etc.
		args = [a for a in get_args(tp) if a is not type(None)]
		if val is None:
			return None
		return _convert_value_with_defaults(args[0], val)

	if is_dataclass(tp):
		return from_dict(tp, val or {})

	if origin in (list, List):
		(elem_type,) = get_args(tp)
		if val is None:
			return []
		# same dict-as-singleton fix for nested lists like speechRecord
		if isinstance(val, dict):
			val = [val]
		return [_convert_value_with_defaults(elem_type, x) for x in val]

	return _cast_primitive(tp, val)


def _cast_primitive(tp, val):
	if val is None:
		return None
	if tp in (int, float, str, bool):
		try:
			return tp(val)
		except Exception:
			return val
	return val


def meeting_from_api(record: dict) -> MeetingRecord:
	meeting = from_dict(MeetingRecord, record)
	if not meeting.issueID or not meeting.date:
		raise ValueError(f"NDL meeting record without issueID/date: {record.get('issueID')!r}")
	return meeting


def person_line(speech: dict, meta: dict) -> dict:
	"""One line of repr_speeches_id_organized/{person_id}/*.jsonl."""
	return speech | {"meta": meta}
