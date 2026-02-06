#!/usr/bin/env python
# coding: utf-8

# In[ ]:


import os
import json
from google.cloud import bigquery
from typing import List, Dict, Tuple, Any, Optional
from IPython import get_ipython
from dbio.representative_db import connect_db, get_person_by_column
from requests import post, get
from dotenv import load_dotenv
from params.paths import DATA_DIR
import argparse
load_dotenv()

if get_ipython() is None:
	parser = argparse.ArgumentParser()

	parser.add_argument("--politician_name", type=str, default="")
	parser.add_argument("--youtube_channel_id", type=str, default="")
	parser.add_argument("--twitter_user_id", type=str, default="")
	parser.add_argument("--topic_of_interest", type=str, default="防衛")
	parser.add_argument("--embedding_model", type=str, default="sbintuitions/sarashina-embedding-v2-1b")
	parser.add_argument("--subtopic_of_interest", type=str, default="防衛予算の増額")
	parser.add_argument("--local_llm_port", type=str, default="http://192.168.56.1:1234")
	parser.add_argument("--llm_model", type=str, default="openai/gpt-oss-20b")

	args = parser.parse_args()
	POLITICIAN_NAME = args.politician_name
	YOUTUBE_CHANNEL_ID = args.youtube_channel_id
	TWITTER_USER_ID = args.twitter_user_id
	TOPIC_OF_INTEREST = args.topic_of_interest
	EMBEDDING_MODEL = args.embedding_model
	LOCAL_LLM_PORT = args.local_llm_port
	SUBTOPIC_OF_INTEREST = args.subtopic_of_interest
	LLM_MODEL = args.llm_model
else: 
	POLITICIAN_NAME = ""
	YOUTUBE_CHANNEL_ID = ""
	TWITTER_USER_ID = ""
	TOPIC_OF_INTEREST = "防衛"
	EMBEDDING_MODEL = "sbintuitions/sarashina-embedding-v2-1b"
	LOCAL_LLM_PORT = "http://10.5.0.2:1234"
	LLM_MODEL = "abeja-qwq32b-reasoning-japanese-v1.0"
	SUBTOPIC_OF_INTEREST = "防衛予算の増額"
COMPLETION_ENDPOINT = f"{LOCAL_LLM_PORT}/v1/chat/completions"


SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS = False if POLITICIAN_NAME else True

print(f"POLITICIAN_NAME: {POLITICIAN_NAME}\nYOUTUBE_CHANNEL_ID: {YOUTUBE_CHANNEL_ID}\nTWITTER_USER_ID: {TWITTER_USER_ID}\nTOPIC_OF_INTEREST: {TOPIC_OF_INTEREST}\nSUBTOPIC_OF_INTEREST: {SUBTOPIC_OF_INTEREST}\nEMBEDDING_MODEL: {EMBEDDING_MODEL}\nLOCAL_LLM_PORT: {LOCAL_LLM_PORT}\nLLM_MODEL: {LLM_MODEL}")
SKIP_PLATFORMS = []
if not YOUTUBE_CHANNEL_ID:
	SKIP_PLATFORMS.append("youtube")
if not TWITTER_USER_ID:
	SKIP_PLATFORMS.append("twitter")
if POLITICIAN_NAME:
	conn = connect_db(
		dbname="kokkaidoc",
		user="postgres",
		password=os.getenv("PSQL_DATABASE_PASSWORD"),
		host="localhost",
		port="5432"
	)
	with conn.cursor() as cur:
			db_rows = get_person_by_column(cur, 'name_kanji', POLITICIAN_NAME)
			POLITICIAN_ID = db_rows[0].person_id

	client = bigquery.Client()

	RELEVANCE_DATA_DIR = os.path.join(DATA_DIR, "tmp_idea_analysis", POLITICIAN_NAME)

	YOUTUBE_DATA_OUTPUT_DIR = os.path.join(RELEVANCE_DATA_DIR, "youtube_data")
	TWITTER_DATA_OUTPUT_DIR = os.path.join(RELEVANCE_DATA_DIR, "twitter_data")
	PARLIAMENT_DATA_OUTPUT_DIR = os.path.join(RELEVANCE_DATA_DIR, "parliament_data")
	for d in [YOUTUBE_DATA_OUTPUT_DIR, TWITTER_DATA_OUTPUT_DIR, PARLIAMENT_DATA_OUTPUT_DIR]:
		os.makedirs(d, exist_ok=True)

	PARLIAMENT_DATA_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized", str(POLITICIAN_ID))
	representative_parliament_speech_exists = os.path.exists(PARLIAMENT_DATA_DIR)
	if not representative_parliament_speech_exists:
		raise ValueError(f"Representative parliament speech data for {POLITICIAN_NAME} does not exist")



# ## [Data collection] - Scripts

# In[ ]:


YOUTUBE_META_QUERY = lambda channel_id : f"""
SELECT *
FROM `idea-a.jpdiet.videos` AS p
WHERE p.channel_id LIKE "%{channel_id}%"
"""

TWITTER_QUERY = lambda user_id : f"""
SELECT * FROM `idea-a.jpdiet.xdata_parsed`  as p
WHERE p.user_id_str LIKE "%{user_id}%"
"""

def get_all_videos_with_ids(video_ids:List[str]):
	query = """
	SELECT * 
	FROM `idea-a.jpdiet.transcripts` as p
	WHERE p.video_id in UNNEST(@video_ids)
	"""

	job_config = bigquery.QueryJobConfig(
		query_parameters=[
			bigquery.ArrayQueryParameter(
				"video_ids",
				"STRING",
				video_ids
			)
		]
	)
	for row in client.query(query, job_config=job_config):
		yield row
	

def save_all_data_for_query(query, output_path, datetime_format="%Y-%m-%d %H:%M:%S", datetime_columns=[]):
	print(query)
	query_job = client.query(query)

	with open(output_path, "w", encoding="utf-8") as f:
		for row in query_job:
			row_dict = dict(row.items())  # <-- convert Row → dict
			for col in datetime_columns:
				if col in row_dict:
					row_dict[col] = row_dict[col].strftime(datetime_format)
			
			json_line = json.dumps(row_dict, ensure_ascii=False)
			f.write(json_line + "\n")

def get_all_video_ids(path):
	video_ids = []
	with open(path, "r", encoding="utf-8") as f:
		for line in f:
			video_id = json.loads(line)["video_id"]
			video_ids.append(video_id)
	return video_ids


# ## [Data collection] mains
# 
# ### Youtube

# In[ ]:


## first get all the video ids
if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl")) or not YOUTUBE_CHANNEL_ID:
	print("Youtube video meta already collected")
else:
	print("Collecting youtube data")
	save_all_data_for_query(YOUTUBE_META_QUERY(YOUTUBE_CHANNEL_ID), os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl"))
	video_ids = get_all_video_ids(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl"))

	with open(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts.jsonl"), "w", encoding="utf-8") as f:
		for row in get_all_videos_with_ids(video_ids):
			row_dict = dict(row.items())
			row_dict["created_at"] = row_dict["created_at"].strftime("%Y-%m-%d %H:%M:%S")
			row_dict["modified_at"] = row_dict["modified_at"].strftime("%Y-%m-%d %H:%M:%S")
			json_line = json.dumps(row_dict, ensure_ascii=False)
			f.write(json_line + "\n")


# ### Twitter

# In[ ]:


if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl")) or not TWITTER_USER_ID:
	print("Twitter data already collected or twitter user id is not provided")
else:
	print("Collecting twitter data")
	save_all_data_for_query(TWITTER_QUERY(TWITTER_USER_ID), os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl"), datetime_columns=['created_at_ts', 'user_created_at_ts'])


# ## Statistics - Scripts

# In[ ]:


from collections import Counter
import matplotlib.pyplot as plt
from datetime import datetime
def get_number_of_lines_in_file(file_path):
	with open(file_path, "r", encoding="utf-8") as f:
		return sum(1 for _ in f)

# print("Parliament", get_number_of_lines_in_file(os.path.join(PARLIAMENT_DATA_DIR, "all_speeches.jsonl")))

creation_columns = {
	"youtube": ["published_at"],
	"twitter": ["created_at_ts"],
	"parliament": ["meta", "date"]
}

creation_formats = {
	"youtube": "%Y-%m-%dT%H:%M:%SZ",
	"twitter": "%Y-%m-%d %H:%M:%S",
	"parliament": "%Y-%m-%d"
}

def group_data_by_time(path, creation_columns, creation_format)-> Counter:
	counter = Counter()
	with open(path, "r", encoding="utf-8") as f:
		for line in f:
			data = json.loads(line)
			creation_time = data

			for col in creation_columns:
				creation_time = creation_time.get(col, None)
			creation_time = datetime.strptime(creation_time, creation_format)
			year = creation_time.year
			counter[year] += 1
			
	return counter

def plot_counter(counter:Counter):
	plt.bar(counter.keys(), counter.values())
	plt.show()

if False:
	youtube_counter = group_data_by_time(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl"), creation_columns["youtube"], creation_formats["youtube"])
	print("Youtube", get_number_of_lines_in_file(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl")))
	plot_counter(youtube_counter)
	print("Twitter", get_number_of_lines_in_file(os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl")))

	twitter_counter = group_data_by_time(os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl"), creation_columns["twitter"], creation_formats["twitter"])
	plot_counter(twitter_counter)
	parliament_counter = group_data_by_time(os.path.join(PARLIAMENT_DATA_DIR, "all_speeches.jsonl"), creation_columns["parliament"], creation_formats["parliament"])
	plot_counter(parliament_counter)



# ## [Filtering]Use the LLM to filter the data

# In[ ]:


import os
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoConfig
from peft import PeftConfig, PeftModel
import random
try:
	from peft import AutoPeftModelForSequenceClassification
	_HAS_AUTO_PEFT_MODEL = True
	print("has auto peft")
except:
	from peft import AutoModelForSequenceClassification
	print("no auto peft model")
	_HAS_AUTO_PEFT_MODEL = False

seed = 42
random.seed(seed)
np.random.seed(seed)
torch.manual_seed(seed)
torch.cuda.manual_seed_all(seed)


PARLIAMENT_SPEECH_LABELS = [
	"質問文",
	"追及・確認文",
	"答弁文",
	"反論・再反論文",
	"意見文",
	"要望・提案文",
	"批判文",
	"評価文",
	"説明文",
	"事実文",
	"謝罪・釈明文",
	"手続・運営文",
	"その他"
]
class LLMFilter:
	def __init__(self, model_name:str):
		self.model_name = model_name
		self.model_cfg = AutoConfig.from_pretrained(model_name)
		self.device="cuda" if torch.cuda.is_available() else "cpu"

		self.tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
		self.model = AutoModelForSequenceClassification.from_pretrained(model_name).to(self.device).eval()
		print("Running on", self.device)


	def id2label(self):
		return self.model_cfg.id2label

	def label2id(self):
		return self.model_cfg.label2id

	@torch.no_grad()
	def predict(self, texts:list[str]):
		inputs = self.tokenizer(
			texts, 
			return_tensors="pt",
			truncation=True,
			padding=True
		).to(self.device)

		logits = self.model(**inputs).logits
		probs = torch.softmax(logits, dim=-1)

		probs_np = probs.cpu().numpy()
		preds = probs.argmax(dim=-1).cpu().numpy()
		out = []
		for i, t in enumerate(texts):
			pred = preds[i]
			prob = probs_np[i]
			out.append({
				"label": self.model_cfg.id2label[pred],
				"probs": prob.tolist(),
			})
		return out

class LLMFilterPeft:
	def __init__(self, model_name:str):
		self.model_name = model_name
		self.device="cuda" if torch.cuda.is_available() else "cpu"	
		self.tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=False)
		self.model, self.model_cfg, self.base_name = self._load_model()
		print("Running on", self.device)
		

		self.model.to(self.device)


	def id2label(self):
		return self.model_cfg.id2label

	def label2id(self):
		return self.model_cfg.label2id

	def _load_model(self):
		peft_cfg = PeftConfig.from_pretrained(self.model_name)
		base_name = getattr(peft_cfg, "base_model_name_or_path", None)

		base_model = AutoModelForSequenceClassification.from_pretrained(
			base_name,
			trust_remote_code=False,
			num_labels=13
		)

		model = PeftModel.from_pretrained(
			base_model,
			self.model_name,
		)

		id2label = {i: label for i, label in enumerate(PARLIAMENT_SPEECH_LABELS)}
		label2id = {label: i for i, label in enumerate(PARLIAMENT_SPEECH_LABELS)}


		# The "real" classification config is usually on the base model
		model_cfg = base_model.config

		model_cfg.problem_type = "multi_label_classification"
		model_cfg.id2label = id2label
		model_cfg.label2id = label2id
		model_cfg.num_labels = len(id2label)


		return model, model_cfg, base_name

	@torch.no_grad()
	def predict(self, texts:list[str], threshold:float=0.5, top_k:int=2):
		inputs = self.tokenizer(
			texts,
			return_tensors="pt",
			truncation=True,
			padding=True,
		).to(self.device)

		logits = self.model(**inputs).logits 
		probs = torch.sigmoid(logits).cpu().numpy()

		out = []
		for i, t in enumerate(texts):
			row = probs[i]
			chosen = [self.model_cfg.id2label[j] for j, p in enumerate(row) if float(p) >= threshold]
			if len(chosen) == 0:
				chosen = ["その他"]
			top_ids = row.argsort()[-top_k:][::-1]
			top = [(self.model_cfg.id2label[int(j)], float(row[int(j)])) for j in top_ids]
			out.append({
				"labels(threshold)": chosen,
				"topk": top,
				"probs": row.tolist(),
			})
		return out

		
		
			


# ### [Filtering]Twitter filtering

# In[ ]:


if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data_filtered.jsonl")) or not TWITTER_USER_ID:
	print("Twitter data already filtered or twitter user id is not provided")
else:
	twitter_llm_filter = LLMFilter(
		model_name="kkatodus/text_labeller_twitter-full-deberta-v3-base-japanese",
	)
	data_path = os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl")
	filtered_data_path = os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data_filtered.jsonl")
	with open(data_path, "r", encoding="utf-8") as f, open(filtered_data_path, "w", encoding="utf-8") as f_filtered:
		for line in f:
			data = json.loads(line)
			text = data["text"]
			if not text:
				continue
			pred = twitter_llm_filter.predict([text])
			if pred[0]["label"] == "その他":
				continue
			data["label"] = pred[0]["label"]
			f_filtered.write(json.dumps(data, ensure_ascii=False) + "\n")

# print(twitter_llm_filter.id2label())

# print(twitter_llm_filter.predict(["社会保障改革は凄く重要です", '暇だな']))

# print("Youtube", get_number_of_lines_in_file(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl")))
# print("Twitter", get_number_of_lines_in_file(os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data.jsonl")))
# print("Parliament", get_number_of_lines_in_file(os.path.join(PARLIAMENT_DATA_DIR, "all_speeches.jsonl")))




# ### [Filtering] Youtube filtering

# In[ ]:


import re
from tqdm import tqdm
if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered.jsonl")) or not YOUTUBE_CHANNEL_ID:
	print("Youtube transcripts already filtered or youtube channel id is not provided")
else:

	print("Filtering Youtube transcripts")
	data_path = os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts.jsonl")

	filtered_data_path = os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered.jsonl")

	youtube_filter_llm = LLMFilter(
		model_name="kkatodus/text_labeller_youtube-full-deberta-v3-base-japanese",
	)


	print("Youtube filter llm loaded")
	def add_periods(text: str) -> str:
		"""Insert Japanese periods after sentence-ending phrases.

		- Adds "。" after any occurrence of the end words.
		- Does NOT add if it's already followed by punctuation like "。", "！", "？".
		"""
		end_words = ["ですね", "ですよ", "である", "です", "ます", "だよ", "でしょうか","ください", "しれません", "しましょう"]
		pattern = "(" + "|".join(re.escape(w) for w in end_words) + ")"
		# Replace end-word occurrences not already followed by punctuation.
		return re.sub(pattern + r"(?![。！？!?])", r"\1。", text)


	with open(data_path, "r", encoding="utf-8") as f, open(filtered_data_path, "w", encoding="utf-8") as f_filtered:
		print("Starting filtering")

		batch = []
		batch_video_ids = []
		for line in tqdm(f):
		

			while len(batch) > 20:
				pred = youtube_filter_llm.predict(batch[:20])
				for p, b, vid in zip(pred, batch[:20], batch_video_ids[:20]):
					if p["label"] == "その他":
						continue
					out_dict = {}
					out_dict["label"] = p["label"]
					out_dict["video_id"] = vid
					out_dict["text"] = b
					f_filtered.write(json.dumps(out_dict, ensure_ascii=False) + "\n")
				batch = batch[20:]
				batch_video_ids = batch_video_ids[20:]
			data = json.loads(line)
			print("Processing line", data["video_id"])
			video_id = data["video_id"]
			text = data["text"]
			if not text:
				continue
			text = add_periods(text)
			split_text = text.split("。")
			for t in split_text:
				if not t or len(t) < 10:
					continue
				else:
					batch.append(t)
					batch_video_ids.append(video_id)

		if len(batch) > 0:
			pred = youtube_filter_llm.predict(batch)
			for p, b, vid in zip(pred, batch, batch_video_ids):
				if p["label"] == "その他":
					continue
				out_dict = {}
				out_dict["label"] = p["label"]
				out_dict["video_id"] = vid
				out_dict["text"] = b
				f_filtered.write(json.dumps(out_dict, ensure_ascii=False) + "\n")

if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered_with_date.jsonl")) or not YOUTUBE_CHANNEL_ID:
	print("[Filtering]Youtube transcripts already filtered with date or youtube channel id is not provided")

else:

	# creating a filtered file with the date
	filtered_data_path = os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered.jsonl")
	meta_data_path = os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_video_meta.jsonl")
	filtered_data_path_with_date = os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered_with_date.jsonl")
	# create video_id to date mapping
	video_id_to_date = {}
	with open(meta_data_path, "r", encoding="utf-8") as f:
		for line in f:
			data = json.loads(line)
			video_id_to_date[data["video_id"]] = data["published_at"]

	print(video_id_to_date)
	with open(filtered_data_path, "r", encoding="utf-8") as f, open(filtered_data_path_with_date, "w", encoding="utf-8") as f_filtered:
		for line in f:
			data = json.loads(line)
			data["date"] = video_id_to_date[data["video_id"]]
			f_filtered.write(json.dumps(data, ensure_ascii=False) + "\n")



# ## [Filtering] Parliament filtering

# In[ ]:


if SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS or os.path.exists(os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, "parliament_transcripts_filtered.jsonl")) or not PARLIAMENT_DATA_DIR:
	print("[Filtering]Parliament speeches already filtered or parliament data directory is not provided")
else:
	BATCH_SIZE = 20
	THRESHOLD = 0.35
	print("Filtering Parliament speeches")

	parliament_llm_filter = LLMFilterPeft(
		model_name="kkatodus/text_labeller_parliament-deberta-v3-base-japanese",
	)
	data_path = os.path.join(PARLIAMENT_DATA_DIR, "all_speeches.jsonl")

	filtered_data_path = os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, "parliament_transcripts_filtered.jsonl")

	with open(data_path, "r", encoding="utf-8") as f, open(filtered_data_path, "w", encoding="utf-8") as f_filtered:
		batch = []
		for line in tqdm(f):
			while len(batch) > BATCH_SIZE:
				pred = parliament_llm_filter.predict([b['speech'] for b in batch[:BATCH_SIZE]], threshold=THRESHOLD)
				for p, b in zip(pred, batch[:BATCH_SIZE]):
					out_dict = {}
					out_dict["label"] = p["labels(threshold)"]
					out_dict["speech_id"] = b['speechID']
					out_dict["text"] = b['speech']
					out_dict["date"] = b['meta']['date']
					f_filtered.write(json.dumps(out_dict, ensure_ascii=False) + "\n")
				batch = batch[BATCH_SIZE:]
			data = json.loads(line)
			print("Processing line", data["speechID"])
			speech_id = data["speechID"]
			text = data["speech"]
			if not text:
				continue
			split_text = text.split("。")
			for t in split_text:
				if not t or len(t) < 10:
					continue
				else:
					batch.append({
						"speechID": speech_id,
						"speech": t,
						"meta": data["meta"]
					})
				
		if len(batch) > 0:
			pred = parliament_llm_filter.predict([b['speech'] for b in batch], threshold=THRESHOLD)
			for p, b, in zip(pred, batch):
				out_dict = {}
				out_dict["label"] = p["labels(threshold)"]
				out_dict["speech_id"] = b['speechID']
				out_dict["text"] = b['speech']
				out_dict["date"] = b['meta']['date']
				f_filtered.write(json.dumps(out_dict, ensure_ascii=False) + "\n")


# ## [Embeddings] Using LLMs to embed the data 

# In[ ]:


from sentence_transformers import SentenceTransformer
if not SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS:

	EMBED_PLATFORMS = ["youtube", "twitter", "parliament"]
	INPUT_PATHS = {
		"youtube": os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered_with_date.jsonl"),
		"twitter": os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data_filtered.jsonl"),
		"parliament": os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, "parliament_transcripts_filtered.jsonl"),
	}

	KEEP_LABELS = {
		"youtube": ["政治"],
		"twitter": ["政治"],
		"parliament":["質問文","追及・確認文","答弁文","反論・再反論文","意見文","要望・提案文","批判文","評価文","説明文","事実文"]
	}

	KEEP_COLUMNS = {
		"youtube": ["text", "date"],
		"twitter": ["text", "created_at_ts", "tweet_id"],
		"parliament": ["text", "date", "speech_id"]
	}

	OUTPUT_PATHS = {
		"youtube": os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered_with_date_embeddings.jsonl"),
		"twitter": os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data_filtered_embeddings.jsonl"),
		"parliament": os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, "parliament_transcripts_filtered_embeddings.jsonl")
	}

	embed_model = SentenceTransformer(EMBEDDING_MODEL)


	for platform in EMBED_PLATFORMS:
		if platform in SKIP_PLATFORMS:
			print(f"[Embedding] Skipping {platform} because it is in SKIP_PLATFORMS")
			continue

		input_path = INPUT_PATHS[platform]
		output_path = OUTPUT_PATHS[platform]
		if os.path.exists(output_path):
			print(f"[Embedding] {platform} embeddings already exist")
			continue
		print(f"[Embedding] {platform} data")

		keep_labels = KEEP_LABELS[platform]
		keep_columns = KEEP_COLUMNS[platform]

		with open(input_path, "r", encoding="utf-8") as f, open(output_path, "w", encoding="utf-8") as f_output:
			batch : List[Dict[str, Any]] = []
			for line in tqdm(f):
				if len(batch) > 20:
					pred = embed_model.encode([b["text"].strip() for b in batch])
					for p, b in zip(pred, batch):
						f_output.write(json.dumps(
							{col: b[col] for col in keep_columns} | {"embedding": p.tolist()},
							ensure_ascii=False) + "\n")
					batch = []
				data = json.loads(line)
				if platform == "parliament":
					if any(label in data["label"] for label in keep_labels):
						batch.append({
							col: data[col] for col in keep_columns
						})
				elif platform == "youtube" or platform == "twitter":
					if data["label"] in keep_labels:
						batch.append({
							col: data[col] for col in keep_columns
						})
			if len(batch) > 0:
				pred = embed_model.encode([b["text"].strip() for b in batch])
				for p, b in zip(pred, batch):
					f_output.write(json.dumps(
						{col: b[col] for col in keep_columns} | {"embedding": p.tolist()},
						ensure_ascii=False) + "\n")




# ## [Year grouping] And saving average

# In[ ]:


from params.paths import ROOT_DIR
import os
import numpy as np
from datetime import datetime
if not SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS:
	embedded_data_paths = {
		"youtube": os.path.join(YOUTUBE_DATA_OUTPUT_DIR, "youtube_transcripts_filtered_with_date_embeddings.jsonl"),
		"twitter": os.path.join(TWITTER_DATA_OUTPUT_DIR, "twitter_data_filtered_embeddings.jsonl"),
		"parliament": os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, "parliament_transcripts_filtered_embeddings.jsonl")
	}
	platforms = [
		"youtube",
		"twitter",
		"parliament"
	]

	output_dirs = {
		"youtube": os.path.join(YOUTUBE_DATA_OUTPUT_DIR, TOPIC_OF_INTEREST),
		"twitter": os.path.join(TWITTER_DATA_OUTPUT_DIR, TOPIC_OF_INTEREST),
		"parliament": os.path.join(PARLIAMENT_DATA_OUTPUT_DIR, TOPIC_OF_INTEREST)	
	}

	for output_dir in output_dirs.values():
		if not os.path.exists(output_dir):
			os.makedirs(output_dir, exist_ok=True)


	creation_formats = {
		"youtube": "%Y-%m-%dT%H:%M:%SZ",
		"twitter": "%Y-%m-%d %H:%M:%S",
		"parliament": "%Y-%m-%d"
	}

	time_keys = {
		"youtube": "date",
		"twitter": "created_at_ts",
		"parliament": "date"
	}


	RESOURCE_DIR = os.path.join(ROOT_DIR, "resource")
	experiment_config_path = os.path.join(RESOURCE_DIR, "experiment_config.json")

	with open(experiment_config_path, "r", encoding="utf-8") as f:
		experiment_config = json.load(f)


def check_if_search_words_in_text(text: str, search_words: List[str]) -> bool:
	for word in search_words:
		if word in text:
			return True
	return False

def create_year_grouped_embedding_for_topic(topic: str, input_path: str, output_path: str, platform: str):

	year_grouped_embeddings = {}
	search_words = [d for d in experiment_config if d["topic_name"] == topic][0]["search_words"]
	with open(input_path, "r", encoding="utf-8") as f, open(output_path, "w", encoding="utf-8") as f_output:
		for line in f.readlines():
			data = json.loads(line)
			if not check_if_search_words_in_text(data["text"], search_words):
				continue
			creation_time = datetime.strptime(data[time_keys[platform]], creation_formats[platform])
			year = creation_time.year
			embedding = data["embedding"]
			if not int(year) in year_grouped_embeddings:
				year_grouped_embeddings[int(year)] = {"embeddings": np.array(embedding), "number_of_embeddings":1}
			else:
				year_grouped_embeddings[int(year)]["embeddings"] += np.array(embedding)
				year_grouped_embeddings[int(year)]["number_of_embeddings"]+= 1
		year_grouped_embeddings_averaged = {k: v["embeddings"]/float(v["number_of_embeddings"]) for k, v in year_grouped_embeddings.items()}
		for year, embedding in year_grouped_embeddings_averaged.items():
			f_output.write(json.dumps({"year": year, "number_of_embeddings": year_grouped_embeddings[year]["number_of_embeddings"], "embedding": list(embedding)}, ensure_ascii=False) + "\n")


if not SKIP_INDIVIDUAL_POLICITIAN_ANALYSIS:
	for platform in platforms:
		if platform in SKIP_PLATFORMS:
			print(f"[Embedding] Skipping {platform} because it is in SKIP_PLATFORMS")
			continue
		output_path = os.path.join(output_dirs[platform], f"{TOPIC_OF_INTEREST}_year_grouped_embeddings.jsonl")
		if not os.path.exists(output_path):
			print(f"Creating year grouped embeddings for {TOPIC_OF_INTEREST} on {platform}")
			create_year_grouped_embedding_for_topic(TOPIC_OF_INTEREST, embedded_data_paths[platform], output_path, platform)
			


# ## Now lets put everyone one the same plot and see how their positions change over time

# In[ ]:


if True:
	print("Plotting diachronic change without summary")
	from params.paths import DATA_DIR, ROOT_DIR
	import os
	from sentence_transformers import SentenceTransformer
	import umap
	import matplotlib.pyplot as plt
	import copy
	import numpy as np
	from tqdm import tqdm
	import japanize_matplotlib
	platform_cmap = {
		"youtube": "darkred",
		"twitter": "cyan",
		"parliament": "green",
		"pro": "red",
		"con": "blue"
	}
	party2color = {
		'自民': 'black',
		'国民': 'blue',
		'立憲': 'orange',
		'公明': 'aqua',
		'共産': 'red',
		'維新': 'gold',
		'社民': 'brown',
		"pro": "red",
		"con": "blue"
	}

	name2party = {
		"枝野幸男": "立憲",
		"石破茂": "自民",
		"木原稔" : "自民",
		"吉村洋文": "維新",
		"木原誠二": "自民",
		"田村智子": "共産",
		"斉藤鉄夫": "公明",
		"河野太郎": "自民",
		"福島瑞穂": "社民",
		"米山隆一": "立憲",
		"岡本三成": "公明",
		"小林鷹之": "自民",
		"玉木雄一郎": "国民",
		"小野田紀美": "自民",
		"小西洋之": "立憲",
	}

	AXIS_EXAMPLES_PATH = os.path.join(ROOT_DIR, "axis", TOPIC_OF_INTEREST, "examples", f"{SUBTOPIC_OF_INTEREST}_example_speeches_summarized.json")

	def get_axis_examples_embeddings(embed_model: SentenceTransformer, 
									axis_example_path: str|None = AXIS_EXAMPLES_PATH):
		# get axis examples
		with open(axis_example_path, "r", encoding="utf-8") as f:
			axis_examples = json.load(f)
			pro_opinions = axis_examples["pro"]
			con_opinions = axis_examples["con"]
			pro_opinions_embeddings = embed_model.encode(pro_opinions)
			con_opinions_embeddings = embed_model.encode(con_opinions)
		return pro_opinions_embeddings, con_opinions_embeddings
	def project_vectors_onto_axis_get_scalar_values(vectors: List[np.ndarray], axis_vector: np.ndarray):
		scalar_values = []
		for vector in vectors:
			scalar_values.append(np.dot(vector, axis_vector) / np.dot(axis_vector, axis_vector))
		return scalar_values

	embeddings = []
	platforms = []
	politicians = []
	parties = []
	years = []
	combined_str_identifier = []

	print("Organizing data into the arrays")
	for politician_name in tqdm(os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis"))):
		politician_dir = os.path.join(DATA_DIR, "tmp_idea_analysis", politician_name)
		for platform in os.listdir(politician_dir):
			platform_letter = platform[0]
			topic_group_embeddings_path = os.path.join(politician_dir, platform, TOPIC_OF_INTEREST, f"{TOPIC_OF_INTEREST}_year_grouped_embeddings.jsonl")
			if not os.path.exists(topic_group_embeddings_path):
				continue
			with open(topic_group_embeddings_path, "r", encoding="utf-8") as f:
				for line in f:
					data = json.loads(line)
					if data["number_of_embeddings"] < 5 and platform != "parliament":
						continue
					embeddings.append(data["embedding"])
					platforms.append(platform.split("_")[0])
					politicians.append(politician_name)
					parties.append(name2party[politician_name])
					years.append(data["year"])
					combined_str_identifier.append(f"{politician_name}_{platform_letter}_{data['year']}")

	platform_colors = [platform_cmap[p] for p in platforms]
	party_colors = [party2color[p] for p in parties]



	MODEL_NAME = "sbintuitions/sarashina-embedding-v2-1b"

	print("Loading embedding model")
	embed_model = SentenceTransformer(MODEL_NAME)

	print("Getting axis examples embeddings")
	pro_opinions_embeddings, con_opinions_embeddings = get_axis_examples_embeddings(embed_model)

	print("Getting mean embeddings")
	pro_mean = np.mean(pro_opinions_embeddings, axis=0)
	con_mean = np.mean(con_opinions_embeddings, axis=0)





	print("Organizing umap vectors")
	umap_vectors = copy.deepcopy(embeddings)
	umap_vectors.append(pro_mean)
	umap_vectors.append(con_mean)
	umap_labels = copy.deepcopy(combined_str_identifier)
	umap_labels.append(("pro", ""))
	umap_labels.append(("con", ""))
	umap_colors_platform = copy.deepcopy(platform_colors)
	umap_colors_platform.append(platform_cmap["pro"])
	umap_colors_platform.append(platform_cmap["con"])
	umap_colors_party = copy.deepcopy(party_colors)
	umap_colors_party.append(party2color["pro"])
	umap_colors_party.append(party2color["con"])



# In[ ]:


from matplotlib.lines import Line2D
from datetime import datetime


if True:
	print("Fitting umap no summary")
	ALPHA_LINES = 0.7
	ALPHA_POINTS = 0.5
	ANNOTATE_NAMES = False
	SCATTER_SIZE = 100
	fit = umap.UMAP(n_components=2, random_state=42).fit(umap_vectors)
	# plots, time series with platform as the colors, time series with party as the colors, umap with platform as the colors, umap with party as the colors
	fig, ax = plt.subplots(2,2, figsize=(50,20))
	print("plotting umap with platform as the colors")
	ax[0,0].scatter(fit.embedding_[:, 0], fit.embedding_[:, 1], c=umap_colors_platform, alpha=ALPHA_POINTS, s=SCATTER_SIZE)
	pro_after_umap = fit.embedding_[-2]
	con_after_umap = fit.embedding_[-1]

	con_2_pro = con_after_umap - pro_after_umap
	pro_further = con_after_umap + con_2_pro

	if ANNOTATE_NAMES:
		for i, label in enumerate(umap_labels):
			
			ax[0,0].annotate(
				label, 
				(fit.embedding_[i, 0], fit.embedding_[i, 1]),
				textcoords="offset points",
				xytext=(3,3),
				ha='left',
				fontsize=6,
				alpha=0.5
			)

	print("plotting umap with party as the colors")
	ax[0,1].scatter(fit.embedding_[:, 0], fit.embedding_[:, 1], c=umap_colors_party, alpha=ALPHA_POINTS, s=SCATTER_SIZE)

	axis_vector = (pro_mean - con_mean).astype(np.float32)
	scalar_values = project_vectors_onto_axis_get_scalar_values(embeddings, axis_vector)
	last_y_vals = []
	last_value_identifiers = []
	print("plotting time series with platform as the colors")
	for politician_name in os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis")):
		for plat in ["youtube", "twitter", "parliament"]:
			y_vals = []
			x_vals = []
			for s, yr, pl, pol in zip(scalar_values, years, platforms, politicians):
				if pl == plat and pol == politician_name:
					y_vals.append(s)
					x_vals.append(yr)
			if not y_vals:
				continue
			# sort x_vals and y_vals by x_vals
			x_vals, y_vals = zip(*sorted(zip(x_vals, y_vals)))
			ax[1, 0].plot(x_vals, y_vals, label=plat, c=platform_cmap[plat], alpha=ALPHA_LINES)
			ax[1, 1].plot(x_vals, y_vals, label=plat, c=party2color[name2party[politician_name]], alpha=ALPHA_LINES)

			# Annotate the last point of each series with an identifier (politician + platform)
			x_last, y_last = x_vals[-1], y_vals[-1]
			identifier = f"{politician_name}_{plat[0]}"
			ax[1, 0].annotate(
				identifier,
				(x_last, y_last),
				textcoords="offset points",
				xytext=(6, 0),
				ha="left",
				va="center",
				fontsize=15,
				alpha=0.9,
				color=platform_cmap[plat],
			)
			ax[1, 1].annotate(
				identifier,
				(x_last, y_last),
				textcoords="offset points",
				xytext=(6, 0),
				ha="left",
				va="center",
				fontsize=15,
				alpha=0.9,
				color=party2color[name2party[politician_name]],
			)

			last_y_vals.append(y_last)
			last_value_identifiers.append(identifier)

	ax[0,0].plot([pro_after_umap[0], con_after_umap[0]], [pro_after_umap[1], con_after_umap[1]], c="black", alpha=1)
	ax[0,1].plot([pro_after_umap[0], con_after_umap[0]], [pro_after_umap[1], con_after_umap[1]], c="black", alpha=1)

	ax[0,0].set_title("UMAP with platform as the colors", fontsize=20)
	ax[0,1].set_title("UMAP with party as the colors", fontsize=20)
	ax[1, 0].set_title("Time series with platform as the colors", fontsize=20)
	ax[1, 0].set_xlabel("year", fontsize=20)
	ax[1, 0].set_ylabel("projection onto axis", fontsize=20)
	ax[1, 1].set_title("Time series with party as the colors", fontsize=20)
	ax[1, 1].set_xlabel("year", fontsize=20)
	ax[1, 1].set_ylabel("projection onto axis", fontsize=20)




	def _color_legend_handles(color_map, keys):
		return [
			Line2D(
				[0],
				[0],
				marker="o",
				linestyle="None",
				markersize=10,
				markerfacecolor=color_map[k],
				markeredgecolor="none",
				label=str(k),
			)
			for k in keys
			if k in color_map
		]

	party_keys = [k for k in party2color.keys() if k not in {"pro", "con"}]
	platform_keys = [k for k in platform_cmap.keys() if k in {"youtube", "twitter", "parliament"}]

	ax[0, 0].legend(
		handles=_color_legend_handles(platform_cmap, platform_keys),
		title="Platform",
		fontsize=30,
		title_fontsize=30,
		loc="upper left",
		bbox_to_anchor=(1, 1),
	)
	ax[0, 1].legend(
		handles=_color_legend_handles(party2color, party_keys),
		title="Party",
		fontsize=30,
		title_fontsize=30,
		loc="upper left",
		bbox_to_anchor=(1, 1),
	)

	ax[1, 0].legend(
		handles=_color_legend_handles(platform_cmap, platform_keys),
		title="Platform",
		fontsize=30,
		title_fontsize=30,
		loc="upper left",
		bbox_to_anchor=(1, 1),
	)
	ax[1, 1].legend(
		handles=_color_legend_handles(party2color, party_keys),
		title="Party",
		fontsize=30,
		title_fontsize=30,
		loc="upper left",
		bbox_to_anchor=(1, 1),
	)

	plt.tight_layout()
	output_dir = os.path.join(ROOT_DIR, "tmp")
	os.makedirs(output_dir, exist_ok=True)
	plt.savefig(os.path.join(output_dir, f"{datetime.now().strftime('%Y%m%d%H%M%S')}_visualization_no_summary.png"))


plt.close("all")
ax[0,0].clear()
ax[0,1].clear()
ax[1,0].clear()
ax[1,1].clear()


# ## Create a summary of the politician platform for each year, for each platform

# In[ ]:


from params.paths import ROOT_DIR, DATA_DIR
import os
from requests import get
import json
from datetime import datetime
import shutil
from api_requests.prompter import DeepResearchGemini
import time
RESULTS_DIR = os.path.join(DATA_DIR, "tmp_idea_analysis")

gemini_prompter = DeepResearchGemini(model_name="gemini-3-flash-preview")


input_file_names = {
	"youtube":"youtube_transcripts_filtered_with_date_embeddings.jsonl",
	"twitter":"twitter_data_filtered_embeddings.jsonl",
	"parliament":"parliament_transcripts_filtered_embeddings.jsonl"
}

creation_formats = {
	"youtube": "%Y-%m-%dT%H:%M:%SZ",
	"twitter": "%Y-%m-%d %H:%M:%S",
	"parliament": "%Y-%m-%d"
}

time_keys = {
	"youtube": "date",
	"twitter": "created_at_ts",
	"parliament": "date"
}

def prompt_local_llm(prompt:str, system_prompt:str)->str:
	payload = json.dumps({
		"model": LLM_MODEL,
		"messages": [
			{
			"role": "system",
			"content": system_prompt
			},
			{
			"role": "user",
			"content": prompt
			}
		],
		"temperature": 0,
		"max_tokens": -1,
		"stream": False
	})
	headers = {
		'Content-Type': 'application/json'
		}
	print(f"PROMPTING LLM WITH \n{system_prompt}\n\n{prompt}")
	response = post(COMPLETION_ENDPOINT, headers=headers, data=payload)
	res = json.loads(response.choices[0].message.content)
	print(f"GOT REPLY FROM LLM: \n {str(res_json)}")

	return res



RESOURCE_DIR = os.path.join(ROOT_DIR, "resource")
experiment_config_path = os.path.join(RESOURCE_DIR, "experiment_config.json")


with open(experiment_config_path, "r", encoding="utf-8") as f:
	experiment_config = json.load(f)
	for d in experiment_config:
		print(d['topic_name'])
search_words = [d for d in experiment_config if d["topic_name"] == TOPIC_OF_INTEREST][0]["search_words"]
print("Search words for topic", TOPIC_OF_INTEREST, ":", search_words)

def check_search_words(search_words: List[str], text: str)->bool:
	for word in search_words:
		if word in text:
			return True
	return False


if False:
	for politician in os.listdir(RESULTS_DIR):
		print(f"Processing {politician}")
		politician_dir = os.path.join(RESULTS_DIR, politician)
		
		for plat, file_name in input_file_names.items():
			print(f"Processing {plat} for {politician}")
			input_file_path = os.path.join(politician_dir, f"{plat}_data", file_name)
			if not os.path.exists(input_file_path):
				print(f"File {input_file_path} does not exist for {politician} on {plat}")
				continue
			year_seperated_for_topic_dir = os.path.join(politician_dir, f"{plat}_data", TOPIC_OF_INTEREST, "year_seperated")
			if os.path.exists(year_seperated_for_topic_dir):
				print(f"Year seperated directory {year_seperated_for_topic_dir} already exists for {politician} on {plat} wiping it")
				shutil.rmtree(year_seperated_for_topic_dir)
			os.makedirs(year_seperated_for_topic_dir, exist_ok=True)
			
			
			with open(input_file_path, "r", encoding="utf-8") as f:
				print(f"reading from {input_file_path}")
				for line in f:
					data = json.loads(line)
					if not check_search_words(search_words, data["text"]):
						continue
					creation_time = datetime.strptime(data[time_keys[plat]], creation_formats[plat])
					year = creation_time.year
					year_seperated_file_path = os.path.join(year_seperated_for_topic_dir, f"{year}.jsonl")

					with open(year_seperated_file_path, "a", encoding="utf-8") as f_output:

						f_output.write(line)

summary_prompt_generator  = lambda topic, text: f"""

あなたは日本政治の発言分析を行う中立的なアナリストです。
以下の政治家の発言のみを根拠として、日本の「{topic}」に対するスタンスを要約してください。
発言に含まれない内容は推測・補完しないでください。

【目的】
政治に詳しくない一般の読者でも理解できる、簡潔で中立的な要約を作成すること。

【出力ルール】
- 箇条書き（最大3項目まで）
- 各項目は以下の形式に厳密に従うこと

1. スタンス（賛成 / 反対 / 条件付き賛成 / 不明）
   ・理由（発言から読み取れる主な根拠を平易な言葉で説明）
   ・根拠引用（発言の一部を短く引用。20〜40文字程度）

【制約】
- 根拠が弱い、または明確でない場合は要約に含めないとする
- 評価的・感情的な表現は使わない
- 専門用語はできるだけ一般的な言葉に言い換える
- 以下のフォーマットに厳密に従い、余計な文書は一切出力しないこと。

【出力例】
1. 防衛予算の増額に賛成  
   ・理由：日本が自分の力で国を守る必要があると述べ、装備や隊員の待遇改善の重要性を強調している  
   ・根拠引用：「自らの力で国を守る責任がある」

2. 憲法への自衛隊明記に賛成  
   ・理由：自衛隊の立場があいまいで、国内外で活動しにくいと説明している  
   ・根拠引用：「法的な根拠が不明確なままだ」

【分析対象の発言】
{text}

"""

def summarize_year_data(year_file_path: str, output_file_path: str, summarize_count=3)->str:
	
	for _ in range(summarize_count):
		texts = []
		with open(year_file_path, "r", encoding="utf-8") as f:
			for line in f:
				data = json.loads(line)
				texts.append(data["text"])
		summary = gemini_prompter.prompt(summary_prompt_generator(TOPIC_OF_INTEREST, "\n".join(texts)), system_prompt="あなたは優秀な政治分析家です。")
		with open(output_file_path, "a", encoding="utf-8") as f:
			f.write(json.dumps({"summary": summary, "year": year_file_path.split("/")[-1].split(".")[0]}, ensure_ascii=False) + "\n")


if False:

	# summarization step
	for politician in os.listdir(RESULTS_DIR):
		print(f"Processing {politician}")
		politician_dir = os.path.join(RESULTS_DIR, politician)

		for plat in input_file_names.keys():
			year_seperated_for_topic_dir = os.path.join(politician_dir, f"{plat}_data", TOPIC_OF_INTEREST, "year_seperated")
			year_summaries_for_topic_dir = os.path.join(politician_dir, f"{plat}_data", TOPIC_OF_INTEREST, "year_summaries")
			os.makedirs(year_summaries_for_topic_dir, exist_ok=True)
			if not os.path.exists(year_seperated_for_topic_dir):
				print(f"Year seperated directory {year_seperated_for_topic_dir} does not exist for {politician} on {plat}")
				continue
			year_files = os.listdir(year_seperated_for_topic_dir)
			year_files.sort()
			for year_file in year_files:
				print(f"Processing {year_file} for {politician} on {plat}")
				year_file_path = os.path.join(year_seperated_for_topic_dir, year_file)
				year_summary_file_path = os.path.join(year_summaries_for_topic_dir, year_file)
				num_lines = sum(1 for line in open(year_file_path))
				if num_lines < 5:
					print(f"Skipping {year_file} for {politician} on {plat} because it has less than 5 lines")
					continue

				if os.path.exists(year_summary_file_path):
					lines = open(year_summary_file_path, "r", encoding="utf-8").readlines()
					num_lines = len(lines)
					if num_lines >= 3:
						print(f"Skipping {year_file} for {politician} on {plat} because it has already been summarized {num_lines} times")
						continue
				retries = 0
				while retries < 3:
					try:
						# summarize like 5 times
						summarize_year_data(year_file_path, year_summary_file_path, summarize_count=3)
						break
					except Exception as e:
						print(f"Error summarizing {year_file} for {politician} on {plat}: {e}")
						print(f"Retrying {year_file} for {politician} on {plat} in 10 seconds")
						time.sleep(10)
						retries += 1


# ## Generate summaries of axis examples

# In[ ]:


from api_requests.prompter import DeepResearchGemini
import time


if False:

	print("Generating summaries of axis examples")
	gemini_prompter = DeepResearchGemini(model_name="gemini-3-flash-preview")


	AXIS_EXAMPLES_PATH = os.path.join(ROOT_DIR, "axis", TOPIC_OF_INTEREST, "examples", f"{SUBTOPIC_OF_INTEREST}_example_speeches.json")

	with open(AXIS_EXAMPLES_PATH, "r", encoding="utf-8") as f:
		axis_examples = json.load(f)

	pro_opinions = axis_examples["pro"]["opinions"]
	con_opinions = axis_examples["con"]["opinions"]


	pro_summaries = []
	for pro_opinion in pro_opinions:
		summary = gemini_prompter.prompt(summary_prompt_generator(TOPIC_OF_INTEREST, pro_opinion), system_prompt="あなたは優秀な政治分析家です。")
		pro_summaries.append(summary)

	con_summaries = []
	for con_opinion in con_opinions:
		summary = gemini_prompter.prompt(summary_prompt_generator(TOPIC_OF_INTEREST, con_opinion), system_prompt="あなたは優秀な政治分析家です。")
		con_summaries.append(summary)

	with open(os.path.join(ROOT_DIR, "axis", TOPIC_OF_INTEREST, "examples", f"{SUBTOPIC_OF_INTEREST}_example_speeches_summarized.json"), "w", encoding="utf-8") as f:
		json.dump({"pro": pro_summaries, "con": con_summaries}, f, ensure_ascii=False)



# In[ ]:


from params.paths import DATA_DIR, ROOT_DIR
import os
from sentence_transformers import SentenceTransformer
import umap
import matplotlib.pyplot as plt
import copy
import numpy as np
from tqdm import tqdm
import japanize_matplotlib

platform_cmap = {
		"youtube": "darkred",
		"twitter": "cyan",
		"parliament": "green",
		"pro": "red",
		"con": "blue"
	}
party2color = {
	'自民': 'black',
	'国民': 'blue',
	'立憲': 'orange',
	'公明': 'aqua',
	'共産': 'red',
	'維新': 'gold',
	'社民': 'brown',
	"pro": "red",
	"con": "blue"
}

party2eng = {
	'自民': 'LDP',
	'国民': 'NDP',
	'立憲': 'CDP',
	'公明': 'Komei',
	'共産': 'CPJ',
	'維新': 'JIP',
	'社民': 'SDP',
	"pro": "pro",
	"con": "con"
}

name2party = {
	"枝野幸男": "立憲",
	"石破茂": "自民",
	"木原稔" : "自民",
	"吉村洋文": "維新",
	"木原誠二": "自民",
	"田村智子": "共産",
	"斉藤鉄夫": "公明",
	"河野太郎": "自民",
	"福島瑞穂": "社民",
	"米山隆一": "立憲",
	"岡本三成": "公明",
	"小林鷹之": "自民",
	"玉木雄一郎": "国民",
	"小野田紀美": "自民",
	"小西洋之": "立憲",
}

AXIS_EXAMPLES_PATH = os.path.join(ROOT_DIR, "axis", TOPIC_OF_INTEREST, "examples", f"{SUBTOPIC_OF_INTEREST}_example_speeches.json")

def get_axis_examples_embeddings(embed_model: SentenceTransformer, 
								topic_of_interest: str,
								subtopic_of_interest: str):
	axis_examples_summarized = os.path.join(ROOT_DIR, "axis", topic_of_interest, "examples", f"{subtopic_of_interest}_example_speeches_summarized.json")
	
	if not os.path.exists(axis_examples_summarized):
		raise FileNotFoundError(f"Axis examples summarized file {axis_examples_summarized} does not exist")
	# get axis examples
	with open(axis_examples_summarized, "r", encoding="utf-8") as f:
		axis_examples = json.load(f)
	pro_opinions = axis_examples["pro"]
	con_opinions = axis_examples["con"]
	pro_opinions_embeddings = embed_model.encode(pro_opinions)
	con_opinions_embeddings = embed_model.encode(con_opinions)
	return pro_opinions_embeddings, con_opinions_embeddings

def project_vectors_onto_axis_get_scalar_values(vectors: List[np.ndarray], axis_vector: np.ndarray):
	scalar_values = []
	for vector in vectors:
		scalar_values.append(np.dot(vector, axis_vector) / np.dot(axis_vector, axis_vector))
	return scalar_values

def create_average_embedding_from_texts(texts: List[str], embed_model: SentenceTransformer):
	embeddings = embed_model.encode(texts)
	return np.mean(embeddings, axis=0)

def get_existing_year_summary_average_embedding(politician_name: str, platform: str, year: int, topic: str):
	year_summary_embeddings_file = os.path.join(DATA_DIR, "tmp_idea_analysis", politician_name, f"{platform}", topic, "year_summary_average_embeddings.jsonl")

	if not os.path.exists(year_summary_embeddings_file):
		print(f"Year summary embeddings file {year_summary_embeddings_file} does not exist for {politician_name} on {platform} in {year}")
		return None

	with open(year_summary_embeddings_file, "r", encoding="utf-8") as f:
		for line in f:
			data = json.loads(line)
			if data["year"] == year:
				return data["embedding"]
	return None

def write_year_summary_embedding(year_summary_embedding: np.ndarray, year: int, politician_name: str, platform: str):
	year_summary_embeddings_file = os.path.join(DATA_DIR, "tmp_idea_analysis", politician_name, f"{platform}", TOPIC_OF_INTEREST, "year_summary_average_embeddings.jsonl")
	with open(year_summary_embeddings_file, "a", encoding="utf-8") as f:
		f.write(json.dumps({"year": year, "embedding": year_summary_embedding.tolist()}, ensure_ascii=False) + "\n")



embeddings = []
platforms = []
politicians = []
parties = []
years = []
combined_str_identifier = []

MODEL_NAME = "sbintuitions/sarashina-embedding-v2-1b"

print("Loading embedding model")
embed_model = SentenceTransformer(MODEL_NAME)


print("Organizing data into the arrays")
for politician_name in tqdm(os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis"))):
	politician_dir = os.path.join(DATA_DIR, "tmp_idea_analysis", politician_name)
	print(f"Processing {politician_name}")
	for platform in os.listdir(politician_dir):
		print(f"Processing {platform} for {politician_name}")
		platform_letter = platform[0]
		for year in os.listdir(os.path.join(politician_dir, platform, TOPIC_OF_INTEREST, "year_summaries")):
			year_int = int(year.split('.')[0])
			year_summary_embedding = get_existing_year_summary_average_embedding(politician_name, platform, year_int, TOPIC_OF_INTEREST)
			if year_summary_embedding is not None:
				print(f"Found year summary embedding for {politician_name} on {platform} in {year_int}")
				embeddings.append(year_summary_embedding)
				platforms.append(platform.split("_")[0])
				politicians.append(politician_name)
				parties.append(name2party[politician_name])
				years.append(year_int)
				combined_str_identifier.append(f"{politician_name}_{platform_letter}_{str(year_int)}")
				continue
			year_summary_file_path = os.path.join(politician_dir, platform, TOPIC_OF_INTEREST, "year_summaries", year)
			year_summaries = []

			with open(year_summary_file_path, "r", encoding="utf-8") as f:
				for line in f:
					data = json.loads(line)
					year_summaries.append(data["summary"])
			print("Creating average embedding for year", year_int)
			avg_summary_embedding_for_year = create_average_embedding_from_texts(year_summaries, embed_model)
			embeddings.append(avg_summary_embedding_for_year)
			platforms.append(platform.split("_")[0])
			politicians.append(politician_name)
			parties.append(name2party[politician_name])
			years.append(year_int)
			combined_str_identifier.append(f"{politician_name}_{platform_letter}_{str(year_int)}")
			write_year_summary_embedding(avg_summary_embedding_for_year, year_int, politician_name, platform)

platform_colors = [platform_cmap[p] for p in platforms]
party_colors = [party2color[p] for p in parties]





print("Getting axis examples embeddings")
pro_opinions_embeddings, con_opinions_embeddings = get_axis_examples_embeddings(embed_model, TOPIC_OF_INTEREST, SUBTOPIC_OF_INTEREST)

print("Getting mean embeddings")
pro_mean = np.mean(pro_opinions_embeddings, axis=0)
con_mean = np.mean(con_opinions_embeddings, axis=0)


print("Organizing umap vectors")
umap_vectors = copy.deepcopy(embeddings)
umap_vectors.append(pro_mean)
umap_vectors.append(con_mean)
umap_labels = copy.deepcopy(combined_str_identifier)
umap_labels.append(("pro", ""))
umap_labels.append(("con", ""))
umap_colors_platform = copy.deepcopy(platform_colors)
umap_colors_platform.append(platform_cmap["pro"])
umap_colors_platform.append(platform_cmap["con"])
umap_colors_party = copy.deepcopy(party_colors)
umap_colors_party.append(party2color["pro"])
umap_colors_party.append(party2color["con"])


# In[ ]:


from matplotlib.lines import Line2D
from datetime import datetime

ALPHA_LINES = 0.7
ALPHA_POINTS = 0.5
SCATTER_SIZE = 100
ANNOTATE_NAMES = False
fit = umap.UMAP(n_components=2, random_state=42).fit(umap_vectors)
# plots, time series with platform as the colors, time series with party as the colors, umap with platform as the colors, umap with party as the colors
fig, ax = plt.subplots(2,2, figsize=(50,20))
print("plotting umap with platform as the colors")
ax[0,0].scatter(fit.embedding_[:, 0], fit.embedding_[:, 1], c=umap_colors_platform, alpha=ALPHA_POINTS, s=SCATTER_SIZE)
pro_after_umap = fit.embedding_[-2]
con_after_umap = fit.embedding_[-1]

con_2_pro = con_after_umap - pro_after_umap
pro_further = con_after_umap + con_2_pro


thicker_lines_politicians = ["枝野幸男",]
if ANNOTATE_NAMES:
	for i, label in enumerate(umap_labels):
		
		ax[0,0].annotate(
			label, 
			(fit.embedding_[i, 0], fit.embedding_[i, 1]),
			textcoords="offset points",
			xytext=(3,3),
			ha='left',
			fontsize=6,
			alpha=0.5
		)

print("plotting umap with party as the colors")
ax[0,1].scatter(fit.embedding_[:, 0], fit.embedding_[:, 1], c=umap_colors_party, alpha=ALPHA_POINTS, s=SCATTER_SIZE)

axis_vector = (pro_mean - con_mean).astype(np.float32)
scalar_values = project_vectors_onto_axis_get_scalar_values(embeddings, axis_vector)
last_y_vals = []
last_value_identifiers = []
print("plotting time series with platform as the colors")
for politician_name in os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis")):
	for plat in ["youtube", "twitter", "parliament"]:
		y_vals = []
		x_vals = []
		for s, yr, pl, pol in zip(scalar_values, years, platforms, politicians):
			if pl == plat and pol == politician_name:
				y_vals.append(s)
				x_vals.append(yr)
		if not y_vals:
			continue
		# sort x_vals and y_vals by x_vals
		x_vals, y_vals = zip(*sorted(zip(x_vals, y_vals)))
		if politician_name in thicker_lines_politicians:
			ax[1, 0].plot(x_vals, y_vals, label=plat, c=platform_cmap[plat], alpha=ALPHA_LINES, linewidth=20)
			ax[1, 1].plot(x_vals, y_vals, label=plat, c=party2color[name2party[politician_name]], alpha=ALPHA_LINES, linewidth=20)
		else:
			ax[1, 0].plot(x_vals, y_vals, label=plat, c=platform_cmap[plat], alpha=ALPHA_LINES)
			ax[1, 1].plot(x_vals, y_vals, label=plat, c=party2color[name2party[politician_name]], alpha=ALPHA_LINES)

		# Annotate the last point of each series with an identifier (politician + platform)
		x_last, y_last = x_vals[-1], y_vals[-1]
		identifier = f"{politician_name}_{plat[0]}"
		ax[1, 0].annotate(
			identifier,
			(x_last, y_last),
			textcoords="offset points",
			xytext=(6, 0),
			ha="left",
			va="center",
			fontsize=15,
			alpha=0.9,
			color=platform_cmap[plat],
		)
		ax[1, 1].annotate(
			identifier,
			(x_last, y_last),
			textcoords="offset points",
			xytext=(6, 0),
			ha="left",
			va="center",
			fontsize=15,
			alpha=0.9,
			color=party2color[name2party[politician_name]],
		)

		last_y_vals.append(y_last)
		last_value_identifiers.append(identifier)

ax[0,0].plot([pro_after_umap[0], con_after_umap[0]], [pro_after_umap[1], con_after_umap[1]], c="black", alpha=1)
ax[0,1].plot([pro_after_umap[0], con_after_umap[0]], [pro_after_umap[1], con_after_umap[1]], c="black", alpha=1)

ax[0,0].set_title("UMAP with platform as the colors", fontsize=20)
ax[0,1].set_title("UMAP with party as the colors", fontsize=20)
ax[1, 0].set_title("Time series with platform as the colors", fontsize=20)
ax[1, 0].set_xlabel("year", fontsize=20)
ax[1, 0].set_ylabel("projection onto axis", fontsize=20)
ax[1, 1].set_title("Time series with party as the colors", fontsize=20)
ax[1, 1].set_xlabel("year", fontsize=20)
ax[1, 1].set_ylabel("projection onto axis", fontsize=20)




def _color_legend_handles(color_map, keys):
	return [
		Line2D(
			[0],
			[0],
			marker="o",
			linestyle="None",
			markersize=10,
			markerfacecolor=color_map[k],
			markeredgecolor="none",
			label=str(k),
		)
		for k in keys
		if k in color_map
	]

party_keys = [k for k in party2color.keys() if k not in {"pro", "con"}]
platform_keys = [k for k in platform_cmap.keys() if k in {"youtube", "twitter", "parliament"}]

ax[0, 0].legend(
	handles=_color_legend_handles(platform_cmap, platform_keys),
	title="Platform",
	fontsize=30,
	title_fontsize=30,
	loc="upper left",
	bbox_to_anchor=(1, 1),
)
ax[0, 1].legend(
	handles=_color_legend_handles(party2color, party_keys),
	title="Party",
	fontsize=30,
	title_fontsize=30,
	loc="upper left",
	bbox_to_anchor=(1, 1),
)

ax[1, 0].legend(
	handles=_color_legend_handles(platform_cmap, platform_keys),
	title="Platform",
	fontsize=30,
	title_fontsize=30,
	loc="upper left",
	bbox_to_anchor=(1, 1),
)
ax[1, 1].legend(
	handles=_color_legend_handles(party2color, party_keys),
	title="Party",
	fontsize=30,
	title_fontsize=30,
	loc="upper left",
	bbox_to_anchor=(1, 1),
)

plt.tight_layout()
output_dir = os.path.join(ROOT_DIR, "tmp")
os.makedirs(output_dir, exist_ok=True)
plt.savefig(os.path.join(output_dir, f"{datetime.now().strftime('%Y%m%d%H%M%S')}_visualization_with_summary.png"))
plt.close("all")
ax[0,0].clear()
ax[0,1].clear()
ax[1,0].clear()
ax[1,1].clear()


# ## Now generate the same visulization but a separete plot for each representative

# In[ ]:


from collections import defaultdict
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
# check all lenght are equal
print("scalar_values", len(scalar_values))
print("years", len(years))
print("platforms", len(platforms))
print("politicians", len(politicians))
print("fit.embedding_[:, 0]", len(fit.embedding_[:-2, 0]))
print("fit.embedding_[:, 1]", len(fit.embedding_[:-2, 1]))
print("umap_vectors", len(umap_vectors[:-2]))
assert len(scalar_values) == len(years) == len(platforms) == len(politicians) == len(fit.embedding_[:-2, 0]) == len(fit.embedding_[:-2, 1]) == len(umap_vectors[:-2]) 



def violin_by_year_with_lanes(ax, per_year_per_group, group2color, *, title, xlabel="Year", ylabel="Scalar value",
                              lane_gap=0.25, width=0.20, alpha=0.7, showmeans=False, year_sort_key=int):
    # sort years
    years = sorted(per_year_per_group.keys(), key=year_sort_key)

    # fixed lane order (use dict order if you prefer; here we sort keys)
    groups = sorted({g for yr in years for g in per_year_per_group[yr].keys()})

    # map each year to an integer x position
    x_base = np.arange(1, len(years) + 1)

    # symmetric offsets for lanes inside each year
    n = len(groups)
    offsets = (np.arange(n) - (n - 1) / 2.0) * lane_gap

    legend_handles = []

    for gi, g in enumerate(groups):
        data = []
        positions = []

        for yi, yr in enumerate(years):
            vals = per_year_per_group[yr].get(g, [])
            if not vals:
                continue
            data.append(vals)
            positions.append(x_base[yi] + offsets[gi])

        if not data:
            continue

        vp = ax.violinplot(
            data,
            positions=positions,
            widths=width,
            showmeans=showmeans,
        )

        # color all violins for this group
        color = group2color[g]
        color_violin_plot(vp, [color] * len(vp["bodies"]), alpha=alpha)

        legend_handles.append(Patch(facecolor=color, edgecolor="black", label=str(g), alpha=alpha))

    # year labels on x-axis (at the year centers, not the lane offsets)
    ax.set_xticks(x_base)
    ax.set_xticklabels([str(y) for y in years])
    ax.set_title(title, fontsize=20)
    ax.set_xlabel(xlabel, fontsize=20)
    ax.set_ylabel(ylabel, fontsize=20)

    ax.legend(handles=legend_handles, loc="upper right", fontsize=14)
def violin_year_lanes_no_overlap(
    ax,
    per_year_per_party_scalars,   # dict[year][party] -> list[float]
    party2color,                  # dict[party] -> color
    *,
    title="Year × Party (lane-stacked violins)",
    width=0.22,
    pad=0.25,                     # extra vertical gap between lanes
    year_sort_key=int,
):
    years = sorted(per_year_per_party_scalars.keys(), key=year_sort_key)
    parties = sorted({p for yr in years for p in per_year_per_party_scalars[yr].keys()})

    # Compute a lane height big enough so lanes never overlap
    all_vals = [v for yr in years for p in per_year_per_party_scalars[yr] for v in per_year_per_party_scalars[yr][p]]
    vmin, vmax = float(np.min(all_vals)), float(np.max(all_vals))
    lane_height = (vmax - vmin) + pad

    # x positions for years
    x_base = np.arange(1, len(years) + 1)

    # lane offset per party (stacked vertically)
    party_offset = {p: i * lane_height for i, p in enumerate(parties)}

    # plot each party as its own lane
    for p in parties:
        data = []
        positions = []
        for yi, yr in enumerate(years):
            vals = per_year_per_party_scalars[yr].get(p, [])
            if not vals:
                continue
            # SHIFT vertically into the party's lane
            data.append(np.asarray(vals) + party_offset[p])
            positions.append(x_base[yi])

        if not data:
            continue

        vp = ax.violinplot(
            data,
            positions=positions,
            widths=width,
            showmeans=showmeans
        )
        color_violin_plot(vp, [party2color[p]] * len(vp["bodies"]), alpha=0.75)

    # x axis = years
    ax.set_xticks(x_base)
    ax.set_xticklabels([str(y) for y in years], rotation=0)

    # y axis: show lane labels at each lane's "zero" (offset position)
    lane_centers = [party_offset[p] for p in parties]
    ax.set_yticks(lane_centers)
    ax.set_yticklabels(parties)

    ax.set_title(title, fontsize=20)
    ax.set_xlabel("Year", fontsize=20)
    ax.set_ylabel("Party lane (scalar is relative within lane)", fontsize=20)

    # Optional: draw faint separators between lanes
    for p in parties:
        ax.axhline(party_offset[p], linewidth=0.8, alpha=0.25)


politician_stats_per_platform_file = os.path.join(ROOT_DIR, "tmp", "politician_stats_per_platform.csv")
with open(politician_stats_per_platform_file, "w") as f:
	f.write("politician,platform,var,std\n")

fig, ax = plt.subplots(3,3, figsize=(50,20))
per_politician_scalars = {}
per_platform_scalars = {}
per_party_scalars = {}

per_year_per_platform_scalars = defaultdict(lambda: defaultdict(list))
per_year_per_party_scalars = defaultdict(lambda: defaultdict(list))


for politician_name in os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis")):
	print(f"Generating visualization for {politician_name}")
	filtered_scalar_values = []
	filtered_years = []
	filtered_platforms = []
	filtered_politicians = []
	filtered_fit_embeddings_0 = []
	filtered_fit_embeddings_1 = []
	filtered_platform_colors = []
	filtered_party_colors = []
	filtered_umap_vectors = []
	for s, yr, pl, pol, f0, f1, uv in zip(scalar_values, years, platforms, politicians, fit.embedding_[:-2, 0], fit.embedding_[:-2, 1], umap_vectors[:-2]):
		if pol == politician_name:
			filtered_scalar_values.append(s)
			filtered_years.append(yr)
			filtered_platforms.append(pl)
			filtered_politicians.append(pol)
			filtered_fit_embeddings_0.append(f0)
			filtered_fit_embeddings_1.append(f1)
			filtered_platform_colors.append(platform_cmap[pl])
			filtered_party_colors.append(party2color[name2party[pol]])
			filtered_umap_vectors.append(uv)
		if pl not in per_platform_scalars:
			per_platform_scalars[pl] = []
		per_platform_scalars[pl].append(s)
		if name2party[pol] not in per_party_scalars:
			per_party_scalars[name2party[pol]] = []
		per_party_scalars[name2party[pol]].append(s)
		per_year_per_platform_scalars[yr][pl].append(s)
		per_year_per_party_scalars[yr][name2party[pol]].append(s)

	per_politician_scalars[politician_name] = filtered_scalar_values


def color_violin_plot(vp, colors, alpha = 0.5):
	for body, color in zip(vp['bodies'], colors):
		body.set_facecolor(color)
		body.set_alpha(alpha)
	for part in ['cmeans', 'cmins', 'cmaxes', 'cbars', 'cmedians']:
		if part in vp:
			vp[part].set_color("black")
	return vp

# show quantiles
vp_politician = ax[0,0].violinplot(per_politician_scalars.values(), [y+1 for y in range(len(per_politician_scalars.values()))], quantiles=[[0.25, 0.5, 0.75] for _ in range(len(per_politician_scalars))])
ax[0,0].set_xticks([y+1 for y in range(len(per_politician_scalars.values()))], per_politician_scalars.keys())
ax[0,0].set_title("Violin plot of scalar values for each politician", fontsize=20)
ax[0,0].set_xlabel("Politician", fontsize=20)
ax[0,0].set_ylabel("Scalar value", fontsize=20)
color_violin_plot(vp_politician, [party2color[name2party[pol]] for pol in per_politician_scalars.keys()])


vp_platform = ax[0,1].violinplot(per_platform_scalars.values(), [y+1 for y in range(len(per_platform_scalars.values()))], quantiles=[[0.25, 0.5, 0.75] for _ in range(len(per_platform_scalars))])
ax[0,1].set_xticks([y+1 for y in range(len(per_platform_scalars.values()))], per_platform_scalars.keys())
ax[0,1].set_title("Violin plot of scalar values for each platform", fontsize=20)
ax[0,1].set_xlabel("Platform", fontsize=20)
ax[0,1].set_ylabel("Scalar value", fontsize=20)
color_violin_plot(vp_platform, [platform_cmap[pl] for pl in per_platform_scalars.keys()])

vp_party = ax[0,2].violinplot(per_party_scalars.values(), [y+1 for y in range(len(per_party_scalars.values()))], quantiles=[[0.25, 0.5, 0.75] for _ in range(len(per_party_scalars))])
ax[0,2].set_xticks([y+1 for y in range(len(per_party_scalars.values()))], per_party_scalars.keys())
ax[0,2].set_title("Violin plot of scalar values for each party", fontsize=20)
ax[0,2].set_xlabel("Party", fontsize=20)
ax[0,2].set_ylabel("Scalar value", fontsize=20)
color_violin_plot(vp_party, [party2color[pol] for pol in per_party_scalars.keys()])

violin_year_lanes_no_overlap(
    ax=ax[1,0],
    per_year_per_party_scalars=per_year_per_party_scalars,
    party2color=party2color,
    title="Scalar distribution by year (party lanes, no overlap)",
)

violin_year_lanes_no_overlap(
    ax=ax[1,1],
    per_year_per_party_scalars=per_year_per_platform_scalars,
    party2color=platform_cmap,
    title="Scalar distribution by year (platform lanes, no overlap)",
)

violin_by_year_with_lanes(
    ax=ax[1,2],
    per_year_per_group=per_year_per_platform_scalars,
    group2color=platform_cmap,
    title="Scalar distribution by year (platform lanes)",
)

violin_by_year_with_lanes(
    ax=ax[2,0],
    per_year_per_group=per_year_per_party_scalars,
    group2color=party2color,
    title="Scalar distribution by year (party lanes)",
)

fig.tight_layout()
output_dir = os.path.join(ROOT_DIR, "tmp")
os.makedirs(output_dir, exist_ok=True)
plt.savefig(os.path.join(output_dir, f"{datetime.now().strftime('%Y%m%d%H%M%S')}_violin_plots.png"))
plt.close("all")
ax[0,0].clear()
ax[0,1].clear()
ax[1,0].clear()




# In[ ]:


# from params.paths import DATA_DIR, ROOT_DIR
# import os


# all_repr_speech_parliament_dir = os.path.join(DATA_DIR, "data_all_speeches")


# total_lines = 0
# for meeting_dir in os.listdir(all_repr_speech_parliament_dir):
# 	print(f"processing {meeting_dir}")
# 	speeches_file = os.path.join(all_repr_speech_parliament_dir, meeting_dir, "speeches.jsonl")
# 	number_of_lines = sum(1 for line in open(speeches_file))
# 	total_lines += number_of_lines


# In[5]:


print(total_lines)


# In[7]:


target_files = {
	"twitter": "twitter_data.jsonl",
	"youtube": "youtube_video_meta.jsonl",
	"parliament":"parliament_transcripts_filtered.jsonl"
}

counters = {
	"twitter": 0,
	"youtube": 0,
	"parliament": 0
}

for politician_name in os.listdir(os.path.join(DATA_DIR, "tmp_idea_analysis")):
	politician_dir = os.path.join(DATA_DIR, "tmp_idea_analysis", politician_name)
	for domain in target_files:
		dir_path = os.path.join(politician_dir, f"{domain}_data")
		if not os.path.exists(dir_path):
			continue
		target_file = os.path.join(dir_path, target_files[domain])
		counters[domain] += sum(1 for line in open(target_file))

print(counters)


# In[ ]:




