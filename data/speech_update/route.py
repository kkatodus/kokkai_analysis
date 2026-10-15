"""Route stage: merge speeches from changed issues into the per-politician files.

repr_speeches_id_organized/{person_id}/all_speeches.jsonl and /{Topic}.jsonl:
lines are keyed by speechID (existing IDs are replaced, new ones added, nothing
is deleted here; see remove_from_person_dir) and sorted newest meeting first.
Optionally upserts the same speeches into the Postgres `speeches` table.
Matches the resolver flags for review are held: not filed, not written to
Postgres, collected in RouteResult.held (specs/speaker-review).
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Set, Tuple

from dbio.representative_db import PersonId, Speech, upsert_speeches_bulk
from utils.speech_topics import identify_topic_for_speech

from .fetch import read_issue
from .models import person_line
from .resolver import SpeakerResolver
from .review_store import HeldItem, ReviewKey
from .state import write_atomic

log = logging.getLogger(__name__)

PERSONS_PREFIX = "repr_speeches_id_organized"
ALL_SPEECHES = "all_speeches"

Meeting = Tuple[dict, List[dict]]  # (meta, speeches) as stored under issues/


@dataclass
class RouteResult:
	issues: int = 0
	speeches: int = 0
	matched: int = 0
	disambiguated: int = 0
	procedural: int = 0
	non_member_skipped: int = 0
	unlinked: int = 0   # decided "not this person" in speaker_review
	held_speeches: int = 0
	added: int = 0      # new lines in all_speeches.jsonl files
	updated: int = 0    # replaced lines in all_speeches.jsonl files
	db_rows: int = 0
	persons: set = field(default_factory=set)
	paths_written: List[str] = field(default_factory=list)
	unmatched_members: List[dict] = field(default_factory=list)
	new_unmatched: List[dict] = field(default_factory=list)  # not seen in earlier runs
	routed_issues: List[str] = field(default_factory=list)
	held: Dict[ReviewKey, HeldItem] = field(default_factory=lambda: defaultdict(HeldItem))
	new_review: List[ReviewKey] = field(default_factory=list)  # keys first queued by this run


def iter_issues_from_disk(issues_dir: Path, issue_ids: Iterable[str]) -> Iterator[Meeting]:
	for issue_id in issue_ids:
		issue = read_issue(issues_dir / issue_id)
		if issue is None:
			log.warning("issue %s listed for routing but missing on disk; skipping", issue_id)
			continue
		yield issue


def sort_lines(lines: List[dict]) -> List[dict]:
	"""Meetings newest first (date desc, issueID desc), speechOrder ascending within one."""
	lines = sorted(lines, key=lambda l: l.get("speechOrder") or 0)
	return sorted(lines, key=lambda l: (l["meta"].get("date") or "", l["meta"].get("issueID") or ""), reverse=True)


def merge_person_file(path: Path, incoming: Dict[str, dict], dry_run: bool) -> Tuple[int, int, bool]:
	"""Merge `incoming` (speechID → line) into a jsonl file. Returns (added, updated, wrote)."""
	existing: List[dict] = []
	if path.exists():
		with open(path, encoding="utf-8") as f:
			existing = [json.loads(l) for l in f if l.strip()]
	index = {l["speechID"]: i for i, l in enumerate(existing)}
	added = updated = 0
	for speech_id, line in incoming.items():
		i = index.get(speech_id)
		if i is None:
			index[speech_id] = len(existing)
			existing.append(line)
			added += 1
			continue
		# keep fields other pipelines added to the line (is_relevant, is_productive,
		# quality_reason from process_relevance_data.py); NDL fields and meta are replaced
		merged = line | {k: v for k, v in existing[i].items() if k not in line}
		if existing[i] != merged:
			existing[i] = merged
			updated += 1
	if not (added or updated):
		return 0, 0, False
	if not dry_run:
		write_atomic(path, "".join(json.dumps(l, ensure_ascii=False) + "\n" for l in sort_lines(existing)))
	return added, updated, True


def remove_from_person_dir(persons_dir: Path, person_id: int, speech_ids: Set[str], dry_run: bool) -> Tuple[int, List[str]]:
	"""Drop `speech_ids` from every jsonl file of one person. Returns (lines removed from
	all_speeches, rel paths written). Files are rewritten, never deleted."""
	removed = 0
	written: List[str] = []
	person_dir = persons_dir / str(person_id)
	if not person_dir.is_dir():
		return 0, []
	for path in sorted(person_dir.glob("*.jsonl")):
		with open(path, encoding="utf-8") as f:
			lines = [l for l in f if l.strip()]
		kept = [l for l in lines if json.loads(l)["speechID"] not in speech_ids]
		if len(kept) == len(lines):
			continue
		if path.stem == ALL_SPEECHES:
			removed += len(lines) - len(kept)
		if not dry_run:
			write_atomic(path, "".join(kept))
		written.append(f"{PERSONS_PREFIX}/{person_id}/{path.name}")
	return removed, written


def to_db_row(speech: dict, meta: dict, person_id: int) -> Speech:
	return Speech(
		issue_id=meta["issueID"],
		name_of_house=meta.get("nameOfHouse") or "",
		name_of_meeting=meta.get("nameOfMeeting") or "",
		date=meta["date"],
		pdf_url=meta.get("pdfURL"),
		speech_id=speech["speechID"],
		speaker=speech["speaker"],
		speech=speech.get("speech") or "",
		speech_url=speech.get("speechURL") or "",
		person_id=PersonId(person_id),
	)


class Router:
	def __init__(
		self,
		resolver: SpeakerResolver,
		persons_dir: Path,
		topics: List[dict],
		dry_run: bool = False,
		write_files: bool = True,
		db_conn=None,
		db_table: str = "speeches",
		chunk_size: int = 300,
	):
		self.resolver = resolver
		self.persons_dir = persons_dir
		self.topics = topics
		self.dry_run = dry_run
		self.write_files = write_files
		self.db_conn = db_conn
		self.db_table = db_table
		self.chunk_size = chunk_size

	def route(self, meetings: Iterable[Meeting]) -> RouteResult:
		result = RouteResult()
		chunk: List[Meeting] = []
		for meeting in meetings:
			chunk.append(meeting)
			if len(chunk) >= self.chunk_size:
				self._route_chunk(chunk, result)
				chunk = []
		if chunk:
			self._route_chunk(chunk, result)
		return result

	def _route_chunk(self, meetings: List[Meeting], result: RouteResult) -> None:
		# person_id → file stem → speechID → line
		by_person: Dict[int, Dict[str, Dict[str, dict]]] = defaultdict(lambda: defaultdict(dict))
		db_rows: Dict[str, Speech] = {}
		seen_unmatched = {(u["speaker"], u["issueID"]) for u in result.unmatched_members}

		for meta, speeches in meetings:
			result.issues += 1
			result.routed_issues.append(meta["issueID"])
			for speech in speeches:
				result.speeches += 1
				res = self.resolver.resolve(speech.get("speaker"), speech.get("speakerYomi"), speech.get("speakerGroup"), meta["date"])
				if res.reason == "procedural":
					result.procedural += 1
					continue
				if res.reason == "unlinked":
					result.unlinked += 1
					continue
				if res.confidence == "review":
					result.held_speeches += 1
					result.held[res.review_key].add(speech, meta)
					continue
				if res.person_id is None:
					if not speech.get("speakerGroup"):
						# officials, witnesses, etc.: not Diet members
						result.non_member_skipped += 1
						continue
					if (speech["speaker"], meta["issueID"]) not in seen_unmatched:
						seen_unmatched.add((speech["speaker"], meta["issueID"]))
						result.unmatched_members.append({
							"speaker": speech["speaker"],
							"speakerYomi": speech.get("speakerYomi"),
							"speakerGroup": speech.get("speakerGroup"),
							"date": meta["date"],
							"issueID": meta["issueID"],
							"reason": res.reason,
						})
					continue
				result.matched += 1
				if res.reason == "disambiguated":
					result.disambiguated += 1
				if self.write_files:
					line = person_line(speech, meta)
					files = by_person[res.person_id]
					files[ALL_SPEECHES][speech["speechID"]] = line
					for topic in identify_topic_for_speech(speech.get("speech") or "", self.topics):
						files[topic][speech["speechID"]] = line
				if self.db_conn is not None:
					db_rows[speech["speechID"]] = to_db_row(speech, meta, res.person_id)

		for person_id, files in by_person.items():
			for stem, incoming in files.items():
				rel = f"{PERSONS_PREFIX}/{person_id}/{stem}.jsonl"
				added, updated, wrote = merge_person_file(self.persons_dir / str(person_id) / f"{stem}.jsonl", incoming, self.dry_run)
				if stem == ALL_SPEECHES:
					result.added += added
					result.updated += updated
				if wrote:
					result.persons.add(person_id)
					result.paths_written.append(rel)

		if db_rows and not self.dry_run:
			with self.db_conn.cursor() as cur:
				upsert_speeches_bulk(cur, list(db_rows.values()), table=self.db_table)
			self.db_conn.commit()
		result.db_rows += len(db_rows)
		log.info("routed %d issues so far: %d speeches matched, %d persons touched", result.issues, result.matched, len(result.persons))
