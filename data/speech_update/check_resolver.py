"""Resolver regression check (spec §7): replay speakers from existing
repr_speeches_id_organized/{person_id}/all_speeches.jsonl files through
SpeakerResolver and count how often it returns the directory's person_id.

  python -m speech_update.check_resolver [--sample N] [--seed S]
"""
from __future__ import annotations

import argparse
import json
import os
import random
from collections import Counter

from dotenv import load_dotenv

from .__main__ import connect_postgres
from .config import load_config
from .resolver import SpeakerResolver


def main() -> int:
	parser = argparse.ArgumentParser()
	parser.add_argument("--sample", type=int, default=300, help="person directories to check (0 = all)")
	parser.add_argument("--seed", type=int, default=0)
	args = parser.parse_args()

	cfg = load_config()
	load_dotenv(cfg.env_file)
	conn = connect_postgres()
	if conn is None:
		raise SystemExit("Postgres is not reachable")
	resolver = SpeakerResolver(conn.cursor())

	person_dirs = sorted(d for d in os.listdir(cfg.persons_dir) if d.isdigit())
	if args.sample:
		person_dirs = random.Random(args.seed).sample(person_dirs, min(args.sample, len(person_dirs)))

	outcome = Counter()
	mismatches = Counter()
	for d in person_dirs:
		seen = set()
		with open(cfg.persons_dir / d / "all_speeches.jsonl", encoding="utf-8") as f:
			for line in f:
				s = json.loads(line)
				key = (s["speaker"], s.get("speakerYomi"), s.get("speakerGroup"), s["meta"]["date"])
				if key in seen:
					continue
				seen.add(key)
				res = resolver.resolve(*key)
				if res.person_id == int(d):
					outcome["agree"] += 1
				else:
					outcome[f"differs:{res.reason}"] += 1
					mismatches[(d, s["speaker"], s.get("speakerGroup"), res.person_id, res.reason)] += 1
	total = sum(outcome.values())
	print(f"{len(person_dirs)} person dirs, {total} distinct (speaker, yomi, group, date) keys")
	for k, v in outcome.most_common():
		print(f"  {k}: {v} ({v / total:.2%})")
	for (d, speaker, group, pid, reason), n in mismatches.most_common(30):
		print(f"  dir {d}: {speaker} [{group}] → {pid} ({reason}) ×{n}")
	conn.close()
	return 0 if outcome["agree"] / max(total, 1) >= 0.99 else 1


if __name__ == "__main__":
	raise SystemExit(main())
