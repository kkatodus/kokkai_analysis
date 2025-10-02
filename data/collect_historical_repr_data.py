#!/usr/bin/env python
# coding: utf-8

# ## 議員データ収集

# In[1]:


import bs4
import requests
import re
from urllib.parse import urljoin
import os
from params.paths import ROOT_DIR
import pandas as pd
import time
from tqdm import tqdm
import json

from file_handling.file_read_writer import write_json, read_json
from collections import Counter
from api_requests.prompter import DeepResearchGemini

SHUGIIN_REPR_URL = 'https://kokkai.sugawarataku.net/giin/rgiin.html'
SANGIIN_REPR_URL = 'https://kokkai.sugawarataku.net/giin/cgiin.html'

LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin', 'repr_list')
LOWER_HOUSE_DATA_HISTORICAL_TMP = os.path.join(LOWER_HOUSE_DATA_DIR, 'historical')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin', 'repr_list')
UPPER_HOUSE_DATA_HISTORICAL_TMP = os.path.join(UPPER_HOUSE_DATA_DIR, 'historical')
LOWER_HOUSE_LOG = os.path.join(LOWER_HOUSE_DATA_DIR, 'log.txt')
UPPER_HOUSE_LOG = os.path.join(UPPER_HOUSE_DATA_DIR, 'log.txt')
os.makedirs(LOWER_HOUSE_DATA_HISTORICAL_TMP, exist_ok=True)
os.makedirs(UPPER_HOUSE_DATA_HISTORICAL_TMP, exist_ok=True)


# In[2]:


def get_repr_data_prompt(name):
	prompt =  """\
			この政治家のデータを集めてほしいです。
			政治家の名前はNAMEです。
			返答フォーマットは以下のようにしてください。
			
			{
			"name_kanji": "名前",
			"name_kana": "名前のふりがな",
			"years": [
			"当選年-当選月-当選日",
			"当選年-当選月-当選日",
			...
			],
			"election_data": [
				{
					"year": "当選年",
					"month": "当選月",
					"day": "当選日",
					"election_name": "当選回次",
					"district": "選挙区",
					"party": "政党",
					"result": "当選",
					"election_freq": "（1回目）"
				},
				...
			]
			}

			返答フォーマットの例：
			{
				"name_kanji": "七条明",
				"name_kana": "しちじょうあきら",
				"years": [
					"1993-07-18",
					...
				],
				"election_data": [
					{
						"year": "1993年",
						"month": "7月",
						"day": "18日",
						"election_name": "第40回衆議院議員総選挙",
						"district": "徳島全県区",
						"party": "自由民主党",
						"result": "当選",
						"election_freq": "（1回目）"
					},
					...
				]
			}
	"""
	prompt = prompt.replace("NAME", name)

	return prompt

research_system_prompt = """\
	あなたは政治家のデータを集めるアシスタントです。常に最新のデータを集めるために必ず検索をすることを心がけてください。
	また、同姓同名の政治家にも気を付けてください。もし同姓同名政治家がいた場合、これから与える返答フォーマットは無視してください。
	その際は「同姓同名の政治家がいる可能性があります」と返答してください。ちなみに地方政治家は含めず、国会議員のみを集めてください。
	jsonを回答する際には余計な説明等をつけず、生のjsonのみを返答してください。コードブロック（```json）をつけることは絶対にしないでください。
	あなたの返答フォーマットはそのままjson.loadsでパースできるようにしてください。
	"""


# In[ ]:


class ReprHistoricalDataCollector:
	def __init__(self):
		self.prompter = DeepResearchGemini(model_name="gemini-2.5-pro")



	def process_one_election_row(self, row):

		def try_with_backup(cls1, cls2):
			attempt1 = row.find('div', {'class': cls1})
			if attempt1:
				return attempt1.text
			attempt2 = row.find('div', {'class': cls2})
			if attempt2:
				return attempt2.text
			return ""
			
		try:
			
			year = row.find('div', {'class': 'el1'}).text
			month = row.find('div', {'class': 'el2'}).text
			day = row.find('div', {'class': 'el3'}).text
			election_name = row.find('div', {'class': 'el4'}).text
			district = try_with_backup('el5', 'elc5')
			party = try_with_backup('el6', 'elc6')
			result = try_with_backup('el7', 'elc7')
			election_freq = row.find('div', {'class': 'el8'}).text
		except Exception as e:
			print(f'Error processing row: {row},\n error: {e}')
			raise e
		return {'year': year, 'month': month, 'day': day, 'election_name': election_name, 'district': district, 'party': party, 'result': result, 'election_freq': election_freq}

	def retrieve_info_of_one_repr(self, url):
		html = requests.get(url).content
		soup = bs4.BeautifulSoup(html, 'html.parser')
		repr_data = soup.find_all('div', {'class':'jt2'})
		name_kanji = repr_data[0].text
		name_kana = repr_data[1].text
		years = re.findall(r"\d{4}/\d{2}/\d{2}", repr_data[3].text)
		years = [year.replace('/', '-') for year in years]

		election_data = soup.find_all('div', {'class':'em1'})
		election_data = [self.process_one_election_row(row) for row in election_data]

		return {'name_kanji': name_kanji, 'name_kana': name_kana, 'years': years, 'election_data': election_data}

	def collect(self, house:str):
		if house == 'upper':
			url = SANGIIN_REPR_URL
			log_path = UPPER_HOUSE_LOG
		elif house == 'lower':
			url = SHUGIIN_REPR_URL
			log_path = LOWER_HOUSE_LOG
		tempDir = UPPER_HOUSE_DATA_HISTORICAL_TMP if house == 'upper' else LOWER_HOUSE_DATA_HISTORICAL_TMP
		houseDir = UPPER_HOUSE_DATA_DIR if house == 'upper' else LOWER_HOUSE_DATA_DIR
		print(f'Collecting historical data for {house} house representatives into {tempDir}')
		resp = requests.get(url)
		resp.encoding = "cp932"
		soup = bs4.BeautifulSoup(resp.text, 'lxml')
		links = soup.find_all('span', {'class':'zt5'})
		print(links)
		names = [link.find('a').get_text(strip=True) for link in links]
		print(names)
		hrefs = [link.find('a').get('href') for link in links]
		if Counter(names).most_common()[0][1] > 1:
			print(Counter(names).most_common())
			raise ValueError('There are duplicate names in the historical data')

		if os.path.exists(log_path):
			with open(log_path, 'r') as f:
				done_names = f.readlines()
		else:
			done_names = []


		for idx, (name, href) in enumerate(zip(names, hrefs)):
			if name in done_names:
				print(f'{name} already done')
				continue
			print(f'Processing {name}-{idx/len(names)*100:.2f}%')
			repr_path = os.path.join(tempDir, f'{name}.json')
			user_input = None
			if os.path.exists(repr_path):
				repr_data = read_json(repr_path)
				if repr_data["name_kana"] != "":
					print(f'{name} already exists')
					with open(log_path, 'a') as f:
						f.write(f'{name}\n')
					continue
				else:
					print(f"Data incomplete for {name}")
					prompt = get_repr_data_prompt(name)
					count = 0
					while True:
						try:
							reply, _, _ = self.prompter.prompt(prompt, research_system_prompt)
							print("REPLY:", reply)
							if reply == "同姓同名の政治家がいる可能性があります":
								# user_input = input(f"同姓同名の政治家がいる可能性があります。{name}の生年月日を入力してください。そっちをまず収集します。")
								user_input = "skip"
								print("SKIPPING")
								break
								
								# reply, _, _ = self.prompter.prompt(
								# 	prompt + "\n" + user_input+"が生年月日の政治家のほうの情報を収集してください。", research_system_prompt
								# )
								# print("REPLY:", reply)
							repr_data = json.loads(reply)
							break
						except Exception as e:
							print(f"Error parsing reply: {e}")
							time.sleep(1)
				if user_input == "skip":
					continue
			else:
				repr_link = urljoin(url, href)
				repr_data = self.retrieve_info_of_one_repr(repr_link)
				
				if repr_data["name_kanji"] != name:
					print(f'{name} has a different name in the historical data {repr_data["name_kanji"]}')
					count = 0
					while True:
						try:
							prompt = get_repr_data_prompt(name)
							reply, _, _ = self.prompter.prompt(prompt, research_system_prompt)
							if reply == "同姓同名の政治家がいる可能性があります":
								user_input = input(f"同姓同名の政治家がいる可能性があります。{name}の生年月日を入力してください。そっちをまず収集します。")
								reply, _, _ = self.prompter.prompt(
									prompt + "\n" + user_input+"が生年月日の政治家のほうの情報を収集してください。", research_system_prompt
								)
							print("REPLY:", reply)
							repr_data = json.loads(reply)
							break
						except Exception as e:
							print(f"Error parsing reply: {e}")
							time.sleep(1)
							count += 1
							if count > 3:
								raise e
					repr_data = json.loads(reply)
			path = os.path.join(tempDir, f'{name}{user_input if user_input else ""}.json')
			write_json(repr_data, path)
			with open(log_path, 'a') as f:
				f.write(f'{name}\n')
			time.sleep(1)

		all_repr_data = []
		if Counter(list(os.listdir(tempDir))).most_common()[0][1] > 1:
			print(Counter(list(os.listdir(tempDir))).most_common())
			raise ValueError('There are duplicate names in the historical data')

		covered_files = set()
		for repr_file in os.listdir(tempDir):
			if repr_file in covered_files:
				raise ValueError(f'{repr_file} already exists')
			covered_files.add(repr_file)
			repr_path = os.path.join(tempDir, repr_file)
			repr_data = read_json(repr_path)
			all_repr_data.append(repr_data)
		all_repr_data_names = [repr_data['name_kanji'] for repr_data in all_repr_data]
		if Counter(all_repr_data_names).most_common()[0][1] > 1:
			print(Counter(all_repr_data_names).most_common())
			raise ValueError('There are duplicate names in the historical data')

		write_json({'data':all_repr_data}, os.path.join(houseDir, 'historical.json'))


# In[ ]:


sc = ReprHistoricalDataCollector()
# sc.collect("lower")
sc.collect("upper")


# ## 参議院議員収集

# In[ ]:


from tabula import read_pdf

UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin', 'repr_list')
MEMBER_LIST_PDF_PATH = os.path.join(ROOT_DIR, 'data', 'data_sangiin', '2022giin_list_a.pdf')


# In[ ]:


def gengo2seireki(gengo):

	gengo_num = int(gengo[1:])
	if '昭' in gengo:
		gengo_num += 1925
	elif '平' in gengo:
		gengo_num += 1988
	elif '令' in gengo:
		gengo_num += 2018
	return gengo_num

def extract_gengo(string):
	# Regex pattern: Match characters inside parentheses but NOT if followed by a date
    pattern = re.compile(r'\((昭\d{1,2}|平\d{1,2})(?!\.\d)\)')
    
    # Find all matches
    matches = pattern.findall(string)
    
    return matches

def apply_gengo2seireki(string):
	string = string.replace('元', '1')
	gengos = extract_gengo(string)
	seirekis = []
	for gengo in gengos:
		seireki = gengo2seireki(gengo)
		seirekis.append(str(seireki))
	return '-'.join(seirekis)


# In[ ]:


df = read_pdf(MEMBER_LIST_PDF_PATH, pages='all')

master_df = df[0]
for i in range(1, len(df)):
	master_df = master_df.append(df[i])
master_df = master_df.replace('\r', '', regex=True)
master_df = master_df.replace('\n', '', regex=True)
df_path = os.path.join(UPPER_HOUSE_DATA_DIR, '2022.csv')

master_df.to_csv(df_path, index=False)


# In[ ]:


df = pd.read_csv(df_path)
df['西暦'] = df['選挙回次等'].apply(apply_gengo2seireki)


df.to_csv(os.path.join(UPPER_HOUSE_DATA_DIR, '2022_processed.csv'), index=False)
df.head()


# In[ ]:





# In[ ]:




