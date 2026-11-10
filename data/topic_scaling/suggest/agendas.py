"""C. Gemini reads recent agenda items and proposes topics (spec §4.9 C).

Agenda items are the ○ lines under 本日の会議に付した案件 in each record's opening
会議録情報 speech. The last `months` months of items are counted, procedural ones
dropped, and one Gemini call turns them into at most `max_candidates` pasteable
experiment_config.json entries (minus `window`), each tagged with the existing topic it
overlaps, if any. Output is text for Slack plus the raw JSON for the suggestions file.
"""
from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

from ..config import Config, Topic

log = logging.getLogger("topic_scaling.suggest.agendas")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
PROCEDURAL = re.compile(r"互選|理事|派遣|参考人|閉会中審査|辞任|補欠選任|国政調査|委員長の報告|趣旨説明|議事経過|提出資料|"
	r"小委員会|公聴会|承認を求めるの件|会期|議長の選挙|議席|本会議|日程|議院運営|懲罰|請願|議決|中間報告|調査会|継続調査|決算|計算書|連合審査")
AGENDA_HEAD = "本日の会議に付した案件"
SEPARATOR = "─────"

PROMPT = """あなたは日本の国会審議を分析する政治学者です。以下は直近{months}か月の衆参両院の委員会・本会議で「本日の会議に付した案件」として扱われた議題の一覧（件数つき）です。

既にサイトで追跡している政策トピック（検索語つき）:
{existing}

この議題一覧から、新たに政治家のスタンス（賛否）を計測する価値のある「対立のある政策論点」を最大{n}件、提案してください。
条件:
- 既存トピックと大きく重なるものは、新規ではなく「既存トピックへの追加」として overlap_with に既存トピックの topic_name_en を入れる。
- 手続き的な議題（委員長互選、派遣、参考人など）や、賛否の対立がない事務的な法案は除く。
- 各提案に、国会発言の検索に使える日本語の検索語を5〜10個（短い名詞句）、賛否が分かれる一文の問い、根拠となる議題名を2〜5個つける。
- 出力は JSON 配列のみ。各要素: {{"topic_name": "...", "topic_name_en": "CamelCase", "search_words": ["..."], "question": "...", "overlap_with": "既存のtopic_name_en または null", "evidence": ["議題名", ...], "why": "一文"}}

議題一覧:
{items}
"""


def issue_date(issue_id: str) -> Optional[date]:
	d = issue_id[-8:]
	try:
		return date(int(d[:4]), int(d[4:6]), int(d[6:]))
	except ValueError:
		return None


def agenda_items(speech_text: str) -> List[str]:
	if AGENDA_HEAD not in speech_text:
		return []
	block = speech_text.split(AGENDA_HEAD, 1)[1]
	block = block.split(SEPARATOR, 1)[0]
	items = []
	for line in block.splitlines():
		line = line.strip()
		if line.startswith("○"):
			items.append(re.sub(r"\s+", " ", line[1:].strip()))
	return items


def collect_items(issues_dir: Path, since: date) -> Tuple[Counter, int]:
	counts: Counter = Counter()
	meetings = 0
	for issue_id in os.listdir(issues_dir):
		d = issue_date(issue_id)
		if d is None or d < since:
			continue
		path = issues_dir / issue_id / "speeches.jsonl"
		if not path.exists():
			continue
		with open(path, encoding="utf-8") as f:
			first = f.readline()
		if not first.strip():
			continue
		text = json.loads(first).get("speech") or ""
		items = [i for i in agenda_items(text) if not PROCEDURAL.search(i)]
		if items:
			meetings += 1
		counts.update(items)
	return counts, meetings


def gemini_json(model: str, prompt: str, key: Optional[str] = None) -> list:
	key = key or os.environ["GEMINI_API_KEY"]
	r = requests.post(f"{GEMINI_BASE}/{model}:generateContent", headers={"x-goog-api-key": key},
		json={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
			"generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}}, timeout=300)
	r.raise_for_status()
	text = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
	out = json.loads(text)
	return out if isinstance(out, list) else out.get("candidates") or out.get("topics") or []


def render(cands: list) -> List[str]:
	lines = []
	for i, c in enumerate(cands, 1):
		ov = c.get("overlap_with")
		head = f"  {i}. {c.get('topic_name')} ({c.get('topic_name_en')})" + (f" → overlaps {ov}: add words" if ov else "")
		lines.append(head)
		lines.append(f"     search_words: {', '.join(c.get('search_words') or [])}")
		if c.get("question"):
			lines.append(f"     question: {c['question']}")
		if c.get("evidence"):
			lines.append(f"     agenda: {'; '.join(c['evidence'][:3])}")
	return lines


def run_agendas(cfg: Config, topics: List[Topic], months: int = 6, max_items: int = 400, max_candidates: int = 8,
		model: Optional[str] = None) -> Tuple[List[str], list]:
	since = date.today() - timedelta(days=30 * months)
	counts, meetings = collect_items(cfg.issues_dir, since)
	if not counts:
		return [f"Agenda suggestions: no agenda items found since {since}"], []
	top = counts.most_common(max_items)
	items = "\n".join(f"{n:4d}  {it}" for it, n in top)
	existing = "\n".join(f"- {t.name_en} / {t.name_jp}: {'、'.join(t.search_words[:8])}" for t in topics)
	prompt = PROMPT.format(months=months, existing=existing, n=max_candidates, items=items)
	model = model or cfg.summary_fallback_model
	cands = gemini_json(model, prompt)
	lines = [f"New topic candidates from {len(counts)} agenda items in {meetings} meetings since {since} (Gemini, {model}):"]
	lines += render(cands[:max_candidates]) or ["  (none)"]
	lines.append("  Paste an entry into data/resource/experiment_config.json with a window, then run `python -m topic_scaling onboard --topic <TopicNameEn>` (and `--axes` once it has summaries)")
	return lines, cands
