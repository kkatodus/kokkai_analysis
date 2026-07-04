#!/usr/bin/env python
# coding: utf-8

# In[ ]:


import os
import json
from params.paths import DATA_DIR
from requests import post, get
import re


ALL_SPEECHES_DIR = os.path.join(DATA_DIR, "data_all_speeches")
LOCAL_LLM_PORT = "http://172.24.176.1:1234"
LOCAL_LLM_CODE = "google/gemma-4-e4b"
COMPLETION_ENDPOINT = f"{LOCAL_LLM_PORT}/v1/chat/completions"
LABEL_OUTPUT_DIR = os.path.join(DATA_DIR, "diet_speech_label")
os.makedirs(LABEL_OUTPUT_DIR, exist_ok=True)
segment_label_output_path = os.path.join(LABEL_OUTPUT_DIR, "segment_diet_speech_label.csv")


# In[ ]:


import random as rnd
from dataclasses import dataclass



if not os.path.exists(segment_label_output_path):
	with open(segment_label_output_path, "w") as f:
		f.write("Speech\tLabel\tspeechID\tmeetingID\n")


system_prompt="あなたは政治家の国会議事録を分析する政治学者です。"
get_prompt = lambda text : f"""
以下に示す国会議事録の分類をしてください。もし複数個当てはまると考える場合は、「、」で区切って複数回答してください。'\n'は出力しないでください。必ず「、」で区切って出力してください。

## 分類
・質問文
・追及・確認文
・答弁文
・反論・再反論文
・意見文
・要望・提案文
・批判文
・評価文
・説明文
・事実文
・謝罪・釈明文
・手続・運営文
・その他

## 適切な返答の例
・「質問文」
・「追及・確認文、意見文」
・「要望文、批判文」
など


## 適切ではない返答の例
・政治的な発信をしている
・この政治家の発言は質問文です
・これは答弁分です


## 議事録
{text}

"""

def prompt_local_llm(prompt:str)->None:
	payload = json.dumps({
		"model": LOCAL_LLM_CODE,
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
	res_json = json.loads(response.text)
	print(f"GOT REPLY FROM LLM: \n {str(res_json)}")

	return res_json

try:
	prompt_local_llm("this is a test. reply with 'test'")
except:
	raise ConnectionError("Local server might not be running")

covered_speech_ids = set()

with open(segment_label_output_path, "r") as f:
	for i, line in enumerate(f):
		if i == 0:
			continue
		parts = line.rstrip("\n").split("\t")
		if len(parts) >= 3:
			covered_speech_ids.add(parts[2])

print("Length of covered_speech_ids", len(covered_speech_ids))

def categorize_speech_and_write_to_file(speech:str, speech_id:str, path:str, meeting_id:str)->None:
	llm_output = prompt_local_llm(get_prompt(speech))
	label = llm_output['choices'][0]['message']['content'].replace("\n", "")
	with open(path, "a") as f:
		f.write(f"{speech}\t{label}\t{speech_id}\t{meeting_id}\n")


@dataclass
class Speech:
	speechID: str
	speechOrder: int
	speaker: str
	speakerYomi: str
	speakerGroup: str
	speakerPosition: str
	speakerRole: str
	speech: str
	startPage: int
	createTime: str
	updateTime: str
	speechURL: str

def iterate_speeches_for_meeting(meeting_id:str):
	meeting_dir = os.path.join(ALL_SPEECHES_DIR, meeting_id)
	speeches_file = os.path.join(meeting_dir, "speeches.jsonl")
	for line in open(speeches_file, "r"):
		yield Speech(**json.loads(line))

while True:
	meeting_ids = [
		d for d in os.listdir(ALL_SPEECHES_DIR)
		if os.path.isdir(os.path.join(ALL_SPEECHES_DIR, d))
	]
	random_meeting_id = rnd.choice(meeting_ids)
	print("working on meeting", random_meeting_id)
	for speech_obj in iterate_speeches_for_meeting(random_meeting_id):
		print(speech_obj)

		if speech_obj.speechID in covered_speech_ids:
			print(f"SKIPPING {speech_obj.speechID} because it is already covered")
			continue
		no_white_space_text = re.sub(r"\s+", "", speech_obj.speech)

		for segment in no_white_space_text.split("。"):
			if not segment:
				continue
			categorize_speech_and_write_to_file(
				segment, speech_obj.speechID, segment_label_output_path, random_meeting_id
			)

		covered_speech_ids.add(speech_obj.speechID)


# In[ ]:


## convert the text to jsonl file

segment_label_output_path_jsonl = os.path.join(LABEL_OUTPUT_DIR, "segment_diet_speech_label.jsonl")
whole_label_output_path_jsonl = os.path.join(LABEL_OUTPUT_DIR, "whole_diet_speech_label.jsonl")

CATEGORIES = [
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

def extract_label_from_text(text:str)->str:
	out_categories = []
	for category in CATEGORIES:
		if category in text:
			out_categories.append(category)
	return out_categories


for i, line in enumerate(open(segment_label_output_path, "r")):
	if i == 0:
		continue

	speech, label, speech_id = line.split("\t")
	label = extract_label_from_text(label)
	json_line = json.dumps({
		"speech": speech,
		"label": label,
		"speech_id": speech_id
	}, ensure_ascii=False)
	with open(segment_label_output_path_jsonl, "a") as f:
		f.write(json_line + "\n")

	
	


# In[ ]:




