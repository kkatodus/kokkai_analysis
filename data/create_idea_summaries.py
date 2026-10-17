#!/usr/bin/env python
# coding: utf-8

# # Create idea summaries from organized representative speeches
# 
# Reads `data/repr_speeches_id_organized/{person_id}/{Topic}.jsonl`, extracts opinion-bearing sentences per representative per topic, summarizes them with the `SummaryPrompt` template, and writes results to `data/idea_summaries/`.
# 
# ## Topic selection
# 
# Set `TOPICS_TO_COVER` in the setup cell (English names from `resource/experiment_config.json` → `topic_name_en`, matching the `.jsonl` filenames):
# 
# | `topic_name_en` | Japanese |
# |---|---|
# | `Defence` | 防衛 |
# | `DecliningBirthrate` | 少子化 |
# | `NuclearPower` | 原発 |
# | `ClimateChange` | 気候変動 |
# | `Economy` | 経済対策 |
# | `LivingCostandTax` | 物価高対策・減税と賃上げ |
# | `SocialSecurity` | 社会保障全般の見直し（医療・介護） |
# | `Pension` | 年金制度改革・基礎年金底上げ |
# | `FamilySeparate` | 夫婦別姓 |
# | `OnlineVoting` | オンライン投票 |
# | `MyNumber` | マイナンバー |
# | `LGBT` | LGBT |
# 
# - `TOPICS_TO_COVER = ["Defence"]` — only Defence
# - `TOPICS_TO_COVER = ["Defence", "NuclearPower"]` — multiple topics, in order
# - `TOPICS_TO_COVER = None` — every topic file present for each politician
# 
# Convert to a script when needed:
# ```bash
# jupyter nbconvert --to script create_idea_summaries.ipynb
# ```

# In[ ]:


import json
import logging
import os
import random
import re
from typing import Iterator

import torch
from dotenv import load_dotenv
from tqdm import tqdm
from transformers import AutoTokenizer, BertForSequenceClassification

from api_requests.prompter import DeepResearchGemini
from file_handling.file_read_writer import create_dir, read_json, write_json
from params.paths import DATA_DIR, ROOT_DIR
from prompts.summary import SummaryPrompt

load_dotenv()

ORGANIZED_SPEECHES_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
OUTPUT_DIR = os.path.join(DATA_DIR, "idea_summaries")
EXPERIMENT_CONFIG_PATH = os.path.join(ROOT_DIR, "resource", "experiment_config.json")
ALL_SPEECHES_FILENAME = "all_speeches.jsonl"
OPINION_TARGET_CLASSES = ["意見文"]
SYSTEM_PROMPT = (
	"国会議事録の意見文を、匿名化されたスタンス要約に変換する。氏名・役職・呼称は出力しない。"
	"前置きや説明文（「ご提示いただいた〜」「この政治家は〜」等）は一切出力しない。"
	"箇条書きの要約本文のみを返す。"
)

# --- run configuration ---
PERSON_ID_FILTER = None   # e.g. "10" — one politician only; None = all
TOPICS_TO_COVER = ["Defence"]  # English topic names; None = all topics on disk
MIN_OPINIONS = 3
SUMMARY_RUNS = 3          # multiple summaries per topic for embedding diversity
MODEL = "gemini-2.5-flash-lite"  # project default; see AGENTS.md
FORCE_REGENERATE = False  # set True to overwrite existing summary.json files

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

create_dir(OUTPUT_DIR)
AVAILABLE_TOPICS = [t["topic_name_en"] for t in read_json(EXPERIMENT_CONFIG_PATH)]
print("Input:", ORGANIZED_SPEECHES_DIR)
print("Output:", OUTPUT_DIR)
print("Topics this run:", TOPICS_TO_COVER or AVAILABLE_TOPICS)


# In[ ]:


def build_topic_lookup(experiment_config: list[dict]) -> dict[str, dict]:
	return {topic["topic_name_en"]: topic for topic in experiment_config}


def iter_person_dirs(person_id_filter: str | None = None) -> Iterator[tuple[str, str]]:
	for entry in sorted(os.scandir(ORGANIZED_SPEECHES_DIR), key=lambda e: e.name):
		if not entry.is_dir() or not entry.name.isdigit():
			continue
		if person_id_filter and entry.name != person_id_filter:
			continue
		yield entry.name, entry.path


def iter_topic_files(
	person_dir: str,
	topics_to_cover: list[str] | None = None,
) -> Iterator[tuple[str, str]]:
	topic_set = set(topics_to_cover) if topics_to_cover else None
	for entry in sorted(os.scandir(person_dir), key=lambda e: e.name):
		if not entry.is_file() or not entry.name.endswith(".jsonl"):
			continue
		if entry.name == ALL_SPEECHES_FILENAME:
			continue
		topic_en = entry.name.removesuffix(".jsonl")
		if topic_set is not None and topic_en not in topic_set:
			continue
		yield topic_en, entry.path


def read_speeches_from_jsonl(path: str) -> list[dict]:
	speeches = []
	with open(path, "r", encoding="utf-8") as f:
		for line in f:
			line = line.strip()
			if not line:
				continue
			speeches.append(json.loads(line))
	return speeches


def sanitize_opinion_for_summary(sentence: str, speaker_name: str | None = None) -> str:
	"""Strip speaker-identifying prefixes/names before sending text to the LLM."""
	text = sentence.strip()
	text = re.sub(r"^○[^　\s]+(?:委員|大臣|国務大臣|議員|君)?[　\s]*", "", text)
	if speaker_name:
		for variant in {speaker_name, speaker_name.replace(" ", ""), re.sub(r"[\s　君]", "", speaker_name)}:
			if variant:
				text = text.replace(variant, "")
	return re.sub(r"\s+", " ", text).strip()


META_PREAMBLE_PATTERNS = [
	r"^ご提示いただいた.*",
	r"^この政治家.*",
	r"^以下(に|の).*",
	r"^推察(すると|いたします).*",
	r"^要約(します|いたします|すると).*",
]


def strip_meta_preamble(summary: str) -> str:
	lines = []
	for line in summary.splitlines():
		trimmed = line.strip()
		if not trimmed:
			continue
		if any(re.match(pattern, trimmed) for pattern in META_PREAMBLE_PATTERNS):
			continue
		lines.append(line)
	return "\n".join(lines).strip()


# In[ ]:


class OpinionExtractor:
	def __init__(self, model_name: str = "kkatodus/jp-speech-classifier"):
		self.tokenizer = AutoTokenizer.from_pretrained(model_name)
		self.model = BertForSequenceClassification.from_pretrained(model_name)
		self.model.eval()

	def create_mini_batches(self, sentences: list[str], batch_size: int = 100) -> list[list[str]]:
		return [sentences[i : i + batch_size] for i in range(0, len(sentences), batch_size)]

	def extract_opinions(
		self,
		speech: str,
		search_words: list[str],
		target_classes: list[str] | None = None,
	) -> list[str]:
		target_classes = target_classes or OPINION_TARGET_CLASSES
		segments = [segment for segment in speech.split("。") if segment.strip()]
		if not segments:
			return []

		extracted_segments = []
		for segment_batch in self.create_mini_batches(segments):
			encoded = self.tokenizer(
				segment_batch,
				return_tensors="pt",
				padding=True,
				truncation=True,
				max_length=512,
			)
			with torch.no_grad():
				logits = self.model(**encoded).logits
			predicted_class_id = logits.argmax(dim=1)
			classes = [
				self.model.config.id2label[pred_id.item()] for pred_id in predicted_class_id
			]
			for sentence, pred_class in zip(segment_batch, classes):
				if pred_class in target_classes and any(word in sentence for word in search_words):
					extracted_segments.append(sentence)

		return extracted_segments


class IdeaSummaryGenerator:
	def __init__(
		self,
		model: str = MODEL,
		min_opinions: int = MIN_OPINIONS,
		summary_runs: int = SUMMARY_RUNS,
	):
		self.min_opinions = min_opinions
		self.summary_runs = summary_runs
		self.summary_prompter = SummaryPrompt()
		if not os.getenv("GEMINI_API_KEY"):
			raise ValueError("Please set GEMINI_API_KEY in .env file.")
		self.prompter = DeepResearchGemini(model_name=model)
		self.model = model
		self.opinion_extractor = OpinionExtractor()
		self.topic_lookup = build_topic_lookup(read_json(EXPERIMENT_CONFIG_PATH))

	def summarize_opinions(
		self,
		opinions: list[str],
		topic_jp: str,
		speaker_name: str | None = None,
	) -> str:
		sanitized = [
			s for s in (
				sanitize_opinion_for_summary(opinion, speaker_name)
				for opinion in opinions
			)
			if s
		]
		prompt = self.summary_prompter.generate_summary_prompt(opinions=sanitized, topic=topic_jp)
		summary = self.prompter.prompt(prompt=prompt, system_prompt=SYSTEM_PROMPT)
		return strip_meta_preamble(summary)

	def extract_opinions_for_topic(
		self,
		speeches: list[dict],
		search_words: list[str],
	) -> tuple[list[str], list[dict]]:
		opinion_sentences: list[str] = []
		speech_records: list[dict] = []

		for speech in speeches:
			speech_text = speech.get("speech", "")
			if not speech_text:
				continue
			extracted = self.opinion_extractor.extract_opinions(speech_text, search_words)
			if not extracted:
				continue
			date = speech.get("meta", {}).get("date") or speech.get("date")
			speech_records.append(
				{
					"speech_id": speech.get("speechID"),
					"date": date,
					"extracted_opinions": extracted,
				}
			)
			opinion_sentences.extend(extracted)

		return opinion_sentences, speech_records

	def process_person_topic(
		self,
		person_id: str,
		topic_en: str,
		topic_path: str,
		force: bool = False,
	) -> bool:
		topic_config = self.topic_lookup.get(topic_en)
		if not topic_config:
			logger.warning("Unknown topic %s for person %s; skipping", topic_en, person_id)
			return False

		topic_jp = topic_config["topic_name"]
		search_words = topic_config["search_words"]
		output_topic_dir = os.path.join(OUTPUT_DIR, person_id, topic_en)
		opinions_path = os.path.join(output_topic_dir, "opinions.json")
		summary_path = os.path.join(output_topic_dir, "summary.json")

		if not force and os.path.exists(summary_path):
			logger.info("Skipping existing summary for person %s topic %s", person_id, topic_en)
			return False

		speeches = read_speeches_from_jsonl(topic_path)
		if not speeches:
			logger.info("No speeches for person %s topic %s", person_id, topic_en)
			return False

		opinion_sentences, speech_records = self.extract_opinions_for_topic(speeches, search_words)
		if len(opinion_sentences) < self.min_opinions:
			logger.info(
				"Not enough opinions (%s) for person %s topic %s",
				len(opinion_sentences),
				person_id,
				topic_en,
			)
			return False

		create_dir(output_topic_dir)
		speaker = speeches[0].get("speaker")
		write_json(
			{
				"person_id": person_id,
				"speaker": speaker,
				"topic_en": topic_en,
				"topic_jp": topic_jp,
				"speeches": speech_records,
			},
			opinions_path,
		)

		summaries = []
		for _ in range(self.summary_runs):
			opinions_for_run = opinion_sentences.copy()
			random.shuffle(opinions_for_run)
			summaries.append(self.summarize_opinions(opinions_for_run, topic_jp, speaker_name=speaker))

		write_json(
			{
				"person_id": person_id,
				"speaker": speaker,
				"topic_en": topic_en,
				"topic_jp": topic_jp,
				"opinion_count": len(opinion_sentences),
				"summaries": summaries,
			},
			summary_path,
		)
		logger.info(
			"Saved summary for person %s topic %s (%s opinions)",
			person_id,
			topic_en,
			len(opinion_sentences),
		)
		return True

	def run(
		self,
		person_id_filter: str | None = None,
		topics_to_cover: list[str] | None = None,
		force: bool = False,
	) -> dict[str, int]:
		processed = 0
		skipped = 0
		person_dirs = list(iter_person_dirs(person_id_filter))
		for person_id, person_dir in tqdm(person_dirs, desc="Representatives"):
			for topic_en, topic_path in iter_topic_files(person_dir, topics_to_cover):
				summary_path = os.path.join(OUTPUT_DIR, person_id, topic_en, "summary.json")
				if not force and os.path.exists(summary_path):
					skipped += 1
					continue
				if self.process_person_topic(person_id, topic_en, topic_path, force=force):
					processed += 1
		return {"processed": processed, "skipped": skipped}


# In[ ]:


if __name__ == "__main__":
	generator = IdeaSummaryGenerator(
		model=MODEL,
		min_opinions=MIN_OPINIONS,
		summary_runs=SUMMARY_RUNS,
	)

	results = generator.run(
		person_id_filter=PERSON_ID_FILTER,
		topics_to_cover=TOPICS_TO_COVER,
		force=FORCE_REGENERATE,
	)

	print(f"New summaries: {results['processed']}")
	print(f"Skipped (already exist): {results['skipped']}")
	print(f"Output dir: {OUTPUT_DIR}")


# In[ ]:




