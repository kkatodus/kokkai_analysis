#!/usr/bin/env python
# coding: utf-8

# In[ ]:


from params.paths import DATA_DIR, ROOT_DIR
import os
from typing import Iterator, Tuple
from dbio.representative_db import get_politician_id_by_name, connect_db
from file_handling.file_read_writer import read_json
import json
from dotenv import load_dotenv

load_dotenv()

ALL_SPEECHES_DIR = os.path.join(DATA_DIR, "data_all_speeches")
OUTPUT_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
os.makedirs(OUTPUT_DIR, exist_ok=True)

RESOURCES_DIR = os.path.join(ROOT_DIR, "resource")
RESOURCES_JSON_PATH = os.path.join(RESOURCES_DIR, "experiment_config.json")
RESOURCES_JSON = read_json(RESOURCES_JSON_PATH)


# In[ ]:


def iterate_meeting_files() -> Iterator[Tuple[str, str]]:
	total_count = len(os.listdir(ALL_SPEECHES_DIR))
	for idx, meeting_id in enumerate(os.listdir(ALL_SPEECHES_DIR)[::-1]):
		meeting_dir = os.path.join(ALL_SPEECHES_DIR, meeting_id)
		meta_file = os.path.join(meeting_dir, "meta.json")
		speeches_file = os.path.join(meeting_dir, "speeches.jsonl")
		yield meta_file, speeches_file, idx, total_count

def iterate_speeches_in_meeting(speeches_file: str) -> Iterator[dict]:
	with open(speeches_file, "r") as f:
		for line in f:
			yield json.loads(line)


def identify_topic_for_speech(speech_text:str) -> str:
	topics = []
	for topic in RESOURCES_JSON:
		if any(word in speech_text for word in topic["search_words"]):
			topics.append(topic["topic_name_en"])
	return topics


# In[ ]:


from collections import defaultdict

try:
	conn = connect_db(
		dbname="kokkaidoc",
		user="postgres",
		password=os.getenv("PSQL_DATABASE_PASSWORD"),
		host="localhost",
		port="5432"
	)
	cur = conn.cursor()

	speaker2speaker_id_cache = {}
	speaker2speech_id_cache = defaultdict(set)

	for meta_file, speeches_file, idx, total_count in iterate_meeting_files():
		progress = f"{idx}/{total_count}"
		print("Progress: ", progress)
		meta_json = read_json(meta_file)
		for speech_dict in iterate_speeches_in_meeting(speeches_file):
			speaker = speech_dict["speaker"]
			if not speaker:
				continue
			if speaker not in speaker2speaker_id_cache:
				try:
					speaker_id = get_politician_id_by_name(cur, speaker, speech_dict["speakerYomi"], speech_dict["speakerGroup"], stop_for_input=False)
					speaker2speaker_id_cache[speaker] = speaker_id
				except Exception as e:
					continue
				if speaker_id is None:
					continue
			elif speaker in speaker2speaker_id_cache:
				speaker_id = speaker2speaker_id_cache[speaker]
			
			os.makedirs(os.path.join(OUTPUT_DIR, str(speaker_id)), exist_ok=True)
			speaker_all_speeches_file = os.path.join(OUTPUT_DIR, str(speaker_id), "all_speeches.jsonl")

			if speaker_id not in speaker2speech_id_cache:
				print("Cache miss for", speaker, speaker_id, "caching done speech ids")
				if os.path.exists(speaker_all_speeches_file):
					with open(speaker_all_speeches_file, "r") as f:
						for line in f:
							speaker2speech_id_cache[speaker_id].add(json.loads(line)["speechID"])

			if speech_dict["speechID"] in speaker2speech_id_cache[speaker_id]:
				print("Speech already exists", speech_dict["speechID"], "skipping")
				continue

			topics = identify_topic_for_speech(speech_dict["speech"])

			with open(speaker_all_speeches_file, "a") as f:
				output_dict = speech_dict | {"meta":meta_json}
				f.write(json.dumps(output_dict, ensure_ascii=False) + "\n")

			for topic in topics:
				topic_file = os.path.join(OUTPUT_DIR, str(speaker_id), f"{topic}.jsonl")
				with open(topic_file, "a") as f:
					output_dict = speech_dict | {"meta":meta_json}
					f.write(json.dumps(output_dict, ensure_ascii=False) + "\n")

			speaker2speech_id_cache[speaker_id].add(speech_dict["speechID"])

			
			
finally:
	conn.close()
	cur.close()
	


# In[ ]:




