#!/usr/bin/env python
# coding: utf-8
"""Fill the `rejected` side of POLIS DPO pairs with a Gemini role-play caricature.

See specs/polis-low-resource-persona/README.md §2.2. `export_polis_dpo_pairs.py`
emits `prompt`/`chosen` rows; this script adds `rejected` = an LLM role-playing the
anchor politician on the *same* prompt, so DPO trains the real utterance against the
model's stereotype of that politician.

DESIGN NOTE / deviation from the spec: §2.2 specifies the *base model being fine-tuned*
(Qwen2.5-0.5B) as the source of `rejected`, i.e. train against the policy's own
caricature. This script instead uses Gemini 2.5 Flash-Lite — a generic strong-LLM
caricature. That is cheaper (API, no GPU) and fits the repo's Gemini-first pipeline
convention, but it is a different negative: the DPO signal becomes "prefer the real
utterance over a capable general LLM's role-play" rather than "over the policy's own."
If you want the literal spec semantics, generate `rejected` by sampling the base model
instead (a GPU step in ../idea/persona). Recorded so the choice is explicit.

The stored `prompt` already carries the 「あなたは〇〇議員です…」 persona header and the
「〇〇（会派）：」 cue, so it is fed to Gemini verbatim (DPO requires chosen and rejected
to share an identical prompt). A short system instruction reinforces in-character,
Diet-register, single-turn output. Google Search grounding is deliberately OFF — this
is role-play, not research.

Input : data/data/polis/dpo_pairs/{person_id}.jsonl        (from export_polis_dpo_pairs.py)
Output: data/data/polis/dpo_pairs_full/{person_id}.jsonl   (same rows + `rejected`)

Resumable: re-running skips rows whose speechID already has a `rejected` in the output.

Example:
    python generate_polis_rejected.py --person-id 1088
    python generate_polis_rejected.py --person-id 1088 --limit 5      # smoke test
    python generate_polis_rejected.py --person-id 1088 --model gemini-2.5-flash-lite
"""

import argparse
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
from google import genai

from params.paths import DATA_DIR

load_dotenv()

PAIRS_DIR = os.path.join(DATA_DIR, "polis", "dpo_pairs")
DEFAULT_OUTPUT_DIR = os.path.join(DATA_DIR, "polis", "dpo_pairs_full")

SYSTEM_INSTRUCTION = (
	"あなたは日本の国会審議を演じるロールプレイヤーです。"
	"与えられた会議のやり取りに続けて、指定された議員になりきって一回分の発言だけを日本語で生成してください。"
	"議員名や会派名、「はい」等の前置き、記号やマークダウンは付けず、発言内容の本文のみを出力してください。"
)

# Gemini sometimes echoes the cue ("坂井隆憲（自由民主党）：…") or a preamble; strip it.
LEADING_LABEL_RE = re.compile(r"^\s*[^\n：:]{0,30}[（(][^\n）)]{0,20}[）)]\s*[：:]\s*")
LEADING_ACK_RE = re.compile(r"^\s*(はい[、,。]?|承知(いた)?しました[、,。]?|わかりました[、,。]?)\s*")


def read_jsonl(path):
	with open(path, "r", encoding="utf-8") as f:
		for line in f:
			line = line.strip()
			if line:
				yield json.loads(line)


def clean_rejected(text):
	"""Trim role-play preambles / echoed speaker labels from the generation."""
	if not text:
		return ""
	text = text.strip()
	text = LEADING_ACK_RE.sub("", text)
	text = LEADING_LABEL_RE.sub("", text)
	return text.strip()


def generate_one(client, model, prompt, temperature, max_output_tokens, retry):
	"""One Gemini call with light retry. Returns cleaned text or None on failure."""
	for attempt in range(retry + 1):
		try:
			resp = client.models.generate_content(
				model=model,
				contents=prompt,
				config={
					"system_instruction": SYSTEM_INSTRUCTION,
					"temperature": temperature,
					"max_output_tokens": max_output_tokens,
				},
			)
			cleaned = clean_rejected(resp.text)
			if cleaned:
				return cleaned
		except Exception as exc:  # network / rate / safety block
			if attempt < retry:
				time.sleep(2 * (attempt + 1))
				continue
			print(f"  ! failed after {retry + 1} tries: {exc}")
			return None
	return None


def load_done_ids(out_path):
	"""speechIDs already carrying a non-empty `rejected` in the output (for resume)."""
	done = set()
	if os.path.isfile(out_path):
		for row in read_jsonl(out_path):
			if row.get("rejected") and row.get("speechID"):
				done.add(row["speechID"])
	return done


def main():
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--person-id", required=True, help="Anchor person_id (matches the exported {person_id}.jsonl)")
	parser.add_argument("--model", default="gemini-2.5-flash-lite", help="Gemini model id")
	parser.add_argument("--input-dir", default=PAIRS_DIR, help="Dir holding {person_id}.jsonl from the exporter")
	parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Dir for {person_id}.jsonl with `rejected` added")
	parser.add_argument("--temperature", type=float, default=1.0, help="Sampling temperature for the caricature")
	parser.add_argument("--max-output-tokens", type=int, default=512, help="Max tokens for the generated utterance")
	parser.add_argument("--retry", type=int, default=2, help="Retries per row on API failure")
	parser.add_argument("--workers", type=int, default=8, help="Concurrent Gemini calls (thread pool); 1 = sequential")
	parser.add_argument("--limit", type=int, default=None, help="Only process the first N pending rows (smoke test)")
	args = parser.parse_args()

	in_path = os.path.join(args.input_dir, f"{args.person_id}.jsonl")
	if not os.path.isfile(in_path):
		raise FileNotFoundError(f"No exported pairs for person {args.person_id}: {in_path} (run export_polis_dpo_pairs.py first)")

	rows = list(read_jsonl(in_path))
	os.makedirs(args.output_dir, exist_ok=True)
	out_path = os.path.join(args.output_dir, f"{args.person_id}.jsonl")

	done = load_done_ids(out_path)
	pending = [r for r in rows if r.get("speechID") not in done]
	if args.limit is not None:
		pending = pending[: args.limit]

	print(f"person {args.person_id}: {len(rows)} pairs, {len(done)} already done, {len(pending)} to generate (workers={args.workers})")
	if not pending:
		print("Nothing to do.")
		return

	client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

	def worker(row):
		rejected = generate_one(
			client, args.model, row["prompt"],
			args.temperature, args.max_output_tokens, args.retry,
		)
		if rejected is None:
			return None
		row["rejected"] = rejected
		row["rejected_model"] = args.model
		return row

	written = 0
	write_lock = threading.Lock()
	with open(out_path, "a", encoding="utf-8") as out:
		with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
			futures = {pool.submit(worker, row): row for row in pending}
			for i, fut in enumerate(as_completed(futures), 1):
				row = fut.result()
				if row is None:
					continue  # leave for a later resume rather than writing an empty negative
				with write_lock:
					out.write(json.dumps(row, ensure_ascii=False) + "\n")
					out.flush()
					written += 1
				if i % 50 == 0:
					print(f"  {i}/{len(pending)} …")

	print(f"Wrote {written} rows with `rejected` -> {out_path}")


if __name__ == "__main__":
	main()
