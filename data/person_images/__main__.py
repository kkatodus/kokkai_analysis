"""Portraits for every person in Postgres `person`, served from kokkai-doc/person_images/.

From data/:
  python -m person_images run [--limit N] [--refresh] [--no-upload] [--only-current]
  python -m person_images status

`run` reads persons from Postgres, the current members' profile links from the latest
parliamentMembers snapshots, fetches a portrait per person (House photo for current
members, else Wikimedia Commons via Wikidata), resizes it to ≤512 px JPEG, records the
source and licence in index.json, and uploads new files plus index.json to S3. It is
resumable: persons already in index.json are skipped unless --refresh.

Settings: SPEECH_UPDATE_MIRROR, SPEECH_UPDATE_BUCKET, SPEECH_UPDATE_S3_PREFIX,
SPEECH_UPDATE_AWS_PROFILE as for the speech updater; PERSON_IMAGES_LOG_DIR.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import List, Optional

from .job import Index, Person, run

log = logging.getLogger("person_images")


def load_persons(conn, members_dir: Path, only_current: bool = False) -> List[Person]:
	from member_update.snapshot import latest_snapshot, read_rows

	links = {}
	for house in ("shugiin", "sangiin"):
		for row in read_rows(latest_snapshot(members_dir, house)):
			if row.get("person_id") and row.get("link"):
				links[int(row["person_id"])] = row["link"]
	with conn.cursor() as cur:
		cur.execute("SELECT person_id, name_kanji, name_kana FROM person ORDER BY person_id")
		rows = cur.fetchall()
	persons = [Person(int(pid), kanji, kana, links.get(int(pid))) for pid, kanji, kana in rows]
	# current members first: their photos come from the House sites and matter most to the UI
	persons.sort(key=lambda p: (p.member_link is None, p.person_id))
	if only_current:
		persons = [p for p in persons if p.member_link]
	return persons


def main(argv: Optional[List[str]] = None) -> int:
	from dotenv import load_dotenv
	from speech_update.__main__ import connect_postgres
	from speech_update.config import load_config
	from speech_update.upload import Uploader

	p = argparse.ArgumentParser(prog="python -m person_images", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	sub = p.add_subparsers(dest="cmd", required=True)
	r = sub.add_parser("run")
	r.add_argument("--limit", type=int)
	r.add_argument("--refresh", action="store_true", help="re-fetch persons already in index.json")
	r.add_argument("--no-upload", action="store_true")
	r.add_argument("--only-current", action="store_true", help="current members only")
	sub.add_parser("status")
	args = p.parse_args(argv)

	cfg = load_config()
	load_dotenv(cfg.env_file)
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
	logging.getLogger("urllib3").setLevel(logging.WARNING)
	out_dir = cfg.mirror_root / "person_images"
	index = Index(out_dir / "index.json")

	if args.cmd == "status":
		counts = index.counts()
		print(f"{sum(counts.values())} persons recorded: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
		print(f"generated_at {index.data.get('generated_at')}; dir {out_dir}")
		return 0

	conn = connect_postgres()
	if conn is None:
		print("Postgres is not reachable", file=sys.stderr)
		return 1
	persons = load_persons(conn, cfg.mirror_root / "parliamentMembers", args.only_current)
	conn.close()
	log.info("%d persons, %d with a current-member profile link, %d already in index.json",
		len(persons), sum(1 for x in persons if x.member_link), len(index.data["persons"]))
	t0 = time.monotonic()

	def progress(i, n, rec):
		if i % 50 == 0 or i == n:
			rate = i / max(1e-9, time.monotonic() - t0)
			log.info("%d/%d (%.1f/s, ~%d min left)", i, n, rate, (n - i) / max(rate, 1e-9) / 60)

	stats = run(persons, out_dir, index, refresh=args.refresh, limit=args.limit, on_progress=progress)
	counts = index.counts()
	print(f"fetched {stats['done']}: {stats['found']} with a picture, {stats['none']} without; "
		f"index now {sum(counts.values())} persons (" + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) + ")")
	if not args.no_upload and (index.dirty or stats["done"]):
		paths = sorted(set(index.dirty)) + ["person_images/index.json"]
		n = Uploader(cfg.mirror_root, cfg.bucket, cfg.s3_prefix, cfg.aws_profile).upload(paths, on_done=lambda done: None)
		print(f"uploaded {n} file(s) to s3://{cfg.bucket}/{cfg.s3_prefix}/person_images/")
	return 0


if __name__ == "__main__":
	sys.exit(main())
