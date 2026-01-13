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
TABLE_ID = "jpdiet.xdata_parsed"
LOCAL_LLM_PORT = "http://10.5.0.2:1234"
COMPLETION_ENDPOINT = f"{LOCAL_LLM_PORT}/v1/chat/completions"
client = bigquery.Client()
LABEL_OUTPUT_DIR = os.path.join(DATA_DIR, "tweet_label")
os.makedirs(LABEL_OUTPUT_DIR, exist_ok=True)
label_output_path = os.path.join(LABEL_OUTPUT_DIR, "tweet_label.csv")

with open(label_output_path, "w") as f:
	f.write("Tweet\tLabel\tReasoning\n")


try:
	res = get(f"{LOCAL_LLM_PORT}/v1/models")
	print(res.text)
except:
	raise ConnectionError("Local server might not be running")
query = f"""
SELECT text
FROM {TABLE_ID}
"""
system_prompt="あなたは政治家のXでのツイートを分析する政治学者です。"
get_prompt = lambda text : f"""
以下に示すツイートが政治的な発信をしているものか、それとも違うのか判断をしてください。ここでいう政治的な発信とは国の政策や、自分の政治思想に関するツイートのことをいいます。

## 適切な返答の例
・政治
・趣味
・挨拶
・その他

## 適切ではない返答の例
・ツイートのカテゴリは「政治」です
・この政治家は「趣味」について話しています。


## ツイート
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
	

	

query_job = client.query(query)


for row in query_job:
	print(row.text)
	if not row.text:
		continue

	with open(label_output_path, "a") as f:

		no_white_space_text = re.sub(r"\s+", "", row.text)
		llm_output = prompt_local_llm(no_white_space_text)
		
		label = llm_output['choices'][0]['message']['content']
		reasoning = llm_output['choices'][0]['message']['reasoning']
		f.write(f"{no_white_space_text}\t{label}\t{reasoning}\n")
		time.sleep(5)


# In[ ]:




