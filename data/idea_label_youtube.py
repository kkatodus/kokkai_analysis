#!/usr/bin/env python
# coding: utf-8

# In[ ]:


import os
import json
from google.cloud import bigquery
from params.paths import DATA_DIR
from requests import post, get
import time
import re


ORGANIZED_SPEECHES_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
PROJECT_ID = "idea-a"
TABLE_ID = "jpdiet.transcripts"
LOCAL_LLM_PORT = "http://10.5.0.2:1234"
COMPLETION_ENDPOINT = f"{LOCAL_LLM_PORT}/v1/chat/completions"
client = bigquery.Client()
LABEL_OUTPUT_DIR = os.path.join(DATA_DIR, "youtube_label")
os.makedirs(LABEL_OUTPUT_DIR, exist_ok=True)
label_output_path = os.path.join(LABEL_OUTPUT_DIR, "youtube_label.jsonl")





try:
	res = get(f"{LOCAL_LLM_PORT}/v1/models")
	print(res.text)
except:
	raise ConnectionError("Local server might not be running")
query = f"""
SELECT text, video_id
FROM {TABLE_ID}
"""
system_prompt="あなたは政治家のYoutubeの動画を分析する政治学者です。"
get_prompt = lambda text : f"""
以下に示す政治家のyoutube動画での発言が政治的な発信をしているものか、それとも違うのか判断をしてください。政治的な発信とは、国の政策や、自分の政治思想に関する発言のことをいいます。ただ政治家の名前を言っているだけであったり、広く一般に知られていることを言っているだけであれば政治的な発信とはいいません。
また、政治的な発言なのであれば以下から発言のカテゴリを選択して教えてください。（複数選択可）

## 発言のカテゴリ
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
・政治、質問文、意見文
・政治、答弁文、批判文
・その他、その他
・その他、質問文
・政治、質問文、意見文、答弁文

## 適切ではない返答の例
・発言は政治的な発言で、カテゴリは「政治、質問文、意見文」です
・この発言は政治的な発言ではありません


## 発言
{text}

"""

def prompt_local_llm(tweet:str)->None:
	prompt = get_prompt(tweet)
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

def add_periods(text: str) -> str:
	"""Insert Japanese periods after sentence-ending phrases.

	- Adds "。" after any occurrence of the end words.
	- Does NOT add if it's already followed by punctuation like "。", "！", "？".
	"""
	end_words = ["ですね", "ですよ", "である", "です", "ます", "だ"]
	pattern = "(" + "|".join(re.escape(w) for w in end_words) + ")"
	# Replace end-word occurrences not already followed by punctuation.
	return re.sub(pattern + r"(?![。！？!?])", r"\1。", text)

query_job = client.query(query)

covered_video_ids = set()
if os.path.exists(label_output_path):
	with open(label_output_path, "r") as f:
		for line in f:
			json_line = json.loads(line)
			covered_video_ids.add(json_line["video_id"])

for row in query_job:
	print(row.text)
	if not row.text:
		continue

	if row.video_id in covered_video_ids:
		print(f"SKIPPING {row.video_id} because it is already covered")
		continue

	with open(label_output_path, "a") as f:

		no_white_space_text = re.sub(r"\s+", "", row.text)
		# add a few spaces to the text to avoid memory error
		no_white_space_text = add_periods(no_white_space_text)
		llm_output = prompt_local_llm(no_white_space_text)
		counter = 0
		while True:
			try:
				label = llm_output['choices'][0]['message']['content']
				json_line = json.dumps({
					"text": no_white_space_text,
					"label": label,
					"video_id": row.video_id
				}, ensure_ascii=False)
				f.write(json_line + "\n")
				break

			except:
				print(f"Error: {llm_output}")
				print(f"TRYING AGAIN WITH SHORTER TEXT: {len(no_white_space_text)}")
				break
		time.sleep(1)


# In[ ]:




