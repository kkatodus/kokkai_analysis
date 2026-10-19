"""Controversy axes and reference speeches for a topic (spec §4.9 F; Gemini port of the
old `ControversyAxis` in quantify_politician_stance_to_topics.py).

generate_axes:     sample the topic's stance summaries → Gemini → [{topic, slug, pro, con}]
generate_examples: for each sub-topic, 10 generated speeches per side (prompts/txts/…/generate_example.txt)
write_axis_files:  data/axis/{topic_jp}/{topic_jp}_axis.json + examples/{sub}_example_speeches.json
"""
from __future__ import annotations

import json
import logging
import os
import random
import re
from pathlib import Path
from typing import List, Optional

import requests

from .config import Config, Topic
from .state import State, read_json

log = logging.getLogger("topic_scaling.axis")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
PROMPTS = Path(__file__).resolve().parents[1] / "prompts" / "txts" / "quantify_repr_stances"
AXIS_SYSTEM = "国会議事録から抽出した政治家のスタンスの要約をもとに、論点を抽出する手伝いをしてもらいます。"
EXAMPLE_SYSTEM = "政治トピックに対するスタンスからそのスタンスに合致する意見文を生成する手伝いをしてもらいます。"
JSON_SUFFIX = ("\n\n上記の「回答フォーマット」の代わりに、次の JSON 配列のみを出力してください（論点は3〜6件）。"
	"各要素: {\"topic\": \"論点の概要（短い日本語、末尾に『について』など）\", \"slug\": \"英小文字のみの短い識別子（例 restart, defencebudget）\", "
	"\"pro\": \"賛成意見\", \"con\": \"反対意見\"}")
SLUG_RE = re.compile(r"^[a-z0-9]+$")


def gemini(model: str, prompt: str, system: str, json_mode: bool = False, temperature: float = 0.7) -> str:
	gen = {"temperature": temperature}
	if json_mode:
		gen["responseMimeType"] = "application/json"
	r = requests.post(f"{GEMINI_BASE}/{model}:generateContent", headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
		json={"systemInstruction": {"parts": [{"text": system}]},
			"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": gen}, timeout=300)
	r.raise_for_status()
	return "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])


def topic_summaries(state: State, topic: Topic, limit: int = 150, seed: int = 42) -> List[str]:
	out = []
	for pid in sorted(os.listdir(state.summaries_dir)):
		d = read_json(state.summary_path(pid, topic.name_en))
		if d and d.get("summaries"):
			out.append(d["summaries"][0])
	random.Random(seed).shuffle(out)
	return out[:limit]


def generate_axes(cfg: Config, state: State, topic: Topic, model: Optional[str] = None, limit: int = 150) -> List[dict]:
	summaries = topic_summaries(state, topic, limit)
	if len(summaries) < 10:
		raise RuntimeError(f"{topic.name_en}: only {len(summaries)} summaries; run select/summarize first")
	instruction = (PROMPTS / "extract_axis.txt").read_text(encoding="utf-8").replace("TOPIC", topic.name_jp)
	body = "\n\n".join(summaries)
	prompt = f"{instruction}\n{body}\n{'-' * 56}{JSON_SUFFIX}"
	raw = gemini(model or cfg.summary_model, prompt, AXIS_SYSTEM, json_mode=True, temperature=0.3)
	entries = json.loads(raw)
	if isinstance(entries, dict):
		entries = entries.get("axes") or entries.get("topics") or []
	out, seen = [], set()
	for e in entries:
		slug = re.sub(r"[^a-z0-9]", "", str(e.get("slug", "")).lower())
		if not slug or slug in seen or not e.get("topic") or not e.get("pro") or not e.get("con"):
			continue
		seen.add(slug)
		out.append({"topic": e["topic"].strip(), "slug": slug, "pro": e["pro"].strip(), "con": e["con"].strip()})
	if not out:
		raise RuntimeError(f"{topic.name_en}: Gemini returned no usable axes: {raw[:300]}")
	return out


def generate_examples(cfg: Config, topic: Topic, entry: dict, n: int = 10, model: Optional[str] = None) -> dict:
	template = (PROMPTS / "generate_example.txt").read_text(encoding="utf-8")
	result = {"topic": entry["topic"]}
	for side in ("pro", "con"):
		instruction = template.replace("TOPIC", entry["topic"]).replace("STANCE", entry[side])
		opinions = [gemini(model or cfg.summary_model, instruction, EXAMPLE_SYSTEM) for _ in range(n)]
		result[side] = {"opinions": [o.strip() for o in opinions if o.strip()], "instruction": instruction, "stance": entry[side]}
	return result


def write_axis_files(cfg: Config, topic: Topic, entries: List[dict], examples: List[dict]) -> Path:
	d = cfg.axis_dir / topic.name_jp
	(d / "examples").mkdir(parents=True, exist_ok=True)
	axis_path = d / f"{topic.name_jp}_axis.json"
	axis_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	for ex in examples:
		(d / "examples" / f"{ex['topic']}_example_speeches.json").write_text(
			json.dumps(ex, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	return axis_path
