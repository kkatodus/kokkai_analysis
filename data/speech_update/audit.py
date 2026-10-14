"""Audit the whole mirror: speeches in issues/ that never reached their
politician's all_speeches.jsonl, and member speakers missing from `person`.

  python -m speech_update.audit [--queue]

Read-only unless --queue, which adds the issues with missing speeches to
changed_issues.json so `python -m speech_update route` files them.
Writes a report to s3_mirror/.speech-update/audit-YYYYMMDD.json.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
from collections import Counter, defaultdict
from datetime import date

from dotenv import load_dotenv

from .__main__ import connect_postgres
from .config import load_config
from .fetch import read_issue
from .resolver import SpeakerResolver
from .state import State, write_atomic

log = logging.getLogger("speech_update.audit")

SPEECH_ID_RE = re.compile(r'"speechID": "([^"]+)"')


def filed_speech_ids(persons_dir) -> dict:
	"""person_id → set of speechIDs in all_speeches.jsonl (regex, no full JSON parse)."""
	filed = {}
	for d in os.listdir(persons_dir):
		path = persons_dir / d / "all_speeches.jsonl"
		if not d.isdigit() or not path.exists():
			continue
		with open(path, encoding="utf-8") as f:
			filed[int(d)] = {m.group(1) for line in f if (m := SPEECH_ID_RE.search(line))}
	return filed


def main() -> int:
	parser = argparse.ArgumentParser()
	parser.add_argument("--queue", action="store_true", help="queue issues with missing speeches for `route`")
	args = parser.parse_args()
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

	cfg = load_config()
	load_dotenv(cfg.env_file)
	conn = connect_postgres()
	if conn is None:
		raise SystemExit("Postgres is not reachable")
	resolver = SpeakerResolver(conn.cursor())

	log.info("indexing filed speeches")
	filed = filed_speech_ids(cfg.persons_dir)
	log.info("%d person files, %d speeches", len(filed), sum(map(len, filed.values())))

	missing_by_person = Counter()
	issues_with_missing = set()
	unmatched = defaultdict(lambda: {"issues": set(), "speeches": 0, "groups": set(), "first": None, "last": None})
	totals = Counter()
	issue_ids = sorted(os.listdir(cfg.issues_dir))
	for n, issue_id in enumerate(issue_ids, 1):
		issue = read_issue(cfg.issues_dir / issue_id)
		if issue is None:
			totals["issues_unreadable"] += 1
			continue
		meta, speeches = issue
		for s in speeches:
			res = resolver.resolve(s.get("speaker"), s.get("speakerYomi"), s.get("speakerGroup"), meta["date"])
			if res.reason == "procedural":
				continue
			if res.person_id is None:
				if s.get("speakerGroup"):
					u = unmatched[(s["speaker"], s.get("speakerYomi"), res.reason)]
					u["issues"].add(issue_id)
					u["speeches"] += 1
					u["groups"].add(s["speakerGroup"])
					u["first"] = min(filter(None, [u["first"], meta["date"]]))
					u["last"] = max(filter(None, [u["last"], meta["date"]]))
					totals["unmatched_member_speeches"] += 1
				else:
					totals["non_member_speeches"] += 1
				continue
			totals["matched_speeches"] += 1
			if s["speechID"] not in filed.get(res.person_id, ()):
				missing_by_person[res.person_id] += 1
				issues_with_missing.add(issue_id)
		if n % 10000 == 0:
			log.info("%d/%d issues; %d matched speeches missing from person files so far", n, len(issue_ids), sum(missing_by_person.values()))

	report = {
		"date": date.today().isoformat(),
		"issues": len(issue_ids),
		**totals,
		"missing_from_person_files": sum(missing_by_person.values()),
		"persons_with_missing": len(missing_by_person),
		"issues_with_missing": len(issues_with_missing),
		"top_missing": [{"person_id": p, "missing": c} for p, c in missing_by_person.most_common(30)],
		"unmatched_members": sorted(
			(
				{"speaker": k[0], "speakerYomi": k[1], "reason": k[2], "speeches": v["speeches"], "issues": len(v["issues"]),
				 "groups": sorted(v["groups"]), "first": v["first"], "last": v["last"]}
				for k, v in unmatched.items()
			),
			key=lambda e: -e["speeches"],
		),
	}
	state = State(cfg.state_dir)
	out = cfg.state_dir / f"audit-{date.today():%Y%m%d}.json"
	write_atomic(out, json.dumps(report, ensure_ascii=False, indent=1) + "\n")
	write_atomic(cfg.state_dir / "audit-issues-with-missing.txt", "".join(i + "\n" for i in sorted(issues_with_missing)))
	log.info("report: %s", out)
	for k in ("issues", "matched_speeches", "missing_from_person_files", "persons_with_missing", "issues_with_missing", "unmatched_member_speeches"):
		log.info("  %s: %s", k, report.get(k))
	log.info("  distinct unmatched member speakers: %d", len(report["unmatched_members"]))
	if args.queue and issues_with_missing:
		state.add_pending_issues(issues_with_missing)
		log.info("queued %d issues for `python -m speech_update route`", len(issues_with_missing))
	conn.close()
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
