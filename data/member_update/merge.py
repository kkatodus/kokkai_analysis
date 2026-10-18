"""Merge a duplicate `person` into the one to keep (`python -m member_update merge DROP KEEP`).

Postgres, one transaction: DROP's elections move to KEEP unless KEEP already has
that election (same date and district: dropped as a duplicate); speeches,
`x_account`, `speaker_review` and `person_alias` rows move; DROP's name becomes
a `person_alias` of KEEP; the DROP person row is deleted.

Mirror: repr_speeches_id_organized/DROP/*.jsonl lines are merged into KEEP's files
of the same name (by speechID, in the router's order); electionHistory/KEEP.jsonl
is rewritten from Postgres; DROP's row leaves politicians/table.csv(.gz); every
parliamentMembers snapshot and links.json point at KEEP. Everything touched is
copied to .member-update/backups/merge-DROP-into-KEEP-<time>/ first.

DROP's own files are removed from the mirror only. The upload credentials can't
delete, so the S3 keys to delete are listed in the backup folder (`s3_delete.txt`).
"""
from __future__ import annotations

import gzip
import json
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from speech_update import aliases
from speech_update.route import merge_person_file
from speech_update.state import write_atomic

from . import snapshot
from .config import Config
from .people import history_lines, write_atomic_bytes

SPEECH_DIR = "repr_speeches_id_organized"


@dataclass
class MergeResult:
	elections_moved: int = 0
	elections_dropped: int = 0
	speeches_moved: int = 0
	lines_added: Dict[str, int] = field(default_factory=dict)
	changed: List[str] = field(default_factory=list)  # mirror paths to upload
	s3_delete: List[str] = field(default_factory=list)  # mirror paths that no longer exist
	backup_dir: Path = None


def merge_db(cur, drop: int, keep: int, alias_kind: str) -> MergeResult:
	res = MergeResult()
	cur.execute("SELECT person_id, name_kanji, name_kana FROM person WHERE person_id IN (%s, %s)", (drop, keep))
	people = {pid: (k, kn) for pid, k, kn in cur.fetchall()}
	for pid in (drop, keep):
		if pid not in people:
			raise ValueError(f"no person {pid}")

	cur.execute(
		"""DELETE FROM election_result d USING election_result k
		WHERE d.person_id = %s AND k.person_id = %s
		AND d.election_date = k.election_date AND coalesce(d.district, '') = coalesce(k.district, '')""",
		(drop, keep),
	)
	res.elections_dropped = cur.rowcount
	cur.execute("UPDATE election_result SET person_id = %s WHERE person_id = %s", (keep, drop))
	res.elections_moved = cur.rowcount

	cur.execute("UPDATE speeches SET person_id = %s WHERE person_id = %s", (keep, drop))
	res.speeches_moved = cur.rowcount
	cur.execute("UPDATE speeches_pre_repair SET person_id = %s WHERE person_id = %s", (keep, drop))
	cur.execute("SELECT 1 FROM x_account WHERE person_id = %s", (keep,))
	if cur.fetchone():
		cur.execute("DELETE FROM x_account WHERE person_id = %s", (drop,))
	else:
		cur.execute("UPDATE x_account SET person_id = %s WHERE person_id = %s", (keep, drop))

	cur.execute("SELECT to_regclass('speaker_review')")
	if cur.fetchone()[0]:
		# a review row about DROP that already exists for KEEP is the same question
		cur.execute(
			"""DELETE FROM speaker_review d USING speaker_review k
			WHERE d.person_id = %s AND k.person_id = %s
			AND (d.speaker, d.speaker_yomi, d.reason) = (k.speaker, k.speaker_yomi, k.reason)""",
			(drop, keep),
		)
		for col in ("person_id", "new_person_id", "applied_person_id"):
			cur.execute(f"UPDATE speaker_review SET {col} = %s WHERE {col} = %s", (keep, drop))
		cur.execute("UPDATE speaker_review SET status = 'confirmed', new_person_id = NULL WHERE status = 'reassigned' AND new_person_id = person_id")

	aliases.ensure_table(cur)
	cur.execute(
		"""INSERT INTO person_alias (person_id, name_kanji, name_kana, kind, source, note, created_at)
		SELECT %s, name_kanji, name_kana, kind, source, note, created_at FROM person_alias WHERE person_id = %s
		ON CONFLICT DO NOTHING""",
		(keep, drop),
	)
	cur.execute("DELETE FROM person_alias WHERE person_id = %s", (drop,))
	kanji, kana = people[drop]
	if (kanji, kana) != people[keep]:
		aliases.add(cur, keep, kanji, kana, alias_kind, f"merge #{drop}")
	cur.execute("DELETE FROM person WHERE person_id = %s", (drop,))
	return res


def merge_speech_files(mirror: Path, drop: int, keep: int, res: MergeResult) -> None:
	drop_dir, keep_dir = mirror / SPEECH_DIR / str(drop), mirror / SPEECH_DIR / str(keep)
	if not drop_dir.is_dir():
		return
	keep_dir.mkdir(exist_ok=True)
	for src in sorted(drop_dir.glob("*.jsonl")):
		with open(src, encoding="utf-8") as f:
			incoming = {l["speechID"]: l for l in (json.loads(x) for x in f if x.strip())}
		added, _, wrote = merge_person_file(keep_dir / src.name, incoming, dry_run=False)
		if wrote:
			res.lines_added[src.name] = added
			res.changed.append(str((keep_dir / src.name).relative_to(mirror)))
		res.s3_delete.append(str(src.relative_to(mirror)))
	shutil.rmtree(drop_dir)


def rewrite_member_files(cfg: Config, drop: int, keep: int, res: MergeResult) -> None:
	mirror = cfg.mirror_root
	for path in sorted(cfg.members_dir.glob("*.json")):
		if not snapshot.SNAPSHOT_RE.match(path.name):
			continue
		rows = snapshot.read_rows(path)
		hits = [r for r in rows if r.get("person_id") == drop]
		if hits:
			for r in hits:
				r["person_id"] = keep
			snapshot.write_snapshot(path, rows)
			res.changed.append(str(path.relative_to(mirror)))

	table = cfg.table_csv
	lines = table.read_text(encoding="utf-8", newline="").splitlines(keepends=True)
	kept = [l for l in lines if not l.startswith(f"{drop},")]
	if len(kept) != len(lines):
		text = "".join(kept)
		write_atomic_bytes(table, text.encode("utf-8"))
		write_atomic_bytes(table.with_name(table.name + ".gz"), gzip.compress(text.encode("utf-8"), mtime=0))
		res.changed += [str(table.relative_to(mirror)), str(table.relative_to(mirror)) + ".gz"]

	links_file = cfg.state_dir / "links.json"
	if links_file.exists():
		links = json.loads(links_file.read_text(encoding="utf-8"))
		if drop in links.values():
			links = {k: (keep if v == drop else v) for k, v in links.items()}
			write_atomic(links_file, json.dumps(links, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def backup(cfg: Config, drop: int, keep: int, cur) -> Path:
	mirror = cfg.mirror_root
	out = cfg.state_dir / "backups" / f"merge-{drop}-into-{keep}-{datetime.now():%Y%m%d-%H%M%S}"
	out.mkdir(parents=True)
	for pid in (drop, keep):
		d = mirror / SPEECH_DIR / str(pid)
		if d.is_dir():
			shutil.copytree(d, out / SPEECH_DIR / str(pid))
		h = cfg.history_dir / f"{pid}.jsonl"
		if h.exists():
			(out / "electionHistory").mkdir(exist_ok=True)
			shutil.copy2(h, out / "electionHistory" / h.name)
	shutil.copytree(cfg.members_dir, out / "parliamentMembers")
	shutil.copy2(cfg.table_csv, out / "table.csv")
	if (cfg.state_dir / "links.json").exists():
		shutil.copy2(cfg.state_dir / "links.json", out / "links.json")
	rows = {}
	for table in ("person", "election_result", "x_account", "speaker_review", "person_alias"):
		cur.execute("SELECT to_regclass(%s)", (table,))
		if cur.fetchone()[0]:
			cur.execute(f"SELECT row_to_json(t) FROM {table} t WHERE person_id IN (%s, %s)", (drop, keep))
			rows[table] = [r[0] for r in cur.fetchall()]
	(out / "db_rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
	return out


def merge(cfg: Config, conn, drop: int, keep: int, alias_kind: str = "other") -> MergeResult:
	if drop == keep:
		raise ValueError("DROP and KEEP are the same person")
	with conn.cursor() as cur:
		backup_dir = backup(cfg, drop, keep, cur)
	with conn:
		with conn.cursor() as cur:
			res = merge_db(cur, drop, keep, alias_kind)
			history = history_lines(cur, keep)
	res.backup_dir = backup_dir
	mirror = cfg.mirror_root
	merge_speech_files(mirror, drop, keep, res)
	keep_history = cfg.history_dir / f"{keep}.jsonl"
	write_atomic(keep_history, history)
	res.changed.append(str(keep_history.relative_to(mirror)))
	drop_history = cfg.history_dir / f"{drop}.jsonl"
	if drop_history.exists():
		drop_history.unlink()
		res.s3_delete.append(str(drop_history.relative_to(mirror)))
	rewrite_member_files(cfg, drop, keep, res)
	(backup_dir / "s3_delete.txt").write_text("".join(p + "\n" for p in res.s3_delete), encoding="utf-8")
	return res
