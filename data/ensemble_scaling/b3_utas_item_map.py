#!/usr/bin/env python
# coding: utf-8
"""B3 — Map UTAS survey items to scaling topics (the validity "referee").

Spec: specs/ensemble-scaling-reliability/ (work item B3).

Turns a UTAS wave into a per-topic {person_id -> oriented answer} table so the
A6 validity step can correlate each politician's estimated scaling position with
their own survey answer, overall and within-party.

Wave coverage
-------------
Only **2021HoR** (the primary validation wave for the 49th-term corpus) is mapped
here. The 2024HoR replication-appendix mapping is TODO — its item numbering must
be re-read from the 2024 codebook before trusting these column names.

Topic → item mapping (UTAS 2021 HoR)
------------------------------------
Column meanings from 2021UTASP_English_20240502_temporary.docx. `pro_sign` orients
each item so that a HIGHER oriented score = closer to the topic's "for" anchor in
data/resource/experiment_config.json (Defence for = SDF-in-constitution / collective
self-defense; Nuclear for = restart / keep nuclear). Directions were validated
against party means (LDP/Ishin pro, JCP anti) — see the printed table / the .md.

  Defence (topic 1)
    Q6_1  primary   "Japan's defense capabilities should be strengthened" 1(agree)-5     pro_sign -1
    SQ8_2 secondary "Specify the right of collective self-defense" (in constitution)     pro_sign +1  (binary 0/1; 66=n/a)
    SQ8_1 secondary "Specify the maintenance of the Self-Defense Forces"                 pro_sign +1  (binary 0/1; 66=n/a)
    Q7_1  secondary A strengthen US alliance / B cautious                                pro_sign -1
    Q6_2  secondary "attack enemy bases if attack expected" 1(agree)-5                   pro_sign -1
  NuclearPower (topic 4)
    Q7_5  primary   A "abolish nuclear power now" / B "keep as future power source"      pro_sign +1
    Q6_14 secondary "Fukushima treated-water ocean release is unavoidable" 1(agree)-5    pro_sign -1

Every Likert item uses 99 = missing. SQ8_* are binary (0/1) branch items: 66 = not
asked (respondent said the constitution needs no amendment), 99 = missing.

Outputs (specs/ensemble-scaling-reliability/artifacts/)
  b3_utas_item_map.json : canonical mapping (consumed by A6) + coverage/validation
  b3_utas_item_map.md   : human-readable mapping + party-mean direction check
"""

import csv
import glob
import json
import os
import statistics
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
UTAS_ROOT = os.path.join(REPO_ROOT, "data", "data", "u-tokyo-asahi")
ARTIFACTS_DIR = os.path.join(
    REPO_ROOT, "specs", "ensemble-scaling-reliability", "artifacts"
)
COHORT_CSV = os.path.join(ARTIFACTS_DIR, "a1_cohort_49th_hor.csv")

# canonical mapping, keyed by wave then topic (English topic_name_en)
ITEM_MAP: dict[str, dict[str, dict]] = {
    "2021HoR": {
        "Defence": {
            "primary": "Q6_1",
            "items": {
                "Q6_1": {"pro_sign": -1, "missing": [99], "kind": "likert5",
                         "text": "Japan's defense capabilities should be strengthened (1 agree - 5 disagree)"},
                "SQ8_2": {"pro_sign": 1, "missing": [66, 99], "kind": "binary",
                          "text": "Specify the right of collective self-defense in the constitution (1 yes / 0 no)"},
                "SQ8_1": {"pro_sign": 1, "missing": [66, 99], "kind": "binary",
                          "text": "Specify the maintenance of the SDF in the constitution (1 yes / 0 no)"},
                "Q7_1": {"pro_sign": -1, "missing": [99], "kind": "ab5",
                         "text": "A strengthen Japan-US Security Treaty / B be cautious"},
                "Q6_2": {"pro_sign": -1, "missing": [99], "kind": "likert5",
                         "text": "Should not hesitate to attack enemy bases if attack expected"},
            },
        },
        "NuclearPower": {
            "primary": "Q7_5",
            "items": {
                "Q7_5": {"pro_sign": 1, "missing": [99], "kind": "ab5",
                         "text": "A abolish nuclear power now / B keep as future power source"},
                "Q6_14": {"pro_sign": -1, "missing": [99], "kind": "likert5",
                          "text": "Fukushima treated-water ocean release is unavoidable (1 agree - 5 disagree)"},
            },
        },
    },
    # "2024HoR": TODO — re-read 2024 codebook for item numbering.
}


def _load_wave_rows(wave: str) -> list[dict]:
    path = sorted(glob.glob(os.path.join(UTAS_ROOT, wave, "*.csv")))[0]
    with open(path, encoding="shift_jis", errors="replace") as f:
        return list(csv.DictReader(f)), os.path.basename(path)


def _person_map(wave: str) -> dict[str, int]:
    pm = json.load(open(os.path.join(UTAS_ROOT, "person_map", f"{wave}.json")))
    return {uid: int(v["person_id"]) for uid, v in pm["map"].items()}


def load_topic_scores(wave: str, topic: str, item: str | None = None) -> dict[int, float]:
    """{person_id -> oriented answer} for one item (default: the topic's primary).

    Oriented so higher = more 'for'. Missing/branch codes dropped. This is the
    referee series A6 correlates the scaling estimate against."""
    spec = ITEM_MAP[wave][topic]
    col = item or spec["primary"]
    cfg = spec["items"][col]
    missing = set(cfg["missing"])
    sign = cfg["pro_sign"]
    rows, _ = _load_wave_rows(wave)
    uid2pid = _person_map(wave)
    out: dict[int, float] = {}
    for r in rows:
        pid = uid2pid.get(r["ID"])
        if pid is None:
            continue
        v = (r.get(col) or "").strip()
        if not v:
            continue
        fv = float(v)
        if int(fv) in missing:
            continue
        out[pid] = sign * fv
    return out


def _cohort_party() -> dict[int, str]:
    seen: dict[int, str] = {}
    for r in csv.DictReader(open(COHORT_CSV, encoding="utf-8")):
        seen.setdefault(int(r["person_id"]), r["party"])
    return seen


def main() -> None:
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    wave = "2021HoR"
    party = _cohort_party()
    _, src = _load_wave_rows(wave)

    party_order = ["自由民主党", "公明党", "日本維新の会", "国民民主党",
                   "立憲民主党", "日本共産党", "れいわ新選組"]
    report: dict = {"wave": wave, "source_csv": src, "topics": {}}
    lines = ["# B3 — UTAS 2021 HoR item map (validity referee)\n"]
    lines.append(f"Source: `{src}`. Scores oriented so **higher = more 'for'** "
                 "(Defence: pro-SDF/collective-self-defense; Nuclear: pro-restart). "
                 "Direction validated against party means below (LDP/Ishin should be "
                 "high, JCP low).\n")

    for topic, spec in ITEM_MAP[wave].items():
        report["topics"][topic] = {"primary": spec["primary"], "items": {}}
        lines.append(f"## {topic}  (primary: `{spec['primary']}`)\n")
        lines.append("| item | text | n (cohort) | LDP | Ishin | CDP | JCP |")
        lines.append("|---|---|---|---|---|---|---|")
        for col, cfg in spec["items"].items():
            scores = load_topic_scores(wave, topic, col)
            coh_scores = {pid: s for pid, s in scores.items() if pid in party}
            byp = defaultdict(list)
            for pid, s in coh_scores.items():
                byp[party[pid]].append(s)
            means = {p: round(statistics.mean(v), 2) for p, v in byp.items() if len(v) >= 5}
            report["topics"][topic]["items"][col] = {
                **{k: cfg[k] for k in ("pro_sign", "missing", "kind", "text")},
                "n_cohort": len(coh_scores),
                "party_means": means,
            }

            def g(p):
                return means.get(p, "-")
            tag = " **(primary)**" if col == spec["primary"] else ""
            lines.append(
                f"| `{col}`{tag} | {cfg['text'][:52]} | {len(coh_scores)} | "
                f"{g('自由民主党')} | {g('日本維新の会')} | {g('立憲民主党')} | {g('日本共産党')} |"
            )
        lines.append("")

    out_json = os.path.join(ARTIFACTS_DIR, "b3_utas_item_map.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    out_md = os.path.join(ARTIFACTS_DIR, "b3_utas_item_map.md")
    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote {out_json}\nWrote {out_md}\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
