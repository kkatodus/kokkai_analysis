"""Current members and point metadata (spec §4.6).

Current = union of person_ids in the latest parliamentMembers/shugiin_*.json and
sangiin_*.json. Everyone else gets name/kana from Postgres `person` and party/house from
their latest winning election_result.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, Iterable, Optional

log = logging.getLogger("topic_scaling.members")

# kaiha / party → the short party label the ideology file has always used, and its colour
PARTY_SHORT = {
	"自由民主党": "自民", "自民": "自民", "自民党": "自民",
	"立憲民主党": "立憲", "立憲": "立憲", "旧立憲民主党": "立憲", "民主党": "民主", "民進党": "民進",
	"公明党": "公明", "公明": "公明",
	"日本共産党": "共産", "共産": "共産",
	"日本維新の会": "維新", "維新": "維新", "おおさか維新の会": "維新", "日本維신の会": "維新",
	"国民民主党": "国民", "国民": "国民",
	"れいわ新選組": "れ新", "れ新": "れ新",
	"社会民主党": "社民", "社民": "社民",
	"参政党": "参政", "参政": "参政",
	"日本保守党": "保守", "保守": "保守",
	"NHK党": "N党", "N党": "N党", "Ｎ党": "N党", "NHKから国民を守る党": "N党",
	"チームみらい": "みらい", "みらい": "みらい",
	"中道改革連合": "中道", "中道": "中道",
	"希望の党": "希望", "無所属": "無所属", "無": "無所属",
	"有志": "有志", "沖縄": "沖縄", "女子": "女子",
}
PARTY_COLOR = {
	"自民": "black", "国民": "blue", "立憲": "orange", "公明": "lightblue", "共産": "red", "維新": "gold",
	"れ新": "green", "無所属": "purple", "有志": "grey", "沖縄": "pink", "女子": "violet", "保守": "brown",
	"参政": "cyan", "N党": "lightcoral", "社民": "deeppink", "みらい": "teal", "中道": "olive", "民主": "blue",
	"民進": "blue", "希望": "darkgreen",
}
DEFAULT_COLOR = "grey"


def short_party(name: Optional[str]) -> str:
	if not name:
		return "無所属"
	n = name.strip()
	if n in PARTY_SHORT:
		return PARTY_SHORT[n]
	for k, v in PARTY_SHORT.items():
		if len(k) >= 2 and k in n:
			return v
	return n[:3]


def latest_snapshot(members_dir: Path, house: str) -> Optional[Path]:
	files = sorted(members_dir.glob(f"{house}_*.json"))
	return files[-1] if files else None


def current_members(members_dir: Path) -> Dict[int, dict]:
	"""person_id → {house, party, name, kana, snapshot}"""
	out: Dict[int, dict] = {}
	for house, label in (("shugiin", "lower"), ("sangiin", "upper")):
		path = latest_snapshot(members_dir, house)
		if path is None:
			log.warning("no %s snapshot in %s", house, members_dir)
			continue
		with open(path, encoding="utf-8") as f:
			reprs = json.load(f).get("reprs") or []
		for r in reprs:
			pid = r.get("person_id")
			if pid is None:
				continue
			out[int(pid)] = {
				"house": label, "party": short_party(r.get("kaiha")), "party_full": r.get("kaiha"),
				"name": re.sub(r"\s+", "", r.get("name") or ""), "kana": re.sub(r"\s+", "", r.get("yomikata") or ""),
				"snapshot": path.name,
			}
	return out


def snapshot_date(members_dir: Path) -> Optional[str]:
	dates = []
	for house in ("shugiin", "sangiin"):
		p = latest_snapshot(members_dir, house)
		if p:
			m = re.search(r"(\d{8})", p.name)
			if m:
				d = m.group(1)
				dates.append(f"{d[:4]}-{d[4:6]}-{d[6:]}")
	return min(dates) if dates else None


def persons_from_db(conn, person_ids: Iterable[int]) -> Dict[int, dict]:
	"""name/kana and the latest winning election's party + house for non-current politicians."""
	ids = sorted({int(p) for p in person_ids})
	if not ids or conn is None:
		return {}
	out: Dict[int, dict] = {}
	with conn.cursor() as cur:
		cur.execute("SELECT person_id, name_kanji, name_kana FROM person WHERE person_id = ANY(%s)", (ids,))
		for pid, kanji, kana in cur.fetchall():
			out[int(pid)] = {"name": kanji, "kana": kana or "", "party": "無所属", "party_full": None, "house": ""}
		cur.execute("""SELECT DISTINCT ON (person_id) person_id, party, election_name FROM election_result
			WHERE person_id = ANY(%s) AND result = '当選' ORDER BY person_id, election_date DESC""", (ids,))
		for pid, party, election_name in cur.fetchall():
			if int(pid) in out:
				out[int(pid)]["party"] = short_party(party)
				out[int(pid)]["party_full"] = party
				out[int(pid)]["house"] = "upper" if "参議院" in (election_name or "") else "lower"
	return out
