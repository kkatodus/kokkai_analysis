#!/usr/bin/env python
# coding: utf-8

# In[4]:


import os
import json
from google.cloud import bigquery
from params.paths import DATA_DIR
from requests import post, get
import re


ORGANIZED_SPEECHES_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
PROJECT_ID = "idea-a"
TABLE_ID = "jpdiet.diet-speech"
LOCAL_LLM_PORT = "http://10.5.0.2:1234"
COMPLETION_ENDPOINT = f"{LOCAL_LLM_PORT}/v1/chat/completions"
client = bigquery.Client()
LABEL_OUTPUT_DIR = os.path.join(DATA_DIR, "diet_speech_label")
os.makedirs(LABEL_OUTPUT_DIR, exist_ok=True)
segment_label_output_path = os.path.join(LABEL_OUTPUT_DIR, "segment_diet_speech_label.csv")
whole_label_output_path = os.path.join(LABEL_OUTPUT_DIR, "whole_diet_speech_label.csv")

if not os.path.exists(segment_label_output_path):
	with open(segment_label_output_path, "w") as f:
		f.write("Speech\tLabel\tspeechID\n")


if not os.path.exists(whole_label_output_path):
	with open(whole_label_output_path, "w") as f:
		f.write("Speech\tLabel\tspeechID\n")


try:
	res = get(f"{LOCAL_LLM_PORT}/v1/models")
	print(res.text)
except:
	raise ConnectionError("Local server might not be running")

query = f"""
SELECT speech, speechID
FROM `{TABLE_ID}`
ORDER BY speechID
"""
system_prompt="あなたは政治家の国会議事録を分析する政治学者です。"
get_prompt = lambda text : f"""
以下に示す国会議事録の分類をしてください。もし複数個当てはまると考える場合は、「、」で区切って複数回答してください。\nは出力しないでください。必ず「、」で区切って出力してください。

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

def prompt_local_llm(speech:str)->None:
	prompt = get_prompt(speech)
	payload = json.dumps({
		"model": "openai/gpt-oss-20b",
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

covered_speech_ids = set()

with open(whole_label_output_path, "r") as f:
	for line in f:
		speech_id = line.split("\t")[2].strip()
		covered_speech_ids.add(speech_id)




def categorize_speech_and_write_to_file(speech:str, speech_id:str, path:str)->None:
	llm_output = prompt_local_llm(speech)
	label = llm_output['choices'][0]['message']['content'].replace("\n", "")
	with open(path, "a") as f:
		f.write(f"{speech}\t{label}\t{speech_id}\n")



query_job = client.query(query)


for row in query_job:
	if row.speechID in covered_speech_ids:
		print(f"SKIPPING {row.speechID} because it is already covered")
		continue
	print(row.speech)
	no_white_space_text = re.sub(r"\s+", "", row.speech)

	categorize_speech_and_write_to_file(no_white_space_text, row.speechID, whole_label_output_path)

	for segment in no_white_space_text.split("。"):
		if not segment:
			continue
		categorize_speech_and_write_to_file(segment, row.speechID, segment_label_output_path)


# In[ ]:




