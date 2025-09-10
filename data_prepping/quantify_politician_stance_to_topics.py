#!/usr/bin/env python
# coding: utf-8

# # About the code
# Work done for undergraduate thesis of Ken Kato at University of Toronto under the supervision of Dr. Christopher Cochrane.
# 
# 
# Thesis title: "KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives"
# 
# - **Part 1: Procedure for creating embeddings**
# 	1. Summarize the opinion based sentences of each politician by prompting GPT4 ✅
# 	2. Create one single "opinion-embedding" for each politician and store it in a retrievable manner.✅
# 
# - **Part 2: Extract axis of political controversy from the summaries and generate speeches that represent the extremes of the axis using GPT4✅**
# 
# - **Part 3: Projection of the politicians onto the axis and visualization**
# 
# 	1. Create a stance axis vector by generating two reference points✅ 
# 	2. Collapse all the other vectors onto this axis by projecting them onto the axis✅
# 	3. Create a scalar measurement for how far each politician is from the two reference points✅
# 	4. Use UMAP dim reduction to see the positions of the politicians as well as the generated/selected reference points✅
# 
# - **Part 4: Creating groups of politicians based on where their embeddings lie on an axis**
# 	1. Creating groups of politicians based on where they are positioned✅
# 	2. Measure PMI of noun phrases in the summaries of the politicians in each group to see what stances are associated with each group✅
# 
# - **Part 5: Create a diachronic analysis of how politicians have evolved on long-standing issues such as JSDF and constitution and nuclear power**
# 	1. Analyze the stance of politicians on yearly basis
# 
# - **Notes**
# 	- Data is stored under `data/data_repr` directory

# In[ ]:


import os
from sentence_transformers import models, SentenceTransformer
import h5py
import umap
import numpy as np
import torch
import re
from datetime import datetime
from tqdm import tqdm
from params.paths import ROOT_DIR
import japanize_matplotlib 
import matplotlib.pyplot as plt
import logging
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file, read_hdf5_file, read_txt_file, is_file_stale, get_newest_file
from utils.string_process import clean_repr_name

import random as rnd
from dotenv import load_dotenv
load_dotenv()

VERBOSE = True


#Data Dir
DATA_DIR = os.path.join(ROOT_DIR, 'data')
DATA_REPR_SPEECHES_DIR = os.path.join(DATA_DIR, 'data_repr_speeches')
REPR_SUMMARY_PATH = os.path.join(DATA_DIR, 'data_repr_speeches', 'summary.json')
#Resources
RESOURCE_DIR = os.path.join(ROOT_DIR, 'resource')
TEST_DIR = os.path.join(ROOT_DIR, 'test')
os.makedirs(TEST_DIR, exist_ok=True)
#Politician Lists
politician_list = read_json(REPR_SUMMARY_PATH)['reprs']
#Results
RESULTS_DIR = os.path.join(ROOT_DIR, 'results')
TODAYS_RESULTS = os.path.join(RESULTS_DIR, datetime.now().strftime('%Y%m%d'))
#Logger
log_dir = os.path.join(TODAYS_RESULTS, 'logs')
create_dir(log_dir)
logging.basicConfig(filename=os.path.join(log_dir, 'quantify_politician_stance.log'), filemode='w', format='%(asctime)s - %(message)s')
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
	raise ValueError('Please set OPENAI_API_KEY in .env file.')


create_dir(RESULTS_DIR)
create_dir(TODAYS_RESULTS)
#Plots
TODAYS_PLOTS = os.path.join(TODAYS_RESULTS, 'plots')
create_dir(TODAYS_PLOTS)
#Configs
EXPERIMENT_CONFIG_PATH = os.path.join(RESOURCE_DIR, 'experiment_config.json')
EXPERIMENT_CONFIG = read_json(EXPERIMENT_CONFIG_PATH)
#Other data
PARTY_TO_COLOR = {
	'自民': 'black',
	'国民': 'blue',
	'立憲': 'orange',
	'公明': 'lightblue',
	'共産': 'red',
	'維新': 'gold',
	'れ新': 'green',
	'無所属': 'purple',
	'有志': 'grey',
	'沖縄':'pink',
	'女子': 'violet',
	'保守':'brown',
	'参政':'cyan',
	'N党': 'lightcoral',
}
TOPICJP_TO_TOPICEN = {
	'防衛': 'Defence',
	'原発': 'Nuclear Power',
	'経済対策': 'Economy',
	'気候変動': 'Climate Change',
	'少子化': 'Declining Birthrate',
}
PARTYJP_TO_PARTYEN = {
	'自民': 'LDP',
	'国民': 'NDP',
	'立憲': 'CDP',
	'公明': 'Komeito',
	'共産': 'JCP',
	'維新': 'JRP',
	'れ新': 'Reiwa',
	'有志': 'Independents',
	'沖縄':'Okinawa',
	'女子':'Women',
	'保守':'CPJ',
	'参政':'Sansei',
	'無所属':'None',
	'N党': 'N Party',
}

PARTY2GLOBALNAME = {
	'自民': '自民',
	'国民': '国民',
	'民主': '国民',
	'立憲': '立憲',
	'公明': '公明',
	'共産': '共産',
	'維新': '維新',
	'れ新': 'れ新',
	'無': '無所属',
	'有志': '有志',
	'沖縄':'沖縄',
	'女子':'女子',
	'保守':'保守',
	'参政':'参政',
	'無所属':'無所属',
	'N党': 'N党',
	'Ｎ党': 'N党',
}

PARTIES = list(PARTY_TO_COLOR.keys())

# IGNORE_PARTIES = ['無', '有志', 'れ新', '女子', '沖縄']
IGNORE_PARTIES = []
PARTY_TO_IDX = {party: idx for idx, party in enumerate(PARTIES)}
IDX_TO_PARTY = {idx: party for idx, party in enumerate(PARTIES)}
if len(PARTYJP_TO_PARTYEN) != len(PARTY_TO_COLOR):
	print('Missing these parties in PARTY_TO_COLOR: ', set(PARTYJP_TO_PARTYEN) - set(PARTY_TO_COLOR.keys()))
	raise ValueError('PARTIES and PARTY_TO_COLOR must have the same length.')
MODEL_NAME = "cl-tohoku/bert-base-japanese-v3"
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin')

#reading the reprentative data for lower and upper house
lower_repr_dir = os.path.join(LOWER_HOUSE_DATA_DIR, 'repr_list')
lower_repr_file = "20241218_repr_list.json"
lower_house_meeting_dict = read_json(os.path.join(lower_repr_dir, lower_repr_file))
lower_repr_dict = lower_house_meeting_dict['reprs']

upper_repr_dir = os.path.join(UPPER_HOUSE_DATA_DIR, 'repr_list')
upper_repr_file = "20241218_repr_list.json"
upper_house_meeting_dict = read_json(os.path.join(upper_repr_dir, upper_repr_file))
upper_repr_dict = upper_house_meeting_dict['reprs']

print("Lower Repr File", lower_repr_file)
print("Upper Repr File", upper_repr_file)
print('-----------------------------------')
print('DATA_DIR: ', DATA_DIR)
print('DATA_REPR_SPEECHES_DIR: ', DATA_REPR_SPEECHES_DIR)
print('PARTIES: ', PARTIES)
print("TODAYS RESULTS", TODAYS_RESULTS)
print('-----------------------------------')


# In[3]:


# create inverted dict for repr to repr data
repr_to_repr_data = {}
for house, repr_dict in zip(['lower', 'upper'],[lower_repr_dict, upper_repr_dict]):
	for party, reprs in repr_dict.items():
		for repr in reprs:
			name = clean_repr_name(repr['name'])

			repr_to_repr_data[name] = repr
			repr_to_repr_data[name]['party'] = party
			repr_to_repr_data[name]['house'] = house


# ## Part 1: Procedure for creating embeddings
# 1. Summarize the opinion based sentences of each politician by prompting GPT4
# 2. Create one single "opinion-embedding" for each politician and store it in a retrievable manner.

# In[ ]:


# adapted from: https://osima.jp/posts/sentence-bert/
def fix_seed(seed=42):
	np.random.seed(seed)
	torch.manual_seed(seed)
	torch.cuda.manual_seed(seed)
	torch.backends.cudnn.deterministic = True

fix_seed()

sentence_transformer = models.Transformer(MODEL_NAME)

pooling = models.Pooling(
    sentence_transformer.get_word_embedding_dimension(),
    pooling_mode_mean_tokens=False,
    pooling_mode_cls_token=True,
    pooling_mode_max_tokens=False)

st = SentenceTransformer(modules=[sentence_transformer, pooling])
tk = st.tokenizer
print(tk.tokenize('特急はくたか'))
gen_for_embedding = st.encode('これとかあれとか', convert_to_tensor=True)
print('shape', gen_for_embedding.shape)


# In[21]:


from api_requests.prompter import Prompter
from prompts.summary import SummaryPrompt
from itertools import groupby
prompter = Prompter()
summary_prompter = SummaryPrompt()


def all_equal(iterable):
	g = groupby(iterable)
	return next(g, True) and not next(g, False)

def embed_speeches(speeches):
	encoded_opinions = st.encode(speeches, convert_to_tensor=True, show_progress_bar=True)
	return encoded_opinions

def summarize_opinions(opinions, topic):
	prompt = summary_prompter.generate_summary_prompt(opinions=opinions, topic=topic)

	summary = prompter.prompt(prompt=prompt, system_prompt='国会議事録から抽出した政治家の意見文を要約する手伝いをしてもらいます。')
	logger.info(f'Summary for {topic}:\n{summary}')
	return summary


def read_opinion_sentences_and_dates(file_path):
	logger.info(f'Reading {file_path}')
	if not os.path.exists(file_path):
		raise ValueError(f'File not found: {file_path}')
	target_dict = read_json(file_path)
	if not target_dict:
		return [], []
	opinion_sentences = []
	dates = []
	for speech in target_dict['speeches']:
		date = [speech['date'] for _ in range(len(speech['extracted_opinions']))]
		opinions = speech['extracted_opinions']
		opinion_sentences.extend(opinions)
		dates.extend(date)
	
	return opinion_sentences, dates

def summarize_for_repr(party:str, repr_name:str, topic:str, stale_check_days:int=2, summarize_speech_cutoff_number:int=3)->str:
	logger.info(f'Working on {topic}-{party}-{repr_name}')
	party_path = os.path.join(DATA_REPR_SPEECHES_DIR, party)
	repr_path = os.path.join(party_path, repr_name)
	topic_path = os.path.join(repr_path, topic)
	if not os.path.exists(topic_path):
		logger.info(f'No topic found for {topic} in {repr_path}')
		return None

	file_path = os.path.join(topic_path, 'opinions.json')
	topic_opinions, topic_dates = read_opinion_sentences_and_dates(file_path)
	
	if not topic_opinions:
		logger.info(f'No opinions found for {topic} in {repr_path}')
		return None
	if len(topic_opinions) < summarize_speech_cutoff_number:
		logger.info(f'Not enough opinions found for {topic} in {repr_path}')
		return None
	
	summary_txt_path = os.path.join(topic_path, 'summary.txt')
	summary_json_path = os.path.join(topic_path, 'summary.json')
	
	if is_file_stale(summary_txt_path, max_day_stale=stale_check_days):
		repr_topic_summaries = []
		print('File is stale. Generating new summary.', summary_txt_path)
		for _ in range(3):
			summary = summarize_opinions(topic_opinions, topic)
			repr_topic_summaries.append(summary)

		
		write_json({'summaries': repr_topic_summaries}, summary_json_path)
		
		with open(summary_txt_path, 'w', encoding='utf-8') as f:
			f.write('----------'.join(repr_topic_summaries))
		return repr_topic_summaries
	else:
		print('File is not stale. Reading from file.', summary_txt_path)
		summaries = read_json(summary_json_path)['summaries']
		return summaries

class SpeechSummarizer:
	def __init__(self):
		pass
	def summarize(self, topic:str, stale_check_days:int=3):
		for repr_dict in [lower_repr_dict, upper_repr_dict]:
			for party, reprs in repr_dict.items():
				logger.info(f'Working on {party}')
				repr_names = [clean_repr_name(repr['name']) for repr in reprs]
				for repr_name in repr_names:
					summary = summarize_for_repr(party, repr_name, topic, stale_check_days=stale_check_days)
					if summary is None:
						continue
	
	def embed(self, topic, stale_check_dayshdf5=2, summarize_speech_cutoff_number=3):
		summary_repr_names = []
		summary_repr_parties = []
		summary_txts = []
		embeddings = []
		topic_hdf5_path = os.path.join(DATA_REPR_SPEECHES_DIR, f'{topic}_summaries.hdf5')
		if os.path.exists(topic_hdf5_path):
			if not is_file_stale(topic_hdf5_path, max_day_stale=stale_check_dayshdf5):
				logger.info(f'{topic_hdf5_path} is not stale.')
				return

		for repr_dict in [lower_repr_dict, upper_repr_dict]:
			for party, reprs in repr_dict.items():
				logger.info(f'Working on {party}')
				repr_names = [clean_repr_name(repr['name']) for repr in reprs]
				# print(f'{party} ----- {repr_name}')
				# logger.info(f'{party} ----- {repr_name}')
				for repr_name in repr_names:
					summary = summarize_for_repr(party, repr_name, topic, summarize_speech_cutoff_number=summarize_speech_cutoff_number, stale_check_days=300)
					if summary is None:
						continue
					summary_repr_names.append(repr_name)
					summary_repr_parties.append(party)
					summary_txts.append(summary)
					summary_embd = embed_speeches(summary).mean(axis=0).cpu().numpy()
					embeddings.append(summary_embd)
		summary_embeddings = np.array(embeddings)
		if not all_equal([len(summary_repr_names), len(summary_repr_parties), len(summary_embeddings), len(summary_txts)]):
			raise ValueError('Lengths of repr_names, repr_parties, embeddings, and txts must be equal.')
		with h5py.File(topic_hdf5_path, 'w') as f:
			f.create_dataset('repr_names', data=summary_repr_names, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('repr_parties', data=summary_repr_parties, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('embeddings', data=summary_embeddings)
			f.create_dataset('summaries', data=summary_txts, dtype=h5py.string_dtype(encoding='utf-8'))		



# In[26]:


summarizer = SpeechSummarizer()
# TOPICS_TO_SUMMARIZE = ['防衛', '原発', '経済対策', '気候変動', '少子化', 'LGBTQ']
# TOPICS_TO_SUMMARIZE = ['防衛']
TOPICS_TO_SUMMARIZE = [ "物価高対策・減税と賃上げ", "社会保障全般の見直し（医療・介護）", "年金制度改革・基礎年金底上げ", "マイナンバー", "夫婦別姓", "オンライン投票", "防衛", "原発","経済対策","少子化"]
for topic in TOPICS_TO_SUMMARIZE:
	print(f'Embedding {topic}')
	summarizer.embed(topic, stale_check_dayshdf5=0)


# ## Part 2: Extract axis of political controversy from the summaries and generate speeches that represent the extremes of the axis using GPT4

# In[8]:


from prompts.generate_example import generate_example_prompt
from prompts.extract_controversy import ExtractControversyPrompt

class ControversyAxis:
	def __init__(self):

		self.prompter = Prompter()
		self.axis_controversy_prompter = ExtractControversyPrompt()

	def get_all_summaries_for_topic(self, topic):
		all_summaries = []
		for repr_dict in [lower_repr_dict, upper_repr_dict]:
			for party, reprs in repr_dict.items():
				logger.info(f'Working on {party}')
				party_path = os.path.join(DATA_REPR_SPEECHES_DIR, party)
				repr_names = [clean_repr_name(repr['name']) for repr in reprs]
				for repr_name in tqdm(repr_names):
					# print(f'{party} ----- {repr_name}')
					logger.info(f'{party} ----- {repr_name}')
					repr_path = os.path.join(party_path, repr_name)
					topic_path = os.path.join(repr_path, topic)
					summary_path = os.path.join(topic_path, 'summary.txt')
					if not os.path.exists(summary_path):
						logger.info(f'No summary found for {repr_name} in {topic}')
						continue
					with open(summary_path, 'r', encoding='utf-8') as f:
						summary = f.read()
					all_summaries.append(summary)
		return all_summaries

	def process_axis_reply(self, axis_reply):
		pattern = r"論点：(.*?)\s+賛成：(.*?)\s+反対：(.*?)\s*(?=論点|$)"
		axis_reply_json = []
		for match in re.finditer(pattern, axis_reply):
			axis_reply_json.append({
				'topic': match.group(1),
				'pro': match.group(2),
				'con': match.group(3)
			})
		return axis_reply_json


	def generate_controversy_axis_for_topic(self, topic):
		all_summaries = self.get_all_summaries_for_topic(topic)
		rnd.shuffle(all_summaries)
		prompt = self.axis_controversy_prompter.generate_axis_extraction_prompt(all_summaries, topic)
		axis_reply = self.prompter.prompt(prompt=prompt, system_prompt='国会議事録から抽出した政治家のスタンスの要約をもとに、論点を抽出する手伝いをしてもらいます。', shorten_ok=False)
		axis_reply_json = self.process_axis_reply(axis_reply)
		return axis_reply_json, prompt, axis_reply
	
	def generate_example_speeches_for_axis(self, topic, pro, con):
		result = {}
		for stance_name, stance in zip(['pro', 'con'], [pro, con]):

			instruction = generate_example_prompt(topic, stance)
			print('Instruction:', instruction)
			opinion_sentences = []
			for i in range(10):
				print('Generating example for ', stance_name, 'iteration', i)	
				opinion = self.prompter.prompt(prompt=instruction, system_prompt='政治トピックに対するスタンスからそのスタンスに合致する意見文を生成する手伝いをしてもらいます。')
				opinion_sentences.append(opinion)
			result[stance_name] = {
				'opinions': opinion_sentences,
				'instruction': instruction,
				'stance': stance
			}
		return result				
	


# In[ ]:


TOPICS_TO_CREATE_AXIS_FOR = ["物価高対策・減税と賃上げ", "社会保障全般の見直し（医療・介護）", "年金制度改革・基礎年金底上げ", "マイナンバー", "夫婦別姓", "オンライン投票",]

controversy_axis = ControversyAxis()
axis_dir = os.path.join(ROOT_DIR, 'axis')
os.makedirs(axis_dir, exist_ok=True)

for topic in TOPICS_TO_CREATE_AXIS_FOR:
	if os.path.exists(os.path.join(axis_dir, topic, f'{topic}_axis.json')):
		print(f'{topic} axis already exists')
		continue
	axis_reply_json = []
	counter = 0
	while not len(axis_reply_json):
		print('Trying to get axis for ', topic, 'Attempt:', counter)
		axis_reply_json, prompt, axis_reply = controversy_axis.generate_controversy_axis_for_topic(topic)
	topic_axis_path = os.path.join(axis_dir, topic)
	os.makedirs(topic_axis_path, exist_ok=True)
	text_path = os.path.join(topic_axis_path, f'{topic}_axis.txt')
	if not is_file_stale(text_path, max_day_stale=1):
		print(f'{topic} axis already exists')
		continue
	with open(text_path, 'w', encoding='utf-8') as f:
		f.write(axis_reply)
	with open(os.path.join(topic_axis_path, f'{topic}_axis_prompt.txt'), 'w', encoding='utf-8') as f:
		f.write(prompt)
	write_json(axis_reply_json,os.path.join(topic_axis_path, f'{topic}_axis.json'))


# In[ ]:


TOPICS_TO_CREATE_AXIS_FOR = ["物価高対策・減税と賃上げ", "社会保障全般の見直し（医療・介護）", "年金制度改革・基礎年金底上げ", "マイナンバー", "夫婦別姓", "オンライン投票",]
controversy_axis = ControversyAxis()

for topic in TOPICS_TO_CREATE_AXIS_FOR:
	print('Generating example speeches for ', topic)
	axis_reply_json = read_json(os.path.join(axis_dir, topic, f'{topic}_axis.json'))
	examples_dir = os.path.join(axis_dir, topic, 'examples')
	os.makedirs(examples_dir, exist_ok=True)
	for axis in axis_reply_json:
		
		
		example_speeeches_path = os.path.join(examples_dir, f'{axis["topic"]}_example_speeches.json')
		if not is_file_stale(example_speeeches_path, max_day_stale=1):
			print('File is not stale. Moving on.', axis['topic'])
			continue
		print(axis['topic'])
		pro_opinion = axis['pro']
		con_opinion = axis['con']
		axis_topic = axis['topic']
		example_speeches = controversy_axis.generate_example_speeches_for_axis(axis_topic, pro_opinion, con_opinion)
		example_speeches['topic'] = axis_topic
		
		write_json(example_speeches, example_speeeches_path)
	


# ## Part 3: Projection of the politicians onto the axis and visualization
# 
# 1. Create a stance axis vector by generating two reference points 
# 2. Collapse all the other vectors onto this axis by projecting them onto the axis
# 3. Create a scalar measurement for how far each politician is from the two reference points
# 4. Use UMAP dim reduction to see the positions of the politicians as well as the generated/selected reference points

# In[23]:


import numpy as np
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from file_handling.file_read_writer import read_hdf5_file


class VectorOperator:
	def __init__(self):
		pass
	
	def project_vector(vector:np.ndarray, onto_vector:np.ndarray)->tuple[np.ndarray, np.ndarray]:
		normalized_onto_vector = onto_vector / np.linalg.norm(onto_vector)
		scaling = np.dot(vector, normalized_onto_vector)
		projection = scaling * normalized_onto_vector
		return projection, scaling
	
	def get_embeddings_and_reprs(self, topic:str)->tuple[np.ndarray, list[str], list[str]]:
		hdf5_file_path = os.path.join(DATA_REPR_SPEECHES_DIR, f"{topic}_summaries.hdf5")
		if not os.path.exists(hdf5_file_path):
			raise ValueError(f'{hdf5_file_path} not found')
		stored_results = read_hdf5_file(hdf5_file_path)
		reprs = stored_results['repr_names']
		parties = stored_results['repr_parties']
		embeddings = np.array(stored_results['embeddings'])
		return embeddings, reprs, parties
	
	def reduce_dimensions_umap(self, embeddings, n_components=2):
		umap_embeddings = umap.UMAP(n_components=n_components, verbose=True, n_neighbors=30).fit_transform(embeddings)
		return umap_embeddings

	def collapse_vectors_onto_two_ref_reprs(self, summary_hdf5_path, topic, ref_repr1, ref_repr2):
		embeddings, reprs = self.get_embeddings_and_reprs(summary_hdf5_path)
		if ref_repr1 not in reprs:
			raise ValueError(f'{ref_repr1} not in {reprs}')
		if ref_repr2 not in reprs:
			raise ValueError(f'{ref_repr2} not in {reprs}')
		ref1_embedding = self.embedding_handler.get_average_embedding_for_repr_for_topic(ref_repr1, topic)
		ref2_embedding = self.embedding_handler.get_average_embedding_for_repr_for_topic(ref_repr2, topic)
		ref2_to_ref1 = ref1_embedding - ref2_embedding
		projections = embeddings @ ref2_to_ref1
		projections = projections / np.linalg.norm(ref2_to_ref1)
		return projections, reprs
	
	def collapse_vectors_onto_strings(self, embeddings, string1, string2):
		string1_embedding = st.encode(string1, convert_to_tensor=True, show_progress_bar=True)
		string2_embedding = st.encode(string2, convert_to_tensor=True, show_progress_bar=True)
		string1_embedding = string1_embedding.cpu().numpy()
		string1_embedding = np.mean(string1_embedding, axis=0)
		string2_embedding = string2_embedding.cpu().numpy()
		string2_embedding = np.mean(string2_embedding, axis=0)
		string1_to_string2 = string1_embedding - string2_embedding
		projections = embeddings @ string1_to_string2
		projections = projections / np.linalg.norm(string1_to_string2)
		return projections

	def collapse_vectors_onto_two_genenerated_strings_from_topic(self, topic:str, subtopic:str, string1:str, string2:str)->tuple[np.ndarray, list[str], list[str]]:
		embeddings, reprs, parties = self.get_embeddings_and_reprs(topic)
		projections = self.collapse_vectors_onto_strings(embeddings, string1, string2)
		return projections, reprs, parties
	
class PoliticalStanceVisualizer:
	def __init__(self):
		pass

	def visualize_red_dimension(self, red_dims:np.array, reprs:list[str], topic:list[str], parties:list[str], colors:list[str], for_repr_idx=0, against_repr_idx=0, path='plot.png', title='', show_repr_names=False, show_legend = False):
		fig, ax = plt.subplots(figsize=(10,10))
		ax.scatter(red_dims[:,0], red_dims[:, 1], c=colors, alpha=0.3, label=parties)
		if show_legend:
			legend_items = [Line2D([0], [0], marker='o', color='w', label=PARTYJP_TO_PARTYEN[party], markerfacecolor=color, markersize=10, alpha=0.3) for party, color in PARTY_TO_COLOR.items()]
			ax.legend(handles=legend_items)
		if for_repr_idx != against_repr_idx:
			ax.scatter(red_dims[for_repr_idx, 0], red_dims[for_repr_idx, 1], edgecolors='blue', facecolors='none', s=200)
			ax.scatter(red_dims[against_repr_idx, 0], red_dims[against_repr_idx, 1], edgecolors='red', facecolors='none', s=200)
			ax.plot([red_dims[for_repr_idx, 0], red_dims[against_repr_idx, 0]], [red_dims[for_repr_idx, 1], red_dims[against_repr_idx, 1]], c='black')
		if show_repr_names:
			for idx, repr in enumerate(reprs):
				ax.annotate(repr, (red_dims[idx, 0], red_dims[idx, 1]), fontsize=7)
		ax.set_title(title)
		ax.set_xlabel('Red dimension 1')
		ax.set_ylabel('Red dimension 2')
		fig.tight_layout()
		plt.savefig(path)
		plt.clf()
		plt.cla()
		plt.close()

	def plot_grouped_bar_chart(self, ax, xs, party, xmax, xmin, title, xlabel='', ylabel="", color="blue"):
		ax.set_title(title)
		ax.set_xlabel(xlabel)
		ax.set_ylabel(ylabel)
		ax.set_xlim(int(xmin-1), int(xmax+1))
		ys = []
		xticks = []
		step_size = 0.25
		for xtick in np.arange(np.floor(xmin), np.ceil(xmax), step_size):
			xticks.append(xtick)
			ys.append(len([x for x in xs if (xtick-step_size/2<x<=xtick+step_size/2)]))
		ax.bar(xticks, ys, color=color, alpha=0.3, width=step_size)
		
	def save_2d_plot(self, red_dims, reprs, colors, parties, filename, out_dir, for_repr_name, against_repr_name, for_repr_idx, against_repr_idx):
		#save 2d hdf5 file in dir
		#save json file in dir
		hdf_5_path = os.path.join(out_dir, filename+'.hdf5')
		with h5py.File(hdf_5_path, 'w') as f:
			f.create_dataset('red_dims', data=red_dims)
			f.create_dataset('reprs', data=reprs, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('parties', data=parties, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('colors', data=colors, dtype=h5py.string_dtype(encoding='utf-8'))

		# sort parties by the order of PARTIES
		parties, colors, reprs, red_dims = zip(*sorted(zip(parties, colors, reprs, red_dims)))
		out_dict = {"data":[]}
		
		for idx, (red_dim, repr, party, color) in enumerate(zip(red_dims, reprs, parties, colors)):
			if repr == for_repr_name or repr == against_repr_name:
				color = 'blue' if repr == for_repr_name else 'red'
				if repr == for_repr_name:
					hiragana = '賛成'
				else:
					hiragana = '反対'
				append_dict = {
					'idx': idx,
					'x': str(red_dim[0]),
					'y': str(red_dim[1]),
					'repr': hiragana,
					'hiragana':hiragana,
					'house': "",
					'party': "",
					'color': color,
					'ref_point': 'for' if repr == for_repr_name else 'against'
				}
			else:
				repr_data = repr_to_repr_data[repr]
				if "yomikata" in repr_data:
					hiragana = repr_data['yomikata']
				else:
					hiragana = repr_data['hiragana']
				append_dict = {
					'idx': idx,
					'x': str(red_dim[0]),
					'y': str(red_dim[1]),
					'repr': repr,
					'hiragana':hiragana.replace(' ',''),
					'house': repr_data['house'],
					'party': party,
					'color': color,
					'ref_point': 'for' if repr == for_repr_name else 'against' if repr == against_repr_name else 'none'
				}
			

			out_dict['data'].append(
				append_dict
			)
		json_path = os.path.join(out_dir, filename+'.json')
		write_json(path=json_path, dict_obj=out_dict)

	def save_1d_plot(self, xs, reprs, colors, parties, filename, out_dir):
		#save 1d hdf5 file in dir
		#save json file in dir
		hdf_5_path = os.path.join(out_dir, filename+'.hdf5')
		with h5py.File(hdf_5_path, 'w') as f:
			f.create_dataset('projections', data=xs)
			f.create_dataset('reprs', data=reprs, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('parties', data=parties, dtype=h5py.string_dtype(encoding='utf-8'))
			f.create_dataset('colors', data=colors, dtype=h5py.string_dtype(encoding='utf-8'))
		out_dict = {"data":[]}
		parties, colors, reprs, xs = zip(*sorted(zip(parties, colors, reprs, xs)))
		for idx, (x, repr, party, color) in enumerate(zip(xs, reprs, parties, colors)):
			repr_data = repr_to_repr_data[repr]
			out_dict['data'].append({
				'idx': idx,
				'y' : str(idx),
				'x': str(x),
				'repr': repr,
				'hiragana':repr_data['yomikata'].replace(' ',''),
				'house': repr_data['house'],
				'party': party,
				'color': color
			})
		json_path = os.path.join(out_dir, filename+'.json')
		write_json(path=json_path, dict_obj=out_dict)

	def save_1d_plot_diachronic_parties(self, xs, years, parties, filename, out_dir):

		out_dict = {"data":[]}
		for x, year, party in zip(xs, years, parties):
			out_dict['data'].append({
				'x': [str(pos) for pos in x],
				'year': year,
				'party': party
			})
		json_path = os.path.join(out_dir, filename+'.json')
		write_json(path=json_path, dict_obj=out_dict)

	def save_2d_plot_diachronic_parties(self, xs, ys, parties, filename, out_dir):

		out_dict = {"data":[]}
		for x, y, party in zip(xs, ys, parties):
			out_dict['data'].append({
				'x': str(x),
				'y': str(y),
				'party': party
			})
		json_path = os.path.join(out_dir, filename+'.json')
		write_json(path=json_path, dict_obj=out_dict)
			

		
	
	def visualize(self, xs, labels, colors, parties, title, xlabel, path='plot.png'):
		unique_parties = set(parties)
		total_boxes = len(unique_parties) + 1

		print('parties', unique_parties)
		max_x = max(xs)
		min_x = min(xs)
		fig, axs = plt.subplots(int(np.ceil(total_boxes/2)),2, figsize=(10,20))
		axs[0,0].scatter(xs, range(len(xs)), c =colors, alpha=0.3)
		axs[0,0].set_title(title)
		axs[0,0].set_xlabel(xlabel)
		axs[0,0].set_ylabel('Representatives')
		axs[0,0].set_xlim(int(min_x-1), int(max_x+1))
		y_ticks = axs[0,0].get_yticks()
		y_ticks_text = ['' for _ in y_ticks]
		axs[0,0].set_yticklabels(y_ticks_text)
		#Flatten axis
		axs = axs.reshape(-1)
		for idx, party in enumerate(unique_parties):
			self.plot_grouped_bar_chart(axs[idx+1],
							   xs=[x for x, p in zip(xs, parties) if p == party],
							   party=party,
							   xmax=max_x,
							   xmin=min_x,
							   title=party,
							   xlabel='',
							   ylabel='',
							   color=PARTY_TO_COLOR[PARTY2GLOBALNAME[party]])

		fig.tight_layout()
		plt.savefig(path)
		plt.clf()
		plt.cla()
		plt.close()
	
	def draw_box_plot(self, data, labels=['this', 'that'], title="", xlabel="", ylabel="", path='plot.png', reorder_based_on_mean=False):
		if reorder_based_on_mean:
			medians = [np.mean(d) for d in data]
			indices = np.argsort(medians)[::-1]
			data = [data[i] for i in indices]
			labels = [labels[i] for i in indices]
		

		fig, ax = plt.subplots(figsize=(10,10))
		bplot = ax.boxplot(data, labels=[PARTYJP_TO_PARTYEN[label] for label in labels], vert=False, patch_artist=True)
		for patch, label in zip(bplot['boxes'], labels):
			patch.set_facecolor(PARTY_TO_COLOR[label])
			fc = patch.get_facecolor()
			patch.set_facecolor((fc[0], fc[1], fc[2], 0.3))
		ax.set_title(title)
		ax.set_xlabel(xlabel)
		ax.set_ylabel(ylabel)
		fig.tight_layout()
		plt.savefig(path)
		plt.clf()
		plt.cla()
		plt.close()

	def draw_violin_plot(self, data, labels=['this', 'that'], title="", xlabel="", ylabel="", path='plot.png', reorder_based_on_mean=False):
		if reorder_based_on_mean:
			medians = [np.mean(d) for d in data]
			indices = np.argsort(medians)[::-1]
			data = [data[i] for i in indices]
			labels = [labels[i] for i in indices]

		def set_axis_style(ax, labels):
			ax.set_yticks(np.arange(1, len(labels) + 1), labels=[PARTYJP_TO_PARTYEN[label] for label in labels])
			ax.set_ylim(0.25, len(labels) + 0.75)
		fig, ax = plt.subplots(figsize=(10,10))
		vplot = ax.violinplot(data, vert=False, showmeans=True)
		for patch, label in zip(vplot['bodies'], labels):
			patch.set_facecolor(PARTY_TO_COLOR[label])
			# patch.set_facecolor((fc[0], fc[1], fc[2], 0.3))
		set_axis_style(ax, labels)
		ax.set_title(title)
		ax.set_xlabel(xlabel)
		ax.set_ylabel(ylabel)
		fig.tight_layout()
		plt.savefig(path)
		plt.clf()
		plt.cla()
		plt.close()
		


# In[24]:


vo = VectorOperator()
psv = PoliticalStanceVisualizer()
axis_dir = os.path.join(ROOT_DIR, 'axis')
for topic_config in EXPERIMENT_CONFIG:
	print(topic_config['topic_name'])
	topic = topic_config['topic_name']
	topic_dir = os.path.join(TODAYS_RESULTS, topic_config['topic_name'])
	topic_plot_dir = os.path.join(topic_dir, 'plots')
	create_dir(topic_plot_dir)
	
	extracted_controversies = read_json(os.path.join(axis_dir, topic, f'{topic}_axis.json'))
	for controversy in extracted_controversies:
		print(topic_config['topic_name'], '---', controversy['topic'])
		axis_topic = controversy['topic']
		pro = controversy['pro']
		con = controversy['con']
		example_speeeches = read_json(os.path.join(axis_dir, topic, 'examples', f'{axis_topic}_example_speeches.json'))
		con_speeches = example_speeeches['con']['opinions']
		pro_speeches = example_speeeches['pro']['opinions']

		projections, reprs, parties = vo.collapse_vectors_onto_two_genenerated_strings_from_topic(topic=topic,
																			subtopic=axis_topic,
																			string1=pro_speeches,
																			string2=con_speeches)
		
	
		psv.save_1d_plot(xs=projections,
					reprs=reprs,
					colors=[PARTY_TO_COLOR[PARTY2GLOBALNAME[party]] for party in parties],
					parties=parties,
					filename=axis_topic+'_gen_1d',
					out_dir=topic_plot_dir)

		psv.visualize(xs=projections,
					labels=reprs,
					colors=[PARTY_TO_COLOR[PARTY2GLOBALNAME[party]] for party in parties],
					parties=parties,
					title=topic,
					xlabel=f'against -> for',
					path=os.path.join(topic_plot_dir ,f'{axis_topic}_gen.png')
					)
	
		box_plot_data = [[projection for idx, projection in enumerate(projections) if parties[idx] == party] for party in PARTIES if party not in IGNORE_PARTIES]
		box_plot_parties = [party for idx, party in enumerate(PARTIES) if len(box_plot_data[idx]) > 0]
		box_plot_data = [data for data in box_plot_data if len(data) > 0]

		# get rid fo dup names of parties and merge them
		merged_box_plot_data_dict = {}
		for box_data, party in zip(box_plot_data, box_plot_parties):
			if PARTY2GLOBALNAME[party] in merged_box_plot_data_dict:
				merged_box_plot_data_dict[PARTY2GLOBALNAME[party]] += box_data
			else:
				merged_box_plot_data_dict[PARTY2GLOBALNAME[party]] = box_data

		merged_box_plot_data = list(merged_box_plot_data_dict.values())
		merged_box_plot_parties = list(merged_box_plot_data_dict.keys())

		psv.draw_box_plot(
			data=merged_box_plot_data, 
			labels=merged_box_plot_parties, 
			title=f"{axis_topic} Generated Reference", 
			xlabel='\n'.join([con[:min([len(con), 60])], '->', pro[:min([len(pro), 60])]]), 
			ylabel='Parties', 
			path=os.path.join(topic_plot_dir ,f'{axis_topic}_gen_box_plot.png'),
			reorder_based_on_mean=True)
		
		
		psv.draw_violin_plot(
			data=merged_box_plot_data, 
			labels=merged_box_plot_parties, 
			title=f"{axis_topic} Generated Reference", 
			xlabel='\n'.join([con[:min([len(con), 60])], '->', pro[:min([len(pro), 60])]]),
			ylabel='Parties', 
			path=os.path.join(topic_plot_dir ,f'{axis_topic}_gen_violin_plot.png'),
			reorder_based_on_mean=True)
		
		# UMAP visualization

		gen_for_embedding = st.encode(pro_speeches, convert_to_tensor=True, show_progress_bar=True)
		gen_against_embedding = st.encode(con_speeches, convert_to_tensor=True, show_progress_bar=True)
		gen_for_embedding = gen_for_embedding.cpu().numpy()
		gen_for_embedding = np.mean(gen_for_embedding, axis=0)
		gen_against_embedding = gen_against_embedding.cpu().numpy()
		gen_against_embedding = np.mean(gen_against_embedding, axis=0)
		# expanding the distance for visibility
		for2against = gen_against_embedding - gen_for_embedding
		gen_for_embedding = gen_for_embedding - 2 * for2against
		gen_against_embedding = gen_against_embedding + 2 * for2against
		embeddings, reprs, parties_jp = vo.get_embeddings_and_reprs(topic)
		parties_en = [PARTYJP_TO_PARTYEN[PARTY2GLOBALNAME[party]] for party in parties_jp]
		colors = [PARTY_TO_COLOR[PARTY2GLOBALNAME[party]] for party in parties_jp]
		extended_embeddings = np.concatenate((embeddings, [gen_for_embedding, gen_against_embedding]), axis=0)
		extended_reprs = reprs + ['gen_for', 'gen_against']
		extended_parties = parties_en + ['', '']
		all_red_embeddings = vo.reduce_dimensions_umap(extended_embeddings, n_components=2)
		extended_colors = colors + ['brown', 'brown']
		gen_for_idx = extended_reprs.index('gen_for')
		gen_against_idx = extended_reprs.index('gen_against')

		psv.save_2d_plot(red_dims=all_red_embeddings,
					reprs=extended_reprs,
					colors=extended_colors,
					parties=extended_parties,
					filename=axis_topic+'_gen_2d',
					out_dir=topic_plot_dir,
					for_repr_name='gen_for',
					against_repr_name='gen_against',
					for_repr_idx=gen_for_idx,
					against_repr_idx=gen_against_idx)
		
		psv.visualize_red_dimension(
					all_red_embeddings, 
					extended_reprs, 
					topic, 
					extended_parties, 
					extended_colors, 
					for_repr_idx=gen_for_idx, 
					against_repr_idx=gen_against_idx, 
					path=os.path.join(topic_plot_dir,f'{axis_topic}_umap_gen.png'), 
					title=f'Political stance for {axis_topic} with Generated sentences', 
					show_repr_names=False)
		
		psv.visualize_red_dimension(
					all_red_embeddings, 
					extended_reprs, 
					topic, 
					extended_parties, 
					extended_colors, 
					for_repr_idx=gen_for_idx, 
					against_repr_idx=gen_against_idx, 
					path=os.path.join(topic_plot_dir,f'{axis_topic}_umap_gen_with_name.png'), 
					title=f'Political stance for {axis_topic} with Generated sentences', 
					show_repr_names=True)
	


# ## **Part 4: Creating groups of politicians based on where their embeddings lie on an axis**
# 1. Creating groups of politicians based on where they are positioned
# 2. Measure PMI of noun phrases in the summaries of the politicians in each group to see what stances are associated with each group

# In[ ]:


from file_handling.file_read_writer import get_newest_dir
TOPICS_TO_ANALYZE = ['原発', '少子化', '気候変動', '経済対策', '防衛']
NEWEST_OUTPUT_DIR = os.path.join(RESULTS_DIR, get_newest_dir(RESULTS_DIR))


# In[ ]:


import spacy
from collections import Counter
import math
import pandas as pd

def pmiForAllCal(df, topk_word, cluster_number, label_column='cluster'):

    index = [x[0] for x in topk_word]
    pmiDf = pd.DataFrame(index=index, columns=['pmi'])

    for (word, count) in tqdm(topk_word):
        pmiDf.at[word, 'pmi'] = pmiCalc(df,word,cluster_number,label_column)
    pmiDf = pmiDf.sort_values(by='pmi',ascending=False)

    return pmiDf


def pmiCalc(df, word, cluster_number, label_column='cluster'):

    N = df.shape[0]

    px = sum(df[label_column]==cluster_number)
    py = sum(df[word]==True)
    pxy = len(df[(df[label_column]==cluster_number) & (df[word]==True)])

    denominator = (px*py) #Denominator cannot be 0 so we add a small value to it
    if denominator == 0:
        denominator += 0.0001
    if pxy==0:#Log 0 cannot happen
        pmi = math.log((pxy+0.0001)*N/denominator)
    else:
        pmi = math.log(pxy*N/denominator)
    return pmi


def transform_speech_df_to_nps_df(speech_df, top_nps):
	nps_df = pd.DataFrame()
	for np in top_nps:
		nps_df[np] = speech_df['summary'].apply(lambda x: np in x)
	return speech_df.join(nps_df)

def split_into_groups(data:list[dict], group_num:int, equal_size_groups=False)->list[list[str]]:
	names = []
	positions = []
	for d in data:
		names.append(d['repr'])
		positions.append(float(d['x']))
	arg_sorted = np.argsort(positions)
	sorted_names = [names[i] for i in arg_sorted]
	sorted_positions = [positions[i] for i in arg_sorted]
	groups = []
	if equal_size_groups:
		group_size = len(sorted_names) // group_num
		for i in range(group_num):
			if i == group_num - 1:
				groups.append(sorted_names[i*group_size:])
			else:
				groups.append(sorted_names[i*group_size:(i+1)*group_size])
	else:
		data_range = max(sorted_positions) - min(sorted_positions)
		group_range = data_range / group_num
		groups = [[] for _ in range(group_num)]
		for name, position in zip(sorted_names, sorted_positions):
			group_idx = int((position - min(sorted_positions)) // group_range)
			group_idx = min(group_idx, group_num-1)
			groups[group_idx].append(name)
	return groups

def get_axis_data_paths_for_topic(topic:str):
	topic_plot_dir = os.path.join(NEWEST_OUTPUT_DIR, topic, 'plots')
	axis_paths = [f for f in os.listdir(topic_plot_dir) if f.endswith('.json')]
	return [os.path.join(topic_plot_dir, path) for path in axis_paths]

def create_df_for_topic(topic:str):
	hdf5_path = os.path.join(DATA_REPR_SPEECHES_DIR, f"{topic}_summaries.hdf5")
	if not os.path.exists(hdf5_path):
		raise ValueError(f'{hdf5_path} not found')
	stored_results = read_hdf5_file(hdf5_path)
	reprs = stored_results['repr_names']
	parties = stored_results['repr_parties']
	summaries = stored_results['summaries']
	rows = []
	for repr, party, summary in zip(reprs, parties, summaries):
		decoded_summaries = [s.decode('utf-8') for s in summary]
		rows.append({'repr': repr, 'party': party, 'summary': '\n'.join(decoded_summaries)})
	df = pd.DataFrame(rows)
	return df

class PoliticalGroupAnalyzer:
	def __init__(self):
		# reference
		# https://qiita.com/wf-yamaday/items/3ffdcc15a5878b279d61

		nlp: spacy.Language = spacy.load('ja_ginza')
		self.nlp = nlp
	
	def get_counted_nps(self, data:list[str]) -> dict:
		nps = []
		print('Extracting NPs')
		for d in tqdm(data):
			doc = self.nlp(d)
			for chunk in doc.noun_chunks:
				nps.append(chunk.text)
		return Counter(nps)


# In[ ]:


for topic in TOPICS_TO_ANALYZE:
	pga = PoliticalGroupAnalyzer()
	df = create_df_for_topic(topic)
	top_nps = pga.get_counted_nps(df['summary'].tolist()).most_common(2000)
	nps = [np for np, count in top_nps]
	df = transform_speech_df_to_nps_df(df, nps)
	paths = get_axis_data_paths_for_topic(topic)
	topic_plot_dir = os.path.join(NEWEST_OUTPUT_DIR, topic, 'plots')
	for path in paths:
		topic_name = path.split('/')[-1].split('_')[0]
		data = read_json(path)['data']
		# splitting the data into 3 groups NOTE: You can set the groups to equal sizes if more appropriate
		groups = split_into_groups(data, 3)
		name2group = {}
		group_df = df.copy()
		for idx, group in enumerate(groups):
			for name in group:
				name2group[name] = idx
		if len(data) != len(df):
			raise ValueError('Data length mismatch')
		if len(data) != len(groups[0]) + len(groups[1]) + len(groups[2]):
			raise ValueError('Data length mismatch')
		
		group_df['group'] = group_df['repr'].apply(lambda x: name2group[x])
		for group_num in range(3):
			pmi_df = pmiForAllCal(group_df, top_nps, group_num, label_column='group')
			pmi_df.to_csv(os.path.join(topic_plot_dir, f'{topic_name}_group_{group_num}_pmi.csv'))



# In[ ]:


from scipy.stats import spearmanr, kendalltau
from difflib import SequenceMatcher

measurements = {
    'nuclear':{
        'mielka':["Reiwa", "JCP", "CDP", "Komeito", "NDP", "LDP", "JRP"],
        'ours':["Reiwa","JCP", "CDP", "JRP", "NDP", "LDP", "Komeito"],
        'old':['JCP', 'CDP', 'JRP', 'LDP', 'NDP', 'Komeito']
    },
    'constitution':{
        'mielka':['JCP', 'Reiwa', 'CDP', 'Komeito', 'NDP', 'JRP', 'LDP','Sansei'],
        'ours':['JCP', 'Reiwa', 'CDP','JRP', 'NDP', 'LDP','Komeito', 'Sansei'],
        'old':['JCP', 'CDP', 'NDP', 'JRP', 'LDP', 'Komeito']
    },
    'consumptiontax':{
        'mielka':['CDP', 'JRP', 'NDP', 'JCP','Reiwa'],
        'ours':['Reiwa','CDP', 'JRP', "NDP", 'JCP'],
        'old':[]
    }
}

def longest_common_subsequence_ratio(list1, list2):
    """Compute the ratio of the longest common subsequence (LCS)."""
    matcher = SequenceMatcher(None, list1, list2)
    lcs_length = sum(block.size for block in matcher.get_matching_blocks())
    max_length = max(len(list1), len(list2))
    return lcs_length / max_length if max_length > 0 else 0.0

for topic in measurements.keys():
    mielka_order = measurements[topic]['mielka']
    our_order = measurements[topic]['ours']
    old = measurements[topic]['old']
    rho = spearmanr(mielka_order, our_order).statistic
    tau, _ = kendalltau(mielka_order, our_order)
    subseq = longest_common_subsequence_ratio(mielka_order, our_order)

    print('Comparison to current order')
    print(f'{topic} rho: {rho}, kendall: {tau}, subseq: {subseq}')
    
    print('Comparison to old order')
    mielka_order = [party for party in mielka_order if party in old]
    rho = spearmanr(mielka_order, old).statistic
    tau, _ = kendalltau(mielka_order, old)
    subseq = longest_common_subsequence_ratio(mielka_order, old)
    print(f'{topic} rho: {rho}, kendall: {tau}, subseq: {subseq}')



# # **Part 5: Create a diachronic analysis of how politicians have evolved on long-standing issues such as JSDF and constitution and nuclear power**
# 1. Analyze the stance of politicians on yearly basis

# In[3]:


from collections import defaultdict
PARTIES_FOR_DIACHRONIC_ANALYSIS = ['共産','自民', '公明']
DIACHRONIC_TOPICS = ['原発', '防衛']

class DiachronicStanceAnalyzer:
	def __init__(self):
		self.current_topic = None
		self.stats_dict =  defaultdict(dict)# year -> party -> topic -> number_of_speech_segments

	def set_current_topic(self, topic:str):
		self.current_topic = topic

	def retrieve_speech_segments_for_year(self, topic_file_path:str, year:int):
		opinions_file_data = read_json(topic_file_path)
		if not opinions_file_data:
			return []
		opinions_file_data = opinions_file_data['speeches']
		speeches = []
		for speech in opinions_file_data:
			if int(speech['date'].split('-')[0]) == year:
				opinions = speech['extracted_opinions']
				speeches.extend(opinions)
		return speeches
	
	def save_stats(self, year:int, party:str, num_speeches:int, num_reprs:int):
		if year not in self.stats_dict:
			self.stats_dict[year] = {}
		if party not in self.stats_dict[year]:
			self.stats_dict[year][party] = {}
		if self.current_topic not in self.stats_dict[year][party]:
			self.stats_dict[year][party][self.current_topic] = {}
		
		self.stats_dict[year][party][self.current_topic]['num_speech_segments'] = num_speeches
		self.stats_dict[year][party][self.current_topic]['num_reprs'] = num_reprs
		
	def get_all_speeches_for_topic_for_year_from_party(self, party:str, year:int)->list[str]:
		if not self.current_topic:
			raise ValueError('Current topic not set')
		party_dir = os.path.join(DATA_REPR_SPEECHES_DIR, party)
		repr_list = os.listdir(party_dir)
		all_speeches = []
		num_reprs = 0
		for repr in tqdm(repr_list):
			topic_file_path = os.path.join(party_dir, repr, self.current_topic, 'opinions.json')
			if not os.path.exists(topic_file_path):
				continue
			speeches = self.retrieve_speech_segments_for_year(topic_file_path, year)
			if speeches:
				num_reprs += 1
			all_speeches.extend(speeches)
		self.save_stats(year, party, len(all_speeches), num_reprs)
		return all_speeches
	
	def make_embeddings_and_save(self):
		for topic in DIACHRONIC_TOPICS:
			for party in PARTIES_FOR_DIACHRONIC_ANALYSIS:
				year_embeddings = []
				years = []
				self.set_current_topic(topic)
				for year in range(2000, 2024):
					print('Processing ', party, topic, year)
					speeches = self.get_all_speeches_for_topic_for_year_from_party(party, year)
					embeddings = st.encode(speeches, convert_to_tensor=True, show_progress_bar=True)
					embeddings = embeddings.cpu().numpy()
					average_embedding = np.mean(embeddings, axis=0)
					year_embeddings.append(average_embedding)
					years.append(year)
					print(f'Done with {len(embeddings)} embeddings ', party, topic, year)
				year_embeddings = np.array(year_embeddings)
				year_embeddings_hdf = os.path.join(DATA_REPR_SPEECHES_DIR, f'{party}_{topic}_year_embeddings.hdf5')
				with h5py.File(year_embeddings_hdf, 'w') as f:
					f.create_dataset('years', data=years)
					f.create_dataset('embeddings', data=year_embeddings)
		stats_path = os.path.join(DATA_REPR_SPEECHES_DIR, 'diachronic_stats.json')
		write_json(self.stats_dict, stats_path)
					
		


# In[ ]:


# making embeddings for the years
dsa = DiachronicStanceAnalyzer()
dsa.make_embeddings_and_save()


# In[ ]:


vo = VectorOperator()
psv = PoliticalStanceVisualizer()

def create_diachronic_data(labels, projections):
	res = {}
	for label, projection in zip(labels, projections):
		party = label.split('-')[0]
		year = label.split('-')[1]
		if party not in res:
			res[party] = {'projections':[], 'years':[]}
		res[party]['projections'].append(projection)
		res[party]['years'].append(year)
	return res
axis_dir = os.path.join(ROOT_DIR, 'axis')
for topic in DIACHRONIC_TOPICS:
	labels = []
	all_embeddings = []
	colors = []

	for party in PARTIES_FOR_DIACHRONIC_ANALYSIS:
		year_embeddings_hdf = os.path.join(DATA_REPR_SPEECHES_DIR, f'{party}_{topic}_year_embeddings.hdf5')
		year_embeddings = read_hdf5_file(year_embeddings_hdf)
		years = year_embeddings['years']
		embeddings = year_embeddings['embeddings']
		labels.extend([f'{party}-{year}' for year in years])
		colors.extend([PARTY_TO_COLOR[PARTY2GLOBALNAME[party]] for _ in years])
		all_embeddings.extend(embeddings)

	extracted_controversies = read_json(os.path.join(axis_dir, topic, f'{topic}_axis.json'))
	for controversy in extracted_controversies:
		axis_topic = controversy['topic']
		pro = controversy['pro']
		con = controversy['con']
		example_speeeches = read_json(os.path.join(axis_dir, topic, 'examples', f'{axis_topic}_example_speeches.json'))
		con_speeches = example_speeeches['con']['opinions']
		pro_speeches = example_speeeches['pro']['opinions']

		projections = vo.collapse_vectors_onto_strings(all_embeddings,string1=pro_speeches, string2=con_speeches)
		# diachronic change
		fig, ax = plt.subplots(figsize=(10,10))
		diachronic_data = create_diachronic_data(labels, projections)
		xs = []
		years = []
		parties = []
		for party, data in diachronic_data.items():
			ax.plot(data['years'], data['projections'], label=party, color=PARTY_TO_COLOR[PARTY2GLOBALNAME[party]])
			xs.append(data['projections'])
			years.append(data['years'])
			parties.append(party)


		psv.save_1d_plot_diachronic_parties(
			xs=xs,
			years=years,
			parties=parties,
			filename=f'{axis_topic}_diachronic.json',
			out_dir=os.path.join(TODAYS_RESULTS, topic,)
		)

		
			
		ax.set_title(f'{axis_topic} Diachronic Change')
		ax.set_xlabel('Year')
		ax.set_ylabel('Projection')
		plt.xticks(rotation=45)
		ax.legend()
		fig.tight_layout()
		fig.savefig(os.path.join(TODAYS_PLOTS, f'{axis_topic}_{topic}_diachronic_change.png'))
		plt.clf()
		plt.cla()
		plt.close()

		all_embeddings = np.array(all_embeddings)
		gen_for_embedding = st.encode(pro_speeches, convert_to_tensor=True, show_progress_bar=True)
		gen_for_embedding = gen_for_embedding.cpu().numpy()
		gen_for_embedding = np.mean(gen_for_embedding, axis=0)
		gen_against_embedding = st.encode(con_speeches, convert_to_tensor=True, show_progress_bar=True)
		gen_against_embedding = gen_against_embedding.cpu().numpy()
		gen_against_embedding = np.mean(gen_against_embedding, axis=0)
		# expanding the distance for visibility
		for2against = gen_against_embedding - gen_for_embedding
		gen_for_embedding = gen_for_embedding - 2 * for2against
		gen_against_embedding = gen_against_embedding + 2 * for2against

		projections = vo.collapse_vectors_onto_strings(all_embeddings, string1=pro_speeches, string2=con_speeches)
		
		
		extended_embeddings = np.concatenate((all_embeddings, [gen_for_embedding, gen_against_embedding]), axis=0)
		extended_labels = labels + ['gen_for', 'gen_against']
		extended_colors = colors + ['brown', 'brown']
		gen_for_idx = extended_labels.index('gen_for')
		gen_against_idx = extended_labels.index('gen_against')
	
		red_dims = vo.reduce_dimensions_umap(extended_embeddings, n_components=2)
		psv.visualize_red_dimension(
			red_dims, 
			extended_labels,
			topic, 
			extended_labels, 
			extended_colors, 
			for_repr_idx=gen_for_idx,
			against_repr_idx=gen_against_idx,
			path=os.path.join(TODAYS_PLOTS,f'{axis_topic}_diachronic_umap.png'),
			title=f'Political stance for {axis_topic} with Diachronic Analysis',
			show_repr_names=True,
			show_legend=False,
		)
		psv.save_2d_plot_diachronic_parties(
			xs=red_dims[:,0],
			ys=red_dims[:,1],
			parties=extended_labels,
			filename=f'{axis_topic}_diachronic_2d.json',
			out_dir=os.path.join(TODAYS_RESULTS, topic,)
		)

		


# # Analyzing the speeches for given years for parties

# In[ ]:


speech_output_dir = os.path.join(TODAYS_RESULTS, 'speeches')
create_dir(speech_output_dir)
dsa = DiachronicStanceAnalyzer()

for topic in DIACHRONIC_TOPICS:
	for year in range(2000, 2024):
		for party in PARTIES_FOR_DIACHRONIC_ANALYSIS:
			party_dir = os.path.join(DATA_REPR_SPEECHES_DIR, party)
			os.makedirs(speech_output_dir, exist_ok=True)
			dsa.set_current_topic(topic)
			speeches = dsa.get_all_speeches_for_topic_for_year_from_party(party, year)
			output_file_path = os.path.join(speech_output_dir, f'{party}_{topic}_{year}.txt')
			with open(output_file_path, 'w') as f:
				f.write('\n'.join(speeches))
			print('Done with ', party, topic, year)
			


# In[ ]:





# In[ ]:




