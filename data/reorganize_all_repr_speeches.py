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


# In[20]:


def iterate_meeting_files() -> Iterator[Tuple[str, str]]:
	for meeting_id in os.listdir(ALL_SPEECHES_DIR):
		meeting_dir = os.path.join(ALL_SPEECHES_DIR, meeting_id)
		meta_file = os.path.join(meeting_dir, "meta.json")
		speeches_file = os.path.join(meeting_dir, "speeches.jsonl")
		yield meta_file, speeches_file

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


try:
	conn = connect_db(
		dbname="kokkaidoc",
		user="postgres",
		password=os.getenv("PSQL_DATABASE_PASSWORD"),
		host="localhost",
		port="5432"
	)
	cur = conn.cursor()



	for meta_file, speeches_file in iterate_meeting_files():
		meta_json = read_json(meta_file)
		for speech_dict in iterate_speeches_in_meeting(speeches_file):
			speaker = speech_dict["speaker"]
			if not speaker:
				continue
			try:
				speaker_id = get_politician_id_by_name(cur, speaker, speech_dict["speakerYomi"], speech_dict["speakerGroup"], stop_for_input=False)
			except Exception as e:
				print(e)
				continue
			if speaker_id is None:
				continue
			os.makedirs(os.path.join(OUTPUT_DIR, str(speaker_id)), exist_ok=True)
			speaker_all_speeches_file = os.path.join(OUTPUT_DIR, str(speaker_id), "all_speeches.jsonl")
			covered_speech_ids = []
			if os.path.exists(speaker_all_speeches_file):
				with open(speaker_all_speeches_file, "r") as f:
					for line in f:
						covered_speech_ids.append(json.loads(line)["speechID"])

			if speech_dict["speechID"] in covered_speech_ids:
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

			
			
finally:
	conn.close()
	cur.close()
	


# In[ ]:




