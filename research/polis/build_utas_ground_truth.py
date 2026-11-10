#!/usr/bin/env python
# coding: utf-8
"""Build the UTAS ground-truth answer vectors for POLIS anchor evaluation.

This is the real headline-metric ground truth (spec §4.4): for each anchor
politician, their *actual* UTAS survey answers on the policy Likert items, paired
with the item wording so `polis_option_logprob.py` can administer the identical
question to a persona model and compare (MAE / correlation on the 1..5 scale).

For one wave it produces `data/data/polis/utas_ground_truth/{wave}.json` holding
  - `items`   : the Q4_* (5-pt agree/disagree) and Q5_* (5-pt A/B) catalog, with
                Japanese question wording + the standard answer options, and
  - `answers` : per matched anchor person_id, their coded answer per item
                (1..5, or null for a 99 "no answer" / skipped item).

Wording provenance:
  - 2022/earlier codebooks are native Japanese -> used verbatim (`provenance: native`).
  - The 2024 codebook ships English only -> translated to Japanese once via Gemini
    (repo Gemini-first convention) and cached in the output (`provenance:
    translated_from_en`). `source_text` always keeps the codebook original so a
    human can review the translation.

The anchor person_ids come from the spec's 4 dev anchors by default; the UTAS id
for each is resolved through `u-tokyo-asahi/person_map/{wave}.json` (built by
match_utas_to_person.py). Only anchors actually present in the wave are emitted.

Usage:
    python data/build_utas_ground_truth.py --wave 2022HoC            # native JA, no API
    python data/build_utas_ground_truth.py --wave 2024HoR --translate # Gemini EN->JA
    python data/build_utas_ground_truth.py --all --translate          # both anchor waves
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import zipfile

from paths import DATA_DIR

UTAS_DIR = os.path.join(DATA_DIR, "u-tokyo-asahi")
OUT_DIR = os.path.join(DATA_DIR, "polis", "utas_ground_truth")

# The 4 dev anchors (spec §3). person_id -> display name. Only those matched in a
# given wave's person_map are emitted, so listing all four here is safe.
DEV_ANCHORS = {152: "岸田文雄", 3631: "福島みずほ", 2377: "塩川鉄也", 5520: "上田清司"}

# Per-wave source files (csv is the answers, docx is the codebook wording).
WAVES = {
    "2019HoC": ("2019UTASP20190805.csv", None),  # filenames resolved by glob if None
    "2021HoR": (None, None),
    "2022HoC": ("2022UTASP20220720.csv", "2022UTASP_codebook20231201.docx"),
    "2024HoR": ("2024UTASP20241125.csv", "2024UTASP_English_20250820.docx"),
}

MISSING_CODES = {"99", "999", ""}  # 99 = no answer; blank = not asked

# Standard UTAS answer scales, presented in Japanese (mirror polis_option_logprob.py).
LIKERT_AGREE_JA = [
    "そう思う",
    "どちらかといえばそう思う",
    "どちらともいえない",
    "どちらかといえばそう思わない",
    "そう思わない",
]
AB_SCALE_JA = [
    "Aに近い",
    "どちらかといえばAに近い",
    "どちらともいえない",
    "どちらかといえばBに近い",
    "Bに近い",
]


# --------------------------------------------------------------------------- #
# Codebook parsing
# --------------------------------------------------------------------------- #
def _codebook_text(docx_path: str) -> str:
    """Flatten a .docx to one whitespace-normalised string (tables + paragraphs).

    Cell/row/paragraph boundaries become spaces so the item regexes can run over a
    single line regardless of whether an item lives in a paragraph or a table cell.
    """
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    xml = xml.replace("</w:tc>", " ").replace("</w:tr>", " ").replace("</w:p>", " ")
    xml = re.sub(r"<[^>]+>", "", xml)
    return re.sub(r"\s+", " ", xml).strip()


# `(5) <text> (Q4_5)`  — 5-pt agree/disagree items. `_NOCROSS` forbids the body
# from spanning across any other `(Qn_...` marker, so the non-greedy capture can't
# reach backwards over the Q2/Q3 sections to a stray `(1)` (2024 codebook has many
# parenthesised numbers before Q4). Requires the item-number paren to sit directly
# before its statement text.
_NOCROSS = r"(?:(?!\(Q\d).)*?"
_AGREE_RE = re.compile(r"\(\d+\)\s*(" + _NOCROSS + r")\s*\(Q4_(\d+)\)")
# `(6) A: <a> B: <b> (Q5_6)` — 5-pt A/B items (colon may be full-width).
_AB_RE = re.compile(
    r"\(\d+\)\s*A[:：]\s*(" + _NOCROSS + r")\s*B[:：]\s*(" + _NOCROSS + r")\s*\(Q5_(\d+)\)"
)


def parse_codebook(docx_path: str) -> list[dict]:
    """Return the Q4_* (agree) and Q5_* (A/B) item catalog from a codebook docx.

    Each item: {code, type, source_text, and for AB: stmt_a/stmt_b}. Text is in the
    codebook's own language (JA for 2022, EN for 2024); translation happens later.
    """
    text = _codebook_text(docx_path)
    items: list[dict] = []
    for body, n in _AGREE_RE.findall(text):
        body = body.strip()
        if body:  # skip the header "(Q4_1 ~ Q4_19)" pseudo-match, which has empty body
            items.append({"code": f"Q4_{n}", "type": "agree", "source_text": body})
    for a, b, n in _AB_RE.findall(text):
        items.append(
            {
                "code": f"Q5_{n}",
                "type": "ab",
                "stmt_a": a.strip(),
                "stmt_b": b.strip(),
                "source_text": f"A: {a.strip()} / B: {b.strip()}",
            }
        )
    items.sort(key=lambda it: (it["type"] != "agree", int(it["code"].split("_")[1])))
    return items


# --------------------------------------------------------------------------- #
# Japanese wording (native or translated)
# --------------------------------------------------------------------------- #
def _question_ja_native(item: dict) -> str:
    """Compose the presented Japanese question from a native-JA codebook item."""
    if item["type"] == "agree":
        return item["source_text"]
    return (
        f"次の意見について、A「{item['stmt_a']}」、B「{item['stmt_b']}」の"
        f"どちらのお考えに近いですか。"
    )


def _translate_items(items: list[dict], model: str) -> None:
    """Fill `question_ja` (+ stmt_a_ja/stmt_b_ja for AB) via Gemini, in place.

    One batched request per item keeps it simple and cheap; the codebook has <60
    items per wave. Populates `provenance: translated_from_en`.
    """
    from dotenv import load_dotenv
    from google import genai

    load_dotenv()
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    sys_inst = (
        "あなたは政治学の調査票を翻訳する専門家です。"
        "英語の世論調査項目を、自然で中立的な日本語の調査項目文に翻訳してください。"
        "原文が意見を述べる平叙文であれば、疑問文にせず平叙文（「〜べきだ」「〜である」等）"
        "のまま訳してください。訳文のみを出力し、説明や引用符は付けないでください。"
    )
    for it in items:
        if it["type"] == "agree":
            ja = _gemini_translate(client, model, sys_inst, it["source_text"])
            it["question_ja"] = ja
        else:
            a = _gemini_translate(client, model, sys_inst, it["stmt_a"])
            b = _gemini_translate(client, model, sys_inst, it["stmt_b"])
            it["stmt_a_ja"], it["stmt_b_ja"] = a, b
            it["question_ja"] = (
                f"次の意見について、A「{a}」、B「{b}」のどちらのお考えに近いですか。"
            )
        it["provenance"] = "translated_from_en"


def _gemini_translate(client, model, sys_inst, text: str) -> str:
    resp = client.models.generate_content(
        model=model,
        contents=text,
        config={"system_instruction": sys_inst, "temperature": 0.0},
    )
    return (resp.text or "").strip().strip("「」\"'")


# --------------------------------------------------------------------------- #
# Answers
# --------------------------------------------------------------------------- #
def _resolve_files(wave: str):
    """Return (csv_path, docx_path) for a wave, globbing when names are unknown."""
    import glob

    d = os.path.join(UTAS_DIR, wave)
    csv_hint, docx_hint = WAVES.get(wave, (None, None))
    csv_path = os.path.join(d, csv_hint) if csv_hint else None
    if not csv_path or not os.path.exists(csv_path):
        cands = [p for p in glob.glob(os.path.join(d, "*.csv"))]
        csv_path = cands[0] if cands else None
    docx_path = os.path.join(d, docx_hint) if docx_hint else None
    if not docx_path or not os.path.exists(docx_path):
        cands = [p for p in glob.glob(os.path.join(d, "*.docx"))]
        docx_path = cands[0] if cands else None
    return csv_path, docx_path


def load_answers(csv_path: str, item_codes: list[str]) -> dict[str, dict[str, str]]:
    """Read the UTAS csv (Shift-JIS) -> {utas_id: {item_code: raw_value}}."""
    with open(csv_path, encoding="shift_jis", errors="replace") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    idx = {h: i for i, h in enumerate(header)}
    id_col = idx["ID"]
    present = [c for c in item_codes if c in idx]
    out: dict[str, dict[str, str]] = {}
    for r in rows[1:]:
        if id_col >= len(r):
            continue
        uid = r[id_col].strip()
        if not uid:
            continue
        out[uid] = {c: r[idx[c]].strip() for c in present}
    return out


def code_to_value(raw: str) -> int | None:
    """UTAS coded answer -> 1..5 int, or None for missing/no-answer/not-applicable."""
    if raw in MISSING_CODES or raw == "66":  # 66 = 非該当 (not applicable)
        return None
    try:
        v = int(raw)
    except ValueError:
        return None
    return v if 1 <= v <= 5 else None


def persons_to_emit(wave: str, all_matched: bool) -> dict[int, tuple[str, str]]:
    """person_id -> (utas_id, display_name) for the persons whose answers to emit.

    Default: just the dev anchors present in this wave. With `all_matched=True`,
    every confidently matched person in the wave's person_map — so any held-out
    target politician's ground-truth answers are available for the headline metric
    (spec §4.4), not only the four anchors.
    """
    pm_path = os.path.join(UTAS_DIR, "person_map", f"{wave}.json")
    with open(pm_path, encoding="utf-8") as f:
        pm = json.load(f)["map"]
    rev = {v["person_id"]: uid for uid, v in pm.items()}
    if all_matched:
        names = {v["person_id"]: v.get("db_name_kanji", "") for v in pm.values()}
        return {pid: (uid, names.get(pid, "")) for pid, uid in rev.items()}
    return {pid: (rev[pid], DEV_ANCHORS[pid]) for pid in DEV_ANCHORS if pid in rev}


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #
def build_wave(wave: str, translate: bool, model: str, all_matched: bool = False) -> dict:
    csv_path, docx_path = _resolve_files(wave)
    if not csv_path or not docx_path:
        raise FileNotFoundError(f"{wave}: csv={csv_path} docx={docx_path}")

    items = parse_codebook(docx_path)
    # Attach question wording + options.
    native_ja = "codebook" in os.path.basename(docx_path) or "English" not in docx_path
    if native_ja:
        for it in items:
            it["question_ja"] = _question_ja_native(it)
            it["provenance"] = "native"
    elif translate:
        _translate_items(items, model)
    else:
        for it in items:  # leave EN wording; metric can't run until translated
            it["question_ja"] = None
            it["provenance"] = "untranslated_en"
    for it in items:
        it["options_ja"] = LIKERT_AGREE_JA if it["type"] == "agree" else AB_SCALE_JA

    codes = [it["code"] for it in items]
    answers_raw = load_answers(csv_path, codes)
    persons = persons_to_emit(wave, all_matched)

    answers: dict[str, dict] = {}
    for pid, (uid, name) in persons.items():
        row = answers_raw.get(uid, {})
        coded = {c: code_to_value(row.get(c, "")) for c in codes}
        answers[str(pid)] = {
            "name": name,
            "utas_id": uid,
            "n_answered": sum(v is not None for v in coded.values()),
            "coded": coded,
        }

    return {
        "wave": wave,
        "source_csv": os.path.basename(csv_path),
        "codebook": os.path.basename(docx_path),
        "n_items": len(items),
        "items": items,
        "answers": answers,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--wave", help="e.g. 2024HoR, 2022HoC")
    ap.add_argument("--all", action="store_true", help="Both anchor waves (2024HoR + 2022HoC)")
    ap.add_argument("--translate", action="store_true", help="Gemini EN->JA for English codebooks")
    ap.add_argument("--model", default="gemini-2.5-flash", help="Gemini model for translation")
    ap.add_argument("--all-matched", action="store_true",
                    help="Emit answers for every matched person in the wave, not just the 4 "
                         "anchors — needed for held-out target politicians (spec §4.4 metric)")
    args = ap.parse_args()

    waves = ["2024HoR", "2022HoC"] if args.all else ([args.wave] if args.wave else [])
    if not waves:
        ap.error("pass --wave <wave> or --all")

    os.makedirs(OUT_DIR, exist_ok=True)
    for wave in waves:
        result = build_wave(wave, args.translate, args.model, args.all_matched)
        out_path = os.path.join(OUT_DIR, f"{wave}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        n_items = result["n_items"]
        ans = result["answers"]
        if args.all_matched:
            print(f"{wave}: {n_items} items, {len(ans)} matched persons -> {out_path}")
        else:
            summary = ", ".join(
                f"{a['name']}({a['n_answered']}/{n_items})" for a in ans.values()
            )
            print(f"{wave}: {n_items} items, anchors: {summary} -> {out_path}")


if __name__ == "__main__":
    main()
