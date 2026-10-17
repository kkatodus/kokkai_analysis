#!/usr/bin/env python
# coding: utf-8
"""A3 (part 1) — Scope-aware stance summaries for the Ensemble Scaling paper.

Spec: specs/ensemble-scaling-reliability/ (work item A3; upstream of the
multi-model embedding grid in a4_embed_grid.py).

Why this exists
---------------
The reliability paper compares TWO corpus definitions against UTAS (user
decision 2026-07-05): does scoping each politician's text to the 49th term make
the estimates more or less valid than using their whole House-of-Representatives
career? The two variants must differ in *exactly one* thing — the date window —
so both apply the same HoR-only house filter (user decision 2026-07-05: exclude
in-term 参議院 ministerial speeches):

  scope = "term"        speeches with meta.date in 2021-11-10..2024-10-09
                        AND meta.nameOfHouse == 衆議院
  scope = "allhistory"  every 衆議院 speech by the member, any date

Everything downstream of the filter is identical to the production pipeline
(data/create_idea_summaries.py): the same jp-speech-classifier opinion gate, the
same search-word filter, the same MIN_OPINIONS threshold, the same anonymised
SummaryPrompt run SUMMARY_RUNS times with gemini-2.5-flash-lite. This is
deliberate — the paper diagnoses *this* pipeline, so the summariser must be it.

Cohort + topics
---------------
Cohort = the A1 49th-HoR winners (artifacts/a1_cohort_49th_hor.csv, deduped on
person_id). Topics = Defence + NuclearPower (G3 dropped the conditional topics).

Output
------
data/data/idea_summaries_ensemble/{scope}/{person_id}/{topic}/summary.json
  mirrors the production idea_summaries schema (person_id, topic_en, topic_jp,
  opinion_count, summaries[]) so a4_embed_grid.py can consume either corpus.
Plus opinions.json (provenance) and, per run, an artifacts manifest counting how
many (person, topic) cleared the gate under each scope.

Usage
-----
  python data/ensemble_scaling/a3_build_summaries.py --scope term
  python data/ensemble_scaling/a3_build_summaries.py --scope allhistory
  python data/ensemble_scaling/a3_build_summaries.py --scope term --limit 3   # dev
"""

import argparse
import csv
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PKG_DIR = os.path.abspath(os.path.join(HERE, ".."))  # data/ (params, prompts, ...)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, DATA_PKG_DIR)

# .env with GEMINI_API_KEY lives beside the data/ packages; load it explicitly
# so this works regardless of the directory the script is launched from.
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(DATA_PKG_DIR, ".env"))

import torch  # noqa: E402
from transformers import AutoTokenizer, BertForSequenceClassification  # noqa: E402

# Pure, side-effect-free helpers reused verbatim from the production pipeline.
from create_idea_summaries import (  # noqa: E402
    SYSTEM_PROMPT,
    sanitize_opinion_for_summary,
    strip_meta_preamble,
)
from api_requests.prompter import DeepResearchGemini  # noqa: E402
from prompts.summary import SummaryPrompt  # noqa: E402

DATA_DATA = os.path.join(REPO_ROOT, "data", "data")
ORGANIZED_DIR = os.path.join(DATA_DATA, "repr_speeches_id_organized")
OUTPUT_ROOT = os.path.join(DATA_DATA, "idea_summaries_ensemble")
CONFIG_PATH = os.path.join(REPO_ROOT, "data", "resource", "experiment_config.json")
ARTIFACTS_DIR = os.path.join(
    REPO_ROOT, "specs", "ensemble-scaling-reliability", "artifacts"
)
COHORT_CSV = os.path.join(ARTIFACTS_DIR, "a1_cohort_49th_hor.csv")

# 49th HoR term window + house filter (mirrors a1_volume_gate.py).
TERM_START = "2021-11-10"
TERM_END = "2024-10-09"
HOUSE = "衆議院"

TOPICS = ["Defence", "NuclearPower"]
SCOPES = ["term", "allhistory"]

# Pipeline gate parameters (mirror data/create_idea_summaries.py).
MIN_OPINIONS = 3
SUMMARY_RUNS = 3
GEMINI_MODEL = "gemini-2.5-flash-lite"
OPINION_CLASSIFIER = "kkatodus/jp-speech-classifier"
OPINION_TARGET_CLASSES = ["意見文"]


def in_term(date: str | None) -> bool:
    return bool(date) and TERM_START <= date <= TERM_END


def keep_speech(meta: dict, date: str | None, scope: str) -> bool:
    """Corpus filter. Both scopes are HoR-only; term additionally windows dates."""
    if meta.get("nameOfHouse") != HOUSE:
        return False
    if scope == "term":
        return in_term(date)
    return True  # allhistory: any date


class GpuOpinionExtractor:
    """Same opinion gate as the production OpinionExtractor (split on 。→
    jp-speech-classifier → keep 意見文 segments containing a search word), but
    runs the classifier on GPU when available — the all-history corpus is far
    too large for the CPU default."""

    def __init__(self, model_name: str = OPINION_CLASSIFIER):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = BertForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

    def _batches(self, seq: list[str], n: int = 128):
        for i in range(0, len(seq), n):
            yield seq[i : i + n]

    @torch.no_grad()
    def extract(self, speech: str, search_words: list[str]) -> list[str]:
        segments = [s for s in speech.split("。") if s.strip()]
        if not segments:
            return []
        kept: list[str] = []
        id2label = self.model.config.id2label
        for batch in self._batches(segments):
            enc = self.tokenizer(
                batch, return_tensors="pt", padding=True, truncation=True, max_length=512
            ).to(self.device)
            preds = self.model(**enc).logits.argmax(dim=1)
            for sentence, pid in zip(batch, preds):
                cls = id2label[pid.item()]
                if cls in OPINION_TARGET_CLASSES and any(w in sentence for w in search_words):
                    kept.append(sentence)
        return kept


def load_cohort() -> list[dict]:
    seen: dict[str, dict] = {}
    with open(COHORT_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            seen.setdefault(r["person_id"], r)
    return list(seen.values())


def load_topic_lookup() -> dict[str, dict]:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    return {t["topic_name_en"]: t for t in config if t.get("topic_name_en")}


def read_speeches(path: str) -> list[dict]:
    speeches = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                speeches.append(json.loads(line))
    return speeches


def collect_opinions(
    extractor: GpuOpinionExtractor,
    speeches: list[dict],
    search_words: list[str],
    scope: str,
) -> tuple[list[str], str | None, list[dict]]:
    """Scope-filter speeches, then run the opinion gate. Returns the opinion
    sentences, the first speaker name (for sanitisation), and per-speech records."""
    opinions: list[str] = []
    records: list[dict] = []
    speaker: str | None = None
    for speech in speeches:
        text = speech.get("speech", "")
        if not text:
            continue
        meta = speech.get("meta") or {}
        date = meta.get("date") or speech.get("date")
        if not keep_speech(meta, date, scope):
            continue
        if speaker is None:
            speaker = speech.get("speaker")
        extracted = extractor.extract(text, search_words)
        if not extracted:
            continue
        records.append(
            {"speech_id": speech.get("speechID"), "date": date, "extracted_opinions": extracted}
        )
        opinions.extend(extracted)
    return opinions, speaker, records


def summarize(prompter, summary_prompter, opinions: list[str], topic_jp: str, speaker: str | None) -> list[str]:
    sanitized = [
        s for s in (sanitize_opinion_for_summary(o, speaker) for o in opinions) if s
    ]
    summaries = []
    for _ in range(SUMMARY_RUNS):
        shuffled = sanitized.copy()
        random.shuffle(shuffled)
        prompt = summary_prompter.generate_summary_prompt(opinions=shuffled, topic=topic_jp)
        summaries.append(strip_meta_preamble(prompter.prompt(prompt=prompt, system_prompt=SYSTEM_PROMPT)))
    return summaries


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scope", choices=SCOPES, required=True)
    ap.add_argument("--topics", nargs="+", default=TOPICS)
    ap.add_argument("--limit", type=int, default=None, help="dev: cap cohort size")
    ap.add_argument("--force", action="store_true", help="regenerate existing summaries")
    ap.add_argument(
        "--no-llm",
        action="store_true",
        help="dev: run the opinion gate only, skip Gemini (writes opinions.json, no summary.json)",
    )
    args = ap.parse_args()

    cohort = load_cohort()
    if args.limit:
        cohort = cohort[: args.limit]
    topic_lookup = load_topic_lookup()
    person_party = {r["person_id"]: r["party"] for r in cohort}

    print(f"[A3] scope={args.scope} topics={args.topics} cohort={len(cohort)}")
    extractor = GpuOpinionExtractor()
    print(f"[A3] opinion classifier on {extractor.device}")

    prompter = None if args.no_llm else DeepResearchGemini(model_name=GEMINI_MODEL)
    summary_prompter = SummaryPrompt()

    stats = {t: {"cleared": 0, "below_gate": 0, "no_dir": 0, "skipped": 0} for t in args.topics}

    for i, r in enumerate(cohort, 1):
        pid = r["person_id"]
        for topic in args.topics:
            cfg = topic_lookup.get(topic)
            if not cfg:
                continue
            jsonl = os.path.join(ORGANIZED_DIR, pid, f"{topic}.jsonl")
            out_dir = os.path.join(OUTPUT_ROOT, args.scope, pid, topic)
            summary_path = os.path.join(out_dir, "summary.json")
            if not args.force and os.path.exists(summary_path):
                stats[topic]["skipped"] += 1
                continue
            if not os.path.exists(jsonl):
                stats[topic]["no_dir"] += 1
                continue
            speeches = read_speeches(jsonl)
            opinions, speaker, records = collect_opinions(
                extractor, speeches, cfg["search_words"], args.scope
            )
            if len(opinions) < MIN_OPINIONS:
                stats[topic]["below_gate"] += 1
                continue
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, "opinions.json"), "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "person_id": pid,
                        "party": person_party.get(pid, ""),
                        "speaker": speaker,
                        "topic_en": topic,
                        "topic_jp": cfg["topic_name"],
                        "scope": args.scope,
                        "opinion_count": len(opinions),
                        "speeches": records,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            if args.no_llm:
                stats[topic]["cleared"] += 1
                continue
            summaries = summarize(prompter, summary_prompter, opinions, cfg["topic_name"], speaker)
            with open(summary_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "person_id": pid,
                        "party": person_party.get(pid, ""),
                        "speaker": speaker,
                        "topic_en": topic,
                        "topic_jp": cfg["topic_name"],
                        "scope": args.scope,
                        "opinion_count": len(opinions),
                        "summaries": summaries,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            stats[topic]["cleared"] += 1
        if i % 25 == 0:
            print(f"[A3] {i}/{len(cohort)} members processed")

    print(f"\n[A3] scope={args.scope} done. Per-topic:")
    for topic, s in stats.items():
        print(f"  {topic}: cleared={s['cleared']} below_gate={s['below_gate']} "
              f"no_dir={s['no_dir']} skipped={s['skipped']}")

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    manifest = os.path.join(ARTIFACTS_DIR, f"a3_summaries_{args.scope}.json")
    with open(manifest, "w", encoding="utf-8") as f:
        json.dump({"scope": args.scope, "cohort": len(cohort), "topics": stats}, f,
                  ensure_ascii=False, indent=2)
    print(f"[A3] wrote {manifest}")


if __name__ == "__main__":
    main()
