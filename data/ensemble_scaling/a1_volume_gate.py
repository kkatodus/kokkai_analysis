#!/usr/bin/env python
# coding: utf-8
"""A1 — Topic volume gate for the Ensemble Scaling Reliability paper.

Spec: specs/ensemble-scaling-reliability/ (work item A1, gate G3).

Question this answers
---------------------
For the House of Representatives 49th-term cohort (2021-2024), how much
substantive per-(politician, topic) speech volume exists? This sets the
minimum-text threshold and decides G3 — whether 夫婦別姓 (FamilySeparate)
and LGBT have enough coverage to be included alongside the committed topics
Defence + NuclearPower.

Cohort
------
The 496 winners of 第49回衆議院議員総選挙 (`result = 当選`), exported from the
local Postgres `kokkaidoc` DB into a1_cohort_49th_hor.csv. `person_id` there is
the directory key under data/data/repr_speeches_id_organized/{person_id}/.

Volume definition
-----------------
Topic membership comes from the precomputed
repr_speeches_id_organized/{person_id}/{Topic}.jsonl files (one speech per line;
`meta.date` and `meta.nameOfHouse` are embedded). The current summarization
pipeline (data/create_idea_summaries.py) reads *all history*, but the reliability
paper's corpus is term-scoped, so we report term-filtered counts:

  n_alltime      : every speech in the topic jsonl
  n_term_hor     : speeches with meta.date in the 49th-term window AND
                   meta.nameOfHouse == 衆議院 (the House the cohort sits in)
  chars_term_hor : total characters of those term/house speeches
  searchword_segs: sentence segments (split on 。) within term/house speeches
                   that contain >=1 topic search word. This is a cheap UPPER
                   BOUND on the opinion-sentence count that create_idea_summaries
                   gates on (MIN_OPINIONS=3), skipping the BERT opinion-class
                   filter, which only ever removes segments. If a (person, topic)
                   has < MIN_OPINIONS searchword segments it CANNOT clear the
                   real gate.

Outputs (specs/ensemble-scaling-reliability/artifacts/)
  a1_volume_by_person_topic.csv  : one row per (person_id, topic) with counts
  a1_volume_summary.md           : distribution tables + G3 recommendation
"""

import csv
import json
import os
import re
import statistics
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DATA = os.path.join(REPO_ROOT, "data", "data")
ORGANIZED_DIR = os.path.join(DATA_DATA, "repr_speeches_id_organized")
CONFIG_PATH = os.path.join(REPO_ROOT, "data", "resource", "experiment_config.json")
ARTIFACTS_DIR = os.path.join(
    REPO_ROOT, "specs", "ensemble-scaling-reliability", "artifacts"
)
COHORT_CSV = os.path.join(ARTIFACTS_DIR, "a1_cohort_49th_hor.csv")

# 49th HoR term: general election 2021-10-31; special Diet session convened
# 2021-11-10; dissolved 2024-10-09 for the 50th general election.
TERM_START = "2021-11-10"
TERM_END = "2024-10-09"
HOUSE = "衆議院"

# Topics of interest for the paper. Defence + NuclearPower are committed;
# FamilySeparate + LGBT are conditional on this gate (G3). We compute all
# configured topics for context.
COMMITTED = ["Defence", "NuclearPower"]
CONDITIONAL = ["FamilySeparate", "LGBT"]
# thresholds (n_term_hor speeches) reported in the coverage table
THRESHOLDS = [1, 3, 5, 10]


def load_search_words() -> dict[str, list[str]]:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    lookup = {}
    for topic in config:
        en = topic.get("topic_name_en")
        if en:
            lookup[en] = topic.get("search_words", [])
    return lookup


def load_cohort() -> list[dict]:
    """Unique winners. Dual-candidacy (重複立候補) members can have two
    election_result rows (SMD + PR block); dedupe on person_id so coverage
    denominators count politicians, not candidacies."""
    seen: dict[str, dict] = {}
    with open(COHORT_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            seen.setdefault(r["person_id"], r)
    return list(seen.values())


def in_term(date: str | None) -> bool:
    # ISO dates compare correctly as strings
    return bool(date) and TERM_START <= date <= TERM_END


def count_person_topic(
    person_id: str, topic: str, search_words: list[str]
) -> dict | None:
    path = os.path.join(ORGANIZED_DIR, person_id, f"{topic}.jsonl")
    if not os.path.exists(path):
        return None
    n_alltime = n_term_hor = chars_term_hor = searchword_segs = 0
    n_term_other_house = 0  # in-term but delivered in 参議院 (ministerial answers etc.)
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            speech = json.loads(line)
            n_alltime += 1
            meta = speech.get("meta") or {}
            date = meta.get("date") or speech.get("date")
            house = meta.get("nameOfHouse")
            if not in_term(date):
                continue
            if house != HOUSE:
                n_term_other_house += 1
                continue
            n_term_hor += 1
            text = speech.get("speech", "") or ""
            chars_term_hor += len(text)
            for seg in text.split("。"):
                seg = seg.strip()
                if seg and any(w in seg for w in search_words):
                    searchword_segs += 1
    return {
        "person_id": person_id,
        "topic": topic,
        "n_alltime": n_alltime,
        "n_term_hor": n_term_hor,
        "chars_term_hor": chars_term_hor,
        "searchword_segs": searchword_segs,
        "n_term_other_house": n_term_other_house,
    }


def pct(n: int, total: int) -> str:
    return f"{100 * n / total:.1f}%" if total else "-"


def main() -> None:
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    search_lookup = load_search_words()
    cohort = load_cohort()
    person_party = {r["person_id"]: r["party"] for r in cohort}
    topics = COMMITTED + CONDITIONAL
    print(f"Cohort: {len(cohort)} members | topics: {topics}")

    rows: list[dict] = []
    missing_dir = 0
    for r in cohort:
        pid = r["person_id"]
        if not os.path.isdir(os.path.join(ORGANIZED_DIR, pid)):
            missing_dir += 1
            continue
        for topic in topics:
            search_words = search_lookup.get(topic, [])
            counts = count_person_topic(pid, topic, search_words)
            if counts is None:
                # no jsonl for this (person, topic) == zero volume
                counts = {
                    "person_id": pid,
                    "topic": topic,
                    "n_alltime": 0,
                    "n_term_hor": 0,
                    "chars_term_hor": 0,
                    "searchword_segs": 0,
                    "n_term_other_house": 0,
                }
            counts["party"] = person_party.get(pid, "")
            rows.append(counts)

    # write per-(person, topic) CSV
    out_csv = os.path.join(ARTIFACTS_DIR, "a1_volume_by_person_topic.csv")
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "person_id",
                "party",
                "topic",
                "n_alltime",
                "n_term_hor",
                "chars_term_hor",
                "searchword_segs",
                "n_term_other_house",
            ],
        )
        w.writeheader()
        for row in rows:
            w.writerow(row)
    print(f"Wrote {out_csv} ({len(rows)} rows; {missing_dir} cohort dirs missing)")

    # ---- build summary ----
    by_topic: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_topic[row["topic"]].append(row)

    n_cohort = len(cohort) - missing_dir
    lines: list[str] = []
    lines.append("# A1 — Topic volume gate (G3)\n")
    lines.append(
        f"Cohort: **{n_cohort}** members of 第49回衆議院議員総選挙 (当選) with a "
        f"speech directory ({missing_dir} of {len(cohort)} had no directory).\n"
    )
    lines.append(
        f"Term window: **{TERM_START} → {TERM_END}**, house = **{HOUSE}**. "
        "Volume = speeches in each topic jsonl restricted to that window/house. "
        "`searchword_segs` is an upper bound on the opinion count the pipeline "
        "gates on (`MIN_OPINIONS=3`).\n"
    )

    # coverage table: how many cohort members clear each speech threshold
    lines.append("## Coverage — cohort members with n_term_hor speeches ≥ threshold\n")
    header = "| Topic | " + " | ".join(f"≥{t}" for t in THRESHOLDS) + " | ≥3 opinion-seg (UB) |"
    sep = "|---|" + "|".join("---" for _ in THRESHOLDS) + "|---|"
    lines.append(header)
    lines.append(sep)
    for topic in topics:
        trows = by_topic[topic]
        cells = []
        for t in THRESHOLDS:
            c = sum(1 for r in trows if r["n_term_hor"] >= t)
            cells.append(f"{c} ({pct(c, n_cohort)})")
        seg3 = sum(1 for r in trows if r["searchword_segs"] >= 3)
        tag = " ✅committed" if topic in COMMITTED else " ⚠️conditional"
        lines.append(
            f"| **{topic}**{tag} | " + " | ".join(cells) + f" | {seg3} ({pct(seg3, n_cohort)}) |"
        )
    lines.append("")

    # volume distribution among members with >=1 speech
    lines.append("## Volume distribution (members with ≥1 term speech)\n")
    lines.append("| Topic | n>0 | median | mean | p90 | max | total speeches |")
    lines.append("|---|---|---|---|---|---|---|")
    for topic in topics:
        vals = [r["n_term_hor"] for r in by_topic[topic] if r["n_term_hor"] > 0]
        if vals:
            lines.append(
                f"| {topic} | {len(vals)} | {statistics.median(vals):.0f} | "
                f"{statistics.mean(vals):.1f} | "
                f"{sorted(vals)[int(0.9 * (len(vals) - 1))]} | {max(vals)} | {sum(vals)} |"
            )
        else:
            lines.append(f"| {topic} | 0 | - | - | - | - | 0 |")
    lines.append("")

    # term-scoping impact: how much data all-history vs term
    lines.append("## Term-scoping impact (all-history vs 49th-term-HoR speeches)\n")
    lines.append("| Topic | Σ n_alltime | Σ n_term_hor | retained |")
    lines.append("|---|---|---|---|")
    for topic in topics:
        a = sum(r["n_alltime"] for r in by_topic[topic])
        t = sum(r["n_term_hor"] for r in by_topic[topic])
        lines.append(f"| {topic} | {a} | {t} | {pct(t, a)} |")
    lines.append("")

    # house-inclusion sensitivity: in-term speeches the cohort gave in 参議院
    # (Cabinet ministers holding HoR seats answering in the other chamber).
    lines.append("## House-filter sensitivity (in-term 衆議院 vs 参議院 speeches)\n")
    lines.append(
        "Speeches the cohort delivered **in 参議院 during the term** — mostly "
        "ministers answering in the other chamber. Currently EXCLUDED (corpus = "
        "House of Representatives). Including them adds text but skews Cabinet "
        "members toward the government line.\n"
    )
    lines.append("| Topic | 衆議院 (kept) | 参議院 (dropped) | dropped share |")
    lines.append("|---|---|---|---|")
    for topic in topics:
        keep = sum(r["n_term_hor"] for r in by_topic[topic])
        other = sum(r["n_term_other_house"] for r in by_topic[topic])
        lines.append(f"| {topic} | {keep} | {other} | {pct(other, keep + other)} |")
    lines.append("")

    # G3 recommendation
    lines.append("## G3 read\n")
    for topic in CONDITIONAL:
        trows = by_topic[topic]
        seg3 = sum(1 for r in trows if r["searchword_segs"] >= 3)
        ge5 = sum(1 for r in trows if r["n_term_hor"] >= 5)
        lines.append(
            f"- **{topic}**: {seg3} members ({pct(seg3, n_cohort)}) clear the "
            f"≥3 opinion-segment upper bound; {ge5} have ≥5 term speeches. "
        )
    lines.append(
        "\n(A minimum-text threshold and the include/exclude call for the "
        "conditional topics are made from the numbers above — see the CSV for "
        "the full per-member distribution.)"
    )

    out_md = os.path.join(ARTIFACTS_DIR, "a1_volume_summary.md")
    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {out_md}")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
