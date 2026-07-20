#!/usr/bin/env python3
"""Match UTAS candidates to kokkaidoc `person` rows (person_id).

Prerequisite for the POLIS headline metric (spec §4.4) and shared with
`specs/ensemble-scaling-reliability`: turns a UTAS wave CSV into a
{utas_id -> person_id} map so a politician's survey answers can be tied to
their scaling position / persona adapter.

UTAS name fields are Shift-JIS with separators (verified in HANDOVER):
  NAME = "小林＝悟"  (＝ between surname/given)
  KANA = "こばやし・さとる"  (・ between surname/given, hiragana)
The DB `person` table stores cleaned, separator-free names:
  name_kanji = "小林悟",  name_kana = "こばやしさとる" (hiragana).

Matching is tiered (mirrors dbio.get_politician_id_by_name):
  1. exact kanji match, unique             -> accept (tier "kanji")
  2. exact kanji match, multiple + kana narrows to 1 -> accept ("kanji+kana")
  3. exact kana match, unique              -> accept ("kana")
  4. otherwise pg_trgm closest             -> record for review ("fuzzy"/"none")

Only tiers 1-3 are written as confident matches; ambiguous / fuzzy rows go to
a sidecar review file for a human to resolve (never silently guessed).

Run with the system python3 (has psycopg2); reads PSQL_DATABASE_PASSWORD from
data/.env.

  python3 match_utas_to_person.py --wave 2024HoR
  python3 match_utas_to_person.py --wave all
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dbio.representative_db import (  # noqa: E402
    connect_db,
    get_person_by_column,
    get_closest_person_by_name,
)
from utils.string_process import clean_repr_name  # noqa: E402

DATA_ROOT = Path(__file__).resolve().parent / "data" / "u-tokyo-asahi"
OUT_ROOT = DATA_ROOT / "person_map"

# Separators/whitespace to strip from UTAS name fields before matching.
_SEP = re.compile(r"[＝=・　\s]+")

# Katakana -> hiragana (in case a wave stores KANA in katakana).
def _to_hiragana(s: str) -> str:
    out = []
    for ch in s:
        o = ord(ch)
        if 0x30A1 <= o <= 0x30F6:  # katakana block that maps 1:1 to hiragana
            out.append(chr(o - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def norm_kanji(name: str) -> str:
    return clean_repr_name(_SEP.sub("", name or "")).strip()


def norm_kana(kana: str) -> str:
    return _to_hiragana(_SEP.sub("", kana or "")).strip()


def load_utas_wave(wave: str) -> list[dict]:
    """Return [{utas_id, name_raw, kana_raw, party_code, prefec, district}]."""
    matches = sorted(glob.glob(str(DATA_ROOT / wave / "*.csv")))
    if not matches:
        raise FileNotFoundError(f"no CSV under {DATA_ROOT / wave}")
    path = matches[0]
    rows = []
    with open(path, encoding="shift_jis", errors="replace") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        idx = {c.upper(): i for i, c in enumerate(header)}
        for c in ["ID", "NAME"]:
            if c not in idx:
                raise KeyError(f"{wave}: missing column {c} (have {header[:12]}...)")
        # KANA/PREFEC/PARTY are absent in the HoC waves; matching falls back to
        # kanji-only there.

        def get(row, col):
            i = idx.get(col)
            return row[i] if i is not None and i < len(row) else ""

        for row in reader:
            if not any(row):
                continue
            uid = get(row, "ID").strip()
            if not uid:
                continue
            rows.append({
                "utas_id": uid,
                "name_raw": get(row, "NAME").strip(),
                "kana_raw": get(row, "KANA").strip(),
                "party_code": get(row, "PARTY").strip(),
                "prefec": get(row, "PREFEC").strip(),
                "district": get(row, "DISTRICT").strip(),
            })
    return rows, os.path.basename(path)


def match_one(cur, cand: dict) -> dict:
    nk = norm_kanji(cand["name_raw"])
    nkana = norm_kana(cand["kana_raw"])

    by_kanji = get_person_by_column(cur, "name_kanji", nk) if nk else []
    if len(by_kanji) == 1:
        return _hit(cand, by_kanji[0], "kanji", nk, nkana)
    if len(by_kanji) > 1:
        # disambiguate by kana
        narrowed = [p for p in by_kanji if norm_kana(p.name_kana or "") == nkana]
        if len(narrowed) == 1:
            return _hit(cand, narrowed[0], "kanji+kana", nk, nkana,
                        note=f"{len(by_kanji)} kanji homonyms, kana-narrowed")
        return _miss(cand, "ambiguous_kanji", nk, nkana,
                     candidates=by_kanji,
                     note=f"{len(by_kanji)} kanji matches, kana narrowed to {len(narrowed)}")

    by_kana = get_person_by_column(cur, "name_kana", nkana) if nkana else []
    if len(by_kana) == 1:
        return _hit(cand, by_kana[0], "kana", nk, nkana,
                    note="no kanji match; unique kana match")
    if len(by_kana) > 1:
        return _miss(cand, "ambiguous_kana", nk, nkana, candidates=by_kana,
                     note=f"{len(by_kana)} kana matches, no kanji match")

    # fuzzy fallback for review only
    close = get_closest_person_by_name(cur, nk or nkana, limit=5)
    top = close[0] if close else None
    return _miss(cand, "fuzzy" if top and top.score > 0 else "none", nk, nkana,
                 candidates=[pm.person for pm in close],
                 scores=[round(pm.score, 3) for pm in close],
                 note="review: closest pg_trgm candidates")


def _person_brief(p) -> dict:
    return {"person_id": int(p.person_id), "name_kanji": p.name_kanji,
            "name_kana": p.name_kana}


def _hit(cand, person, tier, nk, nkana, note="") -> dict:
    return {**_base(cand, tier, nk, nkana, note),
            "matched": True,
            "person_id": int(person.person_id),
            "db_name_kanji": person.name_kanji,
            "db_name_kana": person.name_kana}


def _miss(cand, tier, nk, nkana, candidates=None, scores=None, note="") -> dict:
    d = {**_base(cand, tier, nk, nkana, note),
         "matched": False, "person_id": None}
    if candidates:
        d["candidates"] = [_person_brief(p) for p in candidates[:5]]
    if scores:
        d["scores"] = scores
    return d


def _base(cand, tier, nk, nkana, note) -> dict:
    return {"utas_id": cand["utas_id"], "name_raw": cand["name_raw"],
            "kana_raw": cand["kana_raw"], "party_code": cand["party_code"],
            "norm_kanji": nk, "norm_kana": nkana, "tier": tier, "note": note}


def run_wave(cur, wave: str) -> dict:
    cands, src = load_utas_wave(wave)
    results = [match_one(cur, c) for c in cands]
    hits = [r for r in results if r["matched"]]
    misses = [r for r in results if not r["matched"]]

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    # Confident map: utas_id -> person_id (+ minimal provenance)
    mapping = {r["utas_id"]: {
        "person_id": r["person_id"], "tier": r["tier"],
        "name_raw": r["name_raw"], "db_name_kanji": r["db_name_kanji"],
    } for r in hits}
    map_path = OUT_ROOT / f"{wave}.json"
    with open(map_path, "w", encoding="utf-8") as fh:
        json.dump({"wave": wave, "source_csv": src,
                   "n_candidates": len(cands), "n_matched": len(hits),
                   "map": mapping}, fh, ensure_ascii=False, indent=2)

    review_path = OUT_ROOT / f"{wave}.review.json"
    with open(review_path, "w", encoding="utf-8") as fh:
        json.dump({"wave": wave, "source_csv": src, "unmatched": misses},
                  fh, ensure_ascii=False, indent=2)

    tiers = {}
    for r in results:
        tiers[r["tier"]] = tiers.get(r["tier"], 0) + 1
    return {"wave": wave, "candidates": len(cands), "matched": len(hits),
            "unmatched": len(misses), "tiers": tiers,
            "map_path": str(map_path), "review_path": str(review_path)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wave", default="2024HoR",
                    help="UTAS wave dir name (e.g. 2024HoR) or 'all'")
    args = ap.parse_args()

    # Load DB password from data/.env without extra deps.
    env = Path(__file__).resolve().parent / ".env"
    pw = os.environ.get("PSQL_DATABASE_PASSWORD")
    if not pw and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith("PSQL_DATABASE_PASSWORD"):
                pw = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    conn = connect_db(password=pw) if pw else connect_db()
    cur = conn.cursor()

    if args.wave == "all":
        waves = sorted(d.name for d in DATA_ROOT.iterdir() if d.is_dir()
                       and d.name != "person_map")
    else:
        waves = [args.wave]

    for wave in waves:
        summary = run_wave(cur, wave)
        pct = 100 * summary["matched"] / summary["candidates"] if summary["candidates"] else 0
        print(f"[{wave}] {summary['matched']}/{summary['candidates']} "
              f"({pct:.1f}%) matched  tiers={summary['tiers']}")
        print(f"        map    -> {summary['map_path']}")
        print(f"        review -> {summary['review_path']}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
