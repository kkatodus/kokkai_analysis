"""Phase 1: label the gold set with candidate models and score them (specs/speech-quality-labels §4.1).

From data/:
  python3 -m speech_quality.evaluate run MODEL [--limit N] [--workers N]
  python3 -m speech_quality.evaluate score [MODEL...]

MODEL is a Gemini model id (gemini-3.8-flash, gemini-3.5-flash-lite) or
ollama:<name> (ollama:qwen3:14b, needs `ollama serve`). Results are cached per
exchange in s3_mirror/.speech-quality/eval/<prompt version>/<model>/, so a rerun
only labels what's missing. Gemini needs GEMINI_API_KEY in data/.env.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests

from .prompt import ISSUES, OUTCOMES, PROMPT_VERSION, SCHEMA, exchange_prompt, system_prompt

DATA_DIR = Path(__file__).resolve().parents[1]
GOLD = DATA_DIR / "speech_quality" / "gold" / "gold_v1.jsonl"
WORK = DATA_DIR.parent / "s3_mirror" / ".speech-quality"
EVAL_DIR = WORK / "eval" / PROMPT_VERSION

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434") + "/api/chat"

# Batch API prices per 1M tokens (input, output incl. thinking), checked 2026-10-17; the spec's §4.4 table
BATCH_PRICE = {
	"gemini-3.8-flash": (0.375, 1.875),
	"gemini-3.5-flash-lite": (0.15, 1.25),
	"gemini-3-flash-preview": (0.25, 1.50),
}
QUESTIONER_ISSUES = {"private_scandal", "redundant", "grandstanding", "softball"}


def load_gold() -> List[dict]:
	return [json.loads(l) for l in GOLD.open(encoding="utf-8") if l.strip()]


def load_texts() -> Dict[str, dict]:
	texts = {}
	for p in sorted(WORK.glob("gold_texts_v1*.jsonl")):
		for l in p.open(encoding="utf-8"):
			if l.strip():
				d = json.loads(l)
				texts[d["gold_id"]] = d
	return texts


def result_path(model: str, gold_id: str) -> Path:
	return EVAL_DIR / model.replace(":", "_").replace("/", "_") / (gold_id.replace("#", "_") + ".json")


# --- model calls ---

def call_gemini(model: str, system: str, user: str, session: requests.Session) -> dict:
	key = os.environ["GEMINI_API_KEY"]
	body = {
		"systemInstruction": {"parts": [{"text": system}]},
		"contents": [{"role": "user", "parts": [{"text": user}]}],
		"generationConfig": {
			"temperature": 0,
			"responseMimeType": "application/json",
			"responseJsonSchema": SCHEMA,
			"thinkingConfig": {"thinkingLevel": "minimal"},
		},
	}
	for attempt in range(6):
		r = session.post(GEMINI_URL.format(model=model), json=body, headers={"x-goog-api-key": key}, timeout=300)
		if r.status_code == 400 and "thinking" in r.text.lower() and "thinkingConfig" in body["generationConfig"]:
			body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
			if attempt >= 1:
				body["generationConfig"].pop("thinkingConfig")
			continue
		if r.status_code in (429, 500, 502, 503, 504):
			time.sleep(min(60, 4 * 2 ** attempt))
			continue
		r.raise_for_status()
		d = r.json()
		text = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"] if not p.get("thought"))
		u = d.get("usageMetadata", {})
		return {
			"labels": json.loads(text),
			"usage": {
				"input": u.get("promptTokenCount", 0),
				"output": u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0),
			},
		}
	raise RuntimeError(f"{model}: gave up after retries ({r.status_code} {r.text[:200]})")


def call_ollama(model: str, system: str, user: str, session: requests.Session) -> dict:
	body = {
		"model": model,
		"messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
		"format": SCHEMA,
		"stream": False,
		"think": False,
		"options": {"temperature": 0, "num_ctx": 32768},
	}
	r = session.post(OLLAMA_URL, json=body, timeout=1800)
	r.raise_for_status()
	d = r.json()
	return {
		"labels": json.loads(d["message"]["content"]),
		"usage": {"input": d.get("prompt_eval_count", 0), "output": d.get("eval_count", 0)},
		"seconds": d.get("total_duration", 0) / 1e9,
	}


def label_one(model: str, ex: dict, session: requests.Session) -> dict:
	system, user = system_prompt(), exchange_prompt(ex)
	t0 = time.time()
	if model.startswith("ollama:"):
		out = call_ollama(model.split(":", 1)[1], system, user, session)
	else:
		out = call_gemini(model, system, user, session)
	out.setdefault("seconds", time.time() - t0)
	out.update(gold_id=ex["gold_id"], model=model, prompt=PROMPT_VERSION)
	return out


def cmd_run(args) -> int:
	from dotenv import load_dotenv
	load_dotenv(DATA_DIR / ".env")
	gold, texts = load_gold(), load_texts()
	todo = [g for g in gold if not result_path(args.model, g["gold_id"]).exists()]
	cached = len(gold) - len(todo)
	if args.limit:
		todo = todo[: args.limit]
	missing = [g["gold_id"] for g in todo if g["gold_id"] not in texts]
	if missing:
		print(f"no text for {missing[:3]}…", file=sys.stderr)
		return 2
	print(f"{args.model}: {len(todo)} to label ({cached} cached)")
	workers = 1 if args.model.startswith("ollama:") else args.workers
	session = requests.Session()
	done = failed = 0

	def work(g):
		ex = texts[g["gold_id"]]
		out = label_one(args.model, ex, session)
		p = result_path(args.model, g["gold_id"])
		p.parent.mkdir(parents=True, exist_ok=True)
		p.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
		return out

	with ThreadPoolExecutor(workers) as pool:
		for g, fut in [(g, pool.submit(work, g)) for g in todo]:
			try:
				out = fut.result()
				done += 1
				if done % 10 == 0 or done == len(todo):
					print(f"  {done}/{len(todo)}  last {out['seconds']:.0f}s  {out['usage']}", flush=True)
			except Exception as e:  # keep going; a rerun retries the missing ones
				failed += 1
				print(f"  ✗ {g['gold_id']}: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
	print(f"done {done}, failed {failed}")
	return 1 if failed else 0


# --- scoring ---

def prf(tp: int, fp: int, fn: int) -> str:
	p = tp / (tp + fp) if tp + fp else 0.0
	r = tp / (tp + fn) if tp + fn else 0.0
	f = 2 * p * r / (p + r) if p + r else 0.0
	return f"P {p:.2f} R {r:.2f} F1 {f:.2f} (gold {tp + fn}, model {tp + fp})"


def issue_types(labels: dict, side: Optional[str] = None) -> set:
	out = set()
	for i in labels.get("issues") or []:
		t = i["type"] if isinstance(i, dict) else i
		if side == "questioner" and t not in QUESTIONER_ISSUES and not (isinstance(i, dict) and i.get("by") in ("questioner", "both")):
			continue
		out.add(t)
	return out


def productive(labels: dict) -> bool:
	"""The compatibility flag (spec §3.5): contribution ≠ none and no questioner-side issue."""
	return labels.get("contribution") != "none" and not issue_types(labels, "questioner")


def bloc(g: dict) -> str:
	return "ruling" if g.get("ruling") else "opposition"


def score_model(model: str, gold: List[dict]) -> Optional[str]:
	pairs = []
	usage = Counter()
	secs = []
	for g in gold:
		p = result_path(model, g["gold_id"])
		if p.exists():
			r = json.loads(p.read_text(encoding="utf-8"))
			pairs.append((g, r["labels"]))
			usage.update(r["usage"])
			secs.append(r.get("seconds", 0))
	if not pairs:
		return None
	n = len(pairs)
	lines = [f"## {model}  ({n}/{len(gold)} exchanges, prompt {PROMPT_VERSION})", ""]
	acc = lambda f: sum(g["labels"].get(f) == m.get(f) for g, m in pairs) / n
	lines.append(
		f"Exact match: function {acc('function'):.2f} · contribution {acc('contribution'):.2f} · "
		f"responsible {acc('responsible'):.2f} · topic {acc('topic'):.2f}"
	)
	prod = sum(productive(g["labels"]) == productive(m) for g, m in pairs) / n
	anyq = sum(bool(issue_types(g["labels"], "questioner")) == bool(issue_types(m, "questioner")) for g, m in pairs) / n
	lines.append(f"Productive flag (§3.5) agreement {prod:.2f} · any questioner-side issue agreement {anyq:.2f}")
	lines += ["", "| issue | precision / recall / F1 |", "|---|---|"]
	for t in ISSUES:
		tp = sum(t in issue_types(g["labels"]) and t in issue_types(m) for g, m in pairs)
		fp = sum(t not in issue_types(g["labels"]) and t in issue_types(m) for g, m in pairs)
		fn = sum(t in issue_types(g["labels"]) and t not in issue_types(m) for g, m in pairs)
		lines.append(f"| {t} | {prf(tp, fp, fn)} |")
	for o in OUTCOMES:
		tp = sum(o in g["labels"]["outcomes"] and o in (m.get("outcomes") or []) for g, m in pairs)
		fp = sum(o not in g["labels"]["outcomes"] and o in (m.get("outcomes") or []) for g, m in pairs)
		fn = sum(o in g["labels"]["outcomes"] and o not in (m.get("outcomes") or []) for g, m in pairs)
		lines.append(f"| outcome: {o} | {prf(tp, fp, fn)} |")
	lines += ["", "Fairness (§3.6): questioner-side issue rate, gold vs model, and productive-flag errors", "",
		"| questioner | n | gold rate | model rate | flag errors |", "|---|---|---|---|---|"]
	groups: Dict[str, list] = defaultdict(list)
	for g, m in pairs:
		groups[bloc(g)].append((g, m))
	for name, ps in sorted(groups.items()):
		gr = sum(bool(issue_types(g["labels"], "questioner")) for g, _ in ps) / len(ps)
		mr = sum(bool(issue_types(m, "questioner")) for _, m in ps) / len(ps)
		err = sum(productive(g["labels"]) != productive(m) for g, m in ps) / len(ps)
		lines.append(f"| {name} | {len(ps)} | {gr:.2f} | {mr:.2f} | {err:.2f} |")
	conf = Counter((g["labels"]["contribution"], m.get("contribution")) for g, m in pairs)
	lines += ["", "Contribution (gold → model): " + ", ".join(f"{a}→{b} {c}" for (a, b), c in sorted(conf.items()))]
	per_in, per_out = usage["input"] / n, usage["output"] / n
	lines.append(f"\nTokens per exchange: input {per_in:,.0f}, output {per_out:,.0f}; mean {sum(secs) / n:.1f}s per exchange")
	price = BATCH_PRICE.get(model)
	if price:
		cost = (per_in * price[0] + per_out * price[1]) / 1e6
		lines.append(f"Batch cost: ${cost * 1000:.2f} per 1,000 exchanges")
	return "\n".join(lines)


def cmd_score(args) -> int:
	gold = load_gold()
	models = args.models or sorted(
		{p.name for p in EVAL_DIR.iterdir() if p.is_dir()} if EVAL_DIR.exists() else []
	)
	report = []
	for m in models:
		m_id = m if m.startswith(("gemini", "ollama:")) else m.replace("ollama_", "ollama:", 1)
		s = score_model(m_id, gold)
		if s:
			report.append(s)
	text = f"# Gold-set evaluation, prompt {PROMPT_VERSION}\n\n" + "\n\n".join(report) + "\n"
	print(text)
	out = EVAL_DIR / "report.md"
	out.parent.mkdir(parents=True, exist_ok=True)
	out.write_text(text, encoding="utf-8")
	return 0


def main(argv: Optional[Iterable[str]] = None) -> int:
	p = argparse.ArgumentParser(prog="python3 -m speech_quality.evaluate")
	sub = p.add_subparsers(dest="cmd", required=True)
	r = sub.add_parser("run")
	r.add_argument("model")
	r.add_argument("--limit", type=int)
	r.add_argument("--workers", type=int, default=6)
	s = sub.add_parser("score")
	s.add_argument("models", nargs="*")
	args = p.parse_args(list(argv) if argv is not None else None)
	return cmd_run(args) if args.cmd == "run" else cmd_score(args)


if __name__ == "__main__":
	sys.exit(main())
