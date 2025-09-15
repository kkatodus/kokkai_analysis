#!/usr/bin/env python
# coding: utf-8

# In[5]:


# !jupyter nbconvert --to script collect_politician_opinions.ipynb


# In[ ]:


import os
import re
import logging
import torch
from transformers import AutoTokenizer, BertForSequenceClassification
from params.paths import ROOT_DIR
from api_requests.meeting_convo_collector import MeetingConvoCollector
from datetime import datetime, timedelta
import time
from tqdm import tqdm
import pandas as pd

from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data', 'data_repr_speeches')
create_dir(OUTPUT_DIR)
print(os.path.abspath(OUTPUT_DIR))
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin')
TODAY_STR = datetime.today().strftime('%Y-%m-%d')
MAX_MONTH_OLD = 2
print("MAX MONTH OLD:", MAX_MONTH_OLD)
MONTH_AGO_STR = (datetime.today() - timedelta(days=30*MAX_MONTH_OLD)).strftime('%Y-%m-%d')
print("Earliest date considered:", MONTH_AGO_STR)

def get_newest_file(dir):
	most_recent_file = None
	most_recent_time = 0
	for entry in os.scandir(dir):
		if entry.is_file:
			mod_time = entry.stat().st_mtime
			if mod_time > most_recent_time:
				most_recent_time = mod_time
				most_recent_file = entry.name
	return most_recent_file

#reading the reprentative data for lower and upper house
lower_repr_dir = os.path.join(LOWER_HOUSE_DATA_DIR, 'repr_list')
lower_repr_file = '20241218_repr_list.json'
lower_house_meeting_dict = os.path.join(lower_repr_dir, lower_repr_file)
lower_house_repr_dict = read_json(lower_house_meeting_dict)['reprs']




upper_repr_dir = os.path.join(UPPER_HOUSE_DATA_DIR, 'repr_list')
upper_repr_file = "20241218_repr_list.json"
upper_house_meeting_dict_path = os.path.join(upper_repr_dir, upper_repr_file)
upper_house_repr_dict = read_json(upper_house_meeting_dict_path)['reprs']

# execute if want to collect historical data
lower_house_historical_data_path = os.path.join(LOWER_HOUSE_DATA_DIR,'repr_list', 'historical.json')
upper_house_historical_data = os.path.join(UPPER_HOUSE_DATA_DIR,'repr_list', 'historical.csv')

print("Lower Repr File", lower_repr_file)
print("Upper Repr File", upper_repr_file)


# ## This will nuke the repr speech directory and deletes all representative speeches that are not currently serving

# In[4]:


import shutil
# def clean_repr_name(repr_name):
# 	repr_name = re.sub('\s|君|\[(.*?)\]', '', repr_name)
# 	return repr_name
# all_current_parties = set()
# all_current_parties.update(lower_house_repr_dict.keys())
# all_current_parties.update(upper_house_repr_dict.keys())
# print(all_current_parties)

# party2names = {party:[] for party in all_current_parties}


# for party, reprs in lower_house_repr_dict.items():
# 	for repr in reprs:
# 		party2names[party].append(clean_repr_name(repr['name']))

# for party, reprs in upper_house_repr_dict.items():
# 	for repr in reprs:
# 		party2names[party].append(clean_repr_name(repr['name']))


# print(party2names)

# print(all_current_parties)

# for party in os.listdir(OUTPUT_DIR):
# 	if not os.path.isdir(os.path.join(OUTPUT_DIR, party)):
# 		continue
# 	if party not in all_current_parties:
# 		# delete the party directory
# 		print(f"Removing {party}")
# 		shutil.rmtree(os.path.join(OUTPUT_DIR, party))
# 		continue
# 	for repr in os.listdir(os.path.join(OUTPUT_DIR, party)):
# 		print(repr)
# 		if repr not in party2names[party]:
# 			print(f"Removing {repr} from {party}")
# 			shutil.rmtree(os.path.join(OUTPUT_DIR, party, repr))

NUKE_TOPICS = ["LGBTQ"]

for party in os.listdir(OUTPUT_DIR):
	if not os.path.isdir(os.path.join(OUTPUT_DIR, party)):
		continue
	for repr in os.listdir(os.path.join(OUTPUT_DIR, party)):
		if not os.path.isdir(os.path.join(OUTPUT_DIR, party, repr)):
			continue
		for topic in os.listdir(os.path.join(OUTPUT_DIR, party, repr)):
			if topic in NUKE_TOPICS:
				print(f"Removing {topic} from {repr} in {party}")
				shutil.rmtree(os.path.join(OUTPUT_DIR, party, repr, topic))


# In[7]:


def clean_repr_name(repr_name):
	repr_name = re.sub('\s|君|\[(.*?)\]', '', repr_name)
	return repr_name

def remove_duplicate_speeches(speeches):
	ids = []
	unique_speeches = []
	for speech in speeches:
		if speech['speech_id'] not in ids:
			ids.append(speech['speech_id'])
			unique_speeches.append(speech)
	return unique_speeches

party_name_converter_dict = {
	'自由民主党': '自民',
	'立憲民主':'立憲',
	'無':'無',
	'国民民主党':'国民',
	'共産党':'共産',
	'民主党':'民主',
	'公明':'公明',
	'れいわ':'れ新',
	'日本保守':'保守',
	'社民':'社民',
	'維新':'維新',
	'改革クラブ':'改革',
	'おおさか維新の会':'お維',
	'新党大地':'新大',
	'各派に属':'無',
	'各会派に':'無',
	'沖縄':'沖縄',
}

def select_party_name(party_name):
	for key in party_name_converter_dict.keys():
		if key in party_name:
			return party_name_converter_dict[key]
	return party_name


class ReprTopicOpinionCollector:
	def __init__(self, house=None):
		self.mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")
		self.topic_dict = read_json(os.path.join(ROOT_DIR, 'resource','experiment_config.json'))
		if house == 'lower':
			self.repr_dict = read_json(lower_house_meeting_dict)['reprs']
		elif house == 'upper':
			self.repr_dict = read_json(upper_house_meeting_dict_path)['reprs']
		else:
			self.repr_dict = {}

		self.model_name = "kkatodus/jp-speech-classifier"
		self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
		self.model = BertForSequenceClassification.from_pretrained(self.model_name)


		log_dir = os.path.join(ROOT_DIR, 'logs')
		create_dir(log_dir)
		logging.basicConfig(filename=os.path.join(log_dir, 'politician_opinion_collection.log'), filemode='w', format='%(asctime)s - %(message)s')
		self.logger = logging.getLogger()
		outputlogs = False
		if outputlogs:
			self.logger.setLevel(logging.DEBUG)
		else:
			self.logger.setLevel(logging.CRITICAL)
			# disable logger 
			self.logger.disabled = True

		self.current_party = None
		self.current_repr = None
		self.current_topic = None
		self.current_search_words = None
		self.current_search_word = None
		self.current_speeches_dict_for_repr_for_topic = []
		self.current_collected_speech_ids = set()
		self.newest_existing_speech_date = None
	
	def check_search_words_in_string(self, string):
		for search_word in self.current_search_words:
			if search_word in string:
				return True
		return False
	
	def create_mini_batches_from_sentences(self, sentences, batch_size=100):
		mini_batches = []
		for i in range(0, len(sentences), batch_size):
			mini_batches.append(sentences[i:i+batch_size])
		return mini_batches

	def extract_opinions(self, speech, target_class = ['意見文']):
		speech_segments = speech.split('。')
		segment_batches = self.create_mini_batches_from_sentences(speech_segments)
		self.logger.info(f"Created {len(segment_batches)} speech segment batches of length {[len(batch) for batch in segment_batches]}")
		extracted_segments = []
		for idx, segment_batch in enumerate(segment_batches):
			self.logger.info(f"Encoding {len(segment_batch)} speech segments")
			encoded = self.tokenizer(segment_batch, return_tensors="pt", padding=True, truncation=True, max_length=512)
			with torch.no_grad():
				self.logger.info(f"Predicting {len(segment_batch)} speech segments")
				logits = self.model(**encoded).logits
			predicted_class_id = logits.argmax(dim=1)
			classes = [self.model.config.id2label[pred_id.item()] for pred_id in list(predicted_class_id)]
			for idx, (sentence, pred_class) in enumerate(zip(segment_batch, classes)):
				if pred_class in target_class and self.check_search_words_in_string(sentence):
					extracted_segments.extend([sentence])
		if len(extracted_segments) == 0:
			self.logger.info(f"no opinion found for in speech segments with search word {self.current_search_word}\n\n\n")
		
		return extracted_segments

	def iterate_speeches(self, record):
		output_array = []
		if record['numberOfRecords'] == 0:
			return output_array
		for idx, speech in enumerate(record['speechRecord']):
			self.logger.info(f"Working on {idx}/{len(record['speechRecord'])} speech record")
			speech_id = speech['speechID']
			house_name = speech['nameOfHouse']
			meeting_name = speech['nameOfMeeting']
			date = speech['date']
			speech_text = speech['speech']
			speech_url = speech['speechURL']
			speaker_group = speech['speakerGroup']
			extracted_opinions = self.extract_opinions(speech_text)
			if self.newest_existing_speech_date:
				if date < self.newest_existing_speech_date:
					self.logger.info(f"Reached the newest existing speech date {self.newest_existing_speech_date}")
					return ['reached_newest_existing_speech_date']
			if len(extracted_opinions) > 0 and speech_id not in self.current_collected_speech_ids:
				# speech_dict = {'speech_id': speech_id, 'house_name': house_name, 'meeting_name': meeting_name, 'date': date, 'speech_text': speech_text, 'speech_url': speech_url, 'speaker_group':speaker_group,'extracted_opinions': extracted_opinions}
				speech_dict = {'speech_id': speech_id, 'house_name': house_name, 'meeting_name': meeting_name, 'date': date, 'speech_url': speech_url, 'speaker_group':speaker_group,'extracted_opinions': extracted_opinions}
				output_array.append(speech_dict)
				self.current_collected_speech_ids.add(speech_id)
		return output_array


	def add_processed_speeches(self, cutoff_year=0):
		conditions_list = [f"any={self.current_search_word}",f"speaker={self.current_repr_name}",'recordPacking=json','maximumRecords=50']
		start_point = 1
		self.logger.info(f"searching for {self.current_repr_name} with search word {self.current_search_word} in {self.current_topic} with start point {start_point}")

		while True:
			if start_point is None:
				break
			self.logger.info(f"Making one request with start point {start_point}")
			speech_records, start_point = self.mcc.make_one_request(conditions_list, starting_point=start_point)
			self.logger.info(f"Got {speech_records['numberOfRecords']} speeches records")
			processed_speeches = self.iterate_speeches(speech_records)
			
			if len(processed_speeches) == 0:
				self.logger.info("No processed_speeches found for speech record")
				continue
			
			elif 'reached_newest_existing_speech_date' in processed_speeches:
				self.logger.info("Reached the newest existing speech date")
				break
			elif min([int(speech['date'].split('-')[0]) for speech in processed_speeches]) < cutoff_year:
				self.logger.info("Reached the cutoff date")
				break
			
			self.current_speeches_dict_for_repr_for_topic.extend(processed_speeches)
			self.logger.info(f"Added {len(processed_speeches)} speeches to the list with {len(self.current_speeches_dict_for_repr_for_topic)} speeches in total")


	def produce_statistics(self):
		total_num_reprs = 0
		total_speech_segments = 0
		total_speeches = 0
		for party in os.listdir(OUTPUT_DIR):
			if not os.path.isdir(os.path.join(OUTPUT_DIR, party)):
				continue
			party_dir = os.path.join(OUTPUT_DIR, party)
			number_of_reprs = len(os.listdir(party_dir))
			number_of_speech_segments_for_party = 0
			number_of_speeches_for_party = 0
		
			for repr in tqdm(os.listdir(party_dir)):
				self.current_repr_name = clean_repr_name(repr)
				num_repr_speech_segments = 0
				num_repr_speeches = 0
				for topic_config in self.topic_dict:
					topic = topic_config['topic_name']
					repr_topic_dir = os.path.join(OUTPUT_DIR, party, self.current_repr_name, topic)
					topic_file_path = os.path.join(repr_topic_dir, 'opinions.json')
					if os.path.exists(topic_file_path):
						existing_data = read_json(topic_file_path)
						if not existing_data:
							continue
						num_repr_speech_segments += sum([len(speech['extracted_opinions']) for speech in existing_data['speeches']])
						num_repr_speeches += len(existing_data['speeches'])
				number_of_speech_segments_for_party += num_repr_speech_segments
				number_of_speeches_for_party += num_repr_speeches
			total_num_reprs += number_of_reprs
			total_speech_segments += number_of_speech_segments_for_party
			total_speeches += number_of_speeches_for_party
			print(f"Party: {party}, Number of Representatives: {number_of_reprs}, Number of Speeches: {number_of_speeches_for_party}")
		print(f"Total Number of Representatives: {total_num_reprs}, Total Number of Speeches: {total_speeches}, Total Number of Speech Segments: {total_speech_segments}")

	def lower_historical_data_iterator(self, path):
		data = read_json(path)['data']
		for repr_data in data:
			name = repr_data['name_kanji']
			name = name.split('、')[0]
			name_kana = repr_data['name_kana']
			years = [int(year.split('-')[0]) for year in repr_data['years']]
			final_year = max(years)
			final_year_str = f"{final_year}年"
			election_parties = [ed for ed in repr_data['election_data'] if ed['year'] == final_year_str]
			first_success = [ed for ed in repr_data['election_data'] if ed['result']=='当選' or ed['result']=='繰上'][0]
			if len(election_parties) > 0:
				final_party = election_parties[0]['party']
			else:
				final_party = first_success['party']
			yield name, name_kana, final_year, final_party
			

	def upper_historical_data_iterator(self, path):
		df = pd.read_csv(path)
		for idx, row in df.iterrows():
			name = row['議員氏名']
			name_kana = row['読み方']
			party = row['会派(最終)']
			if type(row['西暦']) == str:
				final_year = max([int(year) for year in row['西暦'].split('-')])
			else:
				final_year = 0
			yield name, name_kana, final_year, party

	def length_upper_historical_data(self):
		df = pd.read_csv(upper_house_historical_data)
		return len(df)
	
	def length_lower_historical_data(self):
		data = read_json(lower_house_historical_data_path)['data']
		return len(data)

	def print_all_historical_parties(self, year_cutoff=2000):
		upper_df = pd.read_csv(upper_house_historical_data)
		lower_json = read_json(lower_house_historical_data_path)
		parties = set()
		for idx, row in upper_df.iterrows():
			if type(row['西暦'])!= str:
				continue
			max_year = max([int(year) for year in row['西暦'].split('-')])
			if max_year < year_cutoff:
				continue
			parties.add(row['会派(最終)'])
		for repr_data in lower_json['data']:
			for ed in repr_data['election_data']:
				year = int(ed['year'][:-1])
				if int(year) < year_cutoff:
					continue
				parties.add(ed['party'])
		print(parties)

	def save_progress(self, topic_file_path, finished_search_words:list[str])->None:
		self.current_speeches_dict_for_repr_for_topic = remove_duplicate_speeches(self.current_speeches_dict_for_repr_for_topic)
		sorted_speeches = sorted(self.current_speeches_dict_for_repr_for_topic, key=lambda k: k['date'], reverse=True)
		out_dict = {'party': self.current_party, 'repr_name': self.current_repr_name, 'topic': self.current_topic,
					'search_words': finished_search_words, 'speeches': sorted_speeches}
		self.logger.info(f"writing speeches for {self.current_repr_name} with search word {self.current_search_word} in {self.current_topic}")
		write_json(out_dict, topic_file_path)
		self.logger.info(f'Finished writing file')

	
	def collect_historical(self, year_cutoff=2000, house='lower'):
		if house == 'lower':
			historical_data_path = lower_house_historical_data_path
			iterator = self.lower_historical_data_iterator
			length = self.length_lower_historical_data()
		elif house == 'upper':
			historical_data_path = upper_house_historical_data
			iterator = self.upper_historical_data_iterator
			length = self.length_upper_historical_data()

		for idx, (name, name_kana, final_year, party) in enumerate(iterator(historical_data_path)):
			if final_year < year_cutoff:
				continue
			self.current_repr_name = clean_repr_name(name)
			self.current_party = select_party_name(party)
			for topic_config in self.topic_dict:
				topic = topic_config['topic_name']
				search_words = topic_config['search_words']
				self.current_topic = topic
				self.current_search_words = search_words
				repr_topic_dir = os.path.join(OUTPUT_DIR, self.current_party, self.current_repr_name, self.current_topic)
				os.makedirs(repr_topic_dir, exist_ok=True)
				topic_file_path = os.path.join(repr_topic_dir, 'opinions.json')
				covered_search_words = []
				if os.path.exists(topic_file_path):
					existing_data = read_json(topic_file_path)
					print(f"Existing data for {self.current_repr_name} with topic {self.current_topic}")
					mod_time = os.path.getmtime(topic_file_path)
					# if the opinion file dict is empty but the file is new
					if not existing_data and MONTH_AGO_STR < datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d'):
						continue
					# if the opinion file dict is empty and the file is old
					if not existing_data and MONTH_AGO_STR > datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d'):
						self.logger.info(f"Empty file found for {self.current_repr_name} with topic {self.current_topic}")
						self.newest_existing_speech_date = None
						covered_search_words = []
					# if file was modified recently and has all search words
					elif MONTH_AGO_STR < datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d') and set(existing_data['search_words']) == set(search_words):
						self.logger.info(f"File for {self.current_repr_name} with topic {self.current_topic} is not {MONTH_AGO_STR} old")
						continue
					# if file was modified recently but still missing some search words
					elif set(existing_data['search_words']) != set(search_words) and MONTH_AGO_STR < datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d'):
						self.logger.info(f"File for {self.current_repr_name} with topic {self.current_topic} is not {MONTH_AGO_STR} old")
						self.newest_existing_speech_date = existing_data['speeches'][0]['date']
						self.current_speeches_dict_for_repr_for_topic = existing_data['speeches']
						self.current_collected_speech_ids = set([speech['speech_id'] for speech in self.current_speeches_dict_for_repr_for_topic])
						covered_search_words = existing_data['search_words']
					# if file is old but still has some search words
					else:
						self.logger.info(f"Existing file found for {self.current_repr_name} with topic {self.current_topic}")
						self.newest_existing_speech_date = existing_data['speeches'][0]['date']
						print(f"Newest existing speech date {self.newest_existing_speech_date} for {self.current_repr_name} with topic {self.current_topic}")
						self.current_speeches_dict_for_repr_for_topic = existing_data['speeches']
						self.current_collected_speech_ids = set([speech['speech_id'] for speech in self.current_speeches_dict_for_repr_for_topic])
						covered_search_words = []
						
				print(f"Collecting speeches for {self.current_repr_name} - {self.current_party} with topic {self.current_topic} - {idx}/{length}")
				finished_search_words = []  + covered_search_words
				create_dir(repr_topic_dir)
				for search_word in search_words:
					if search_word in covered_search_words:
						continue
					try:
						self.current_search_word = search_word
						self.add_processed_speeches(cutoff_year=year_cutoff)
						finished_search_words.append(search_word)
					except:
						create_dir(repr_topic_dir)
						if len(self.current_speeches_dict_for_repr_for_topic) > 0 and len(finished_search_words) > 0:
							self.save_progress(topic_file_path, finished_search_words)
					time.sleep(5)
				if len(self.current_speeches_dict_for_repr_for_topic) > 0:
					self.save_progress(topic_file_path, finished_search_words)	
				else:
					write_json({}, topic_file_path)
					self.logger.info(f"no speeches found for {self.current_repr_name} with search word {self.current_search_word} in {self.current_topic}")
				self.current_speeches_dict_for_repr_for_topic = []
				self.newest_existing_speech_date = None
				self.current_collected_speech_ids = set()
				self.logger.info(f"Finished collecting speeches for {self.current_repr_name} with topic {self.current_topic}")
		
	

	def collect(self, collect_topics=[]):
		for party in self.repr_dict.keys():
			self.current_party = select_party_name(party)
			print(f"Collecting speeches for {party}")
			for repr in tqdm(self.repr_dict[party]):
				self.current_repr = repr
				self.current_repr_name = clean_repr_name(repr['name'])
				for topic_config in self.topic_dict:

					topic = topic_config['topic_name']
					if len(collect_topics) > 0 and topic not in collect_topics:
						continue

					search_words = topic_config['search_words']
					self.current_topic = topic
					self.current_search_words = search_words
					repr_topic_dir = os.path.join(OUTPUT_DIR, party, self.current_repr_name, topic)
					topic_file_path = os.path.join(repr_topic_dir, 'opinions.json')
					if os.path.exists(topic_file_path):
						existing_data = read_json(topic_file_path)
						mod_time = os.path.getmtime(topic_file_path)
						if MONTH_AGO_STR < datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d'):
							self.logger.info(f"File for {self.current_repr_name} with topic {self.current_topic} is not a week old")
							continue
						# if the opinion file dict is empty
						elif not existing_data:
							self.logger.info(f"Empty file found for {self.current_repr_name} with topic {self.current_topic}")
							self.newest_existing_speech_date = None
						else:
							self.logger.info(f"Existing file found for {self.current_repr_name} with topic {self.current_topic}")
							self.newest_existing_speech_date = existing_data['speeches'][0]['date']
							print(f"Newest existing speech date {self.newest_existing_speech_date} for {self.current_repr_name} with topic {self.current_topic}")
							self.current_speeches_dict_for_repr_for_topic = existing_data['speeches']
							self.current_collected_speech_ids = set([speech['speech_id'] for speech in self.current_speeches_dict_for_repr_for_topic])
					print(f"Collecting speeches for {self.current_repr_name} with topic {self.current_topic}")
					for search_word in search_words:
						self.current_search_word = search_word
						self.add_processed_speeches()
						time.sleep(5)
					create_dir(repr_topic_dir)
					if len(self.current_speeches_dict_for_repr_for_topic) > 0:
						self.current_speeches_dict_for_repr_for_topic = remove_duplicate_speeches(self.current_speeches_dict_for_repr_for_topic)
						sorted_speeches = sorted(self.current_speeches_dict_for_repr_for_topic, key=lambda k: k['date'], reverse=True)
						out_dict = {'party': self.current_party, 'repr_name': self.current_repr_name, 'topic': self.current_topic, 'search_words': self.current_search_words, 'speeches': sorted_speeches}
						self.logger.info(f"writing speeches for {self.current_repr_name} with search word {self.current_search_word} in {self.current_topic}")
						write_json(out_dict, topic_file_path)
						self.logger.info(f'Finished writing file')
					else:
						write_json({}, topic_file_path)
						self.logger.info(f"no speeches found for {self.current_repr_name} with search word {self.current_search_word} in {self.current_topic}")
					self.current_speeches_dict_for_repr_for_topic = []
					self.newest_existing_speech_date = None
					self.current_collected_speech_ids = set()
					self.logger.info(f"Finished collecting speeches for {self.current_repr_name} with topic {self.current_topic}")
		


# # Script to collect opinion based sentences for each topic current serving politicians

# In[ ]:


repr_topic_opinion_collector = ReprTopicOpinionCollector(house="upper")
collect_topics = [
	"防衛",
	"少子化",
	"原発",
	"物価高対策・減税と賃上げ",
	"社会保障全般の見直し（医療・介護）",
	"気候変動",
	"マイナンバー",
	"LGBTQ",
	"オンライン投票"

]
repr_topic_opinion_collector.collect(collect_topics=collect_topics)
print('Done with upper house')
repr_topic_opinion_collector = ReprTopicOpinionCollector(house="lower")
repr_topic_opinion_collector.collect()


# In[9]:


# repr_topic_opinion_collector = ReprTopicOpinionCollector()
# repr_topic_opinion_collector.print_all_historical_parties()
# repr_topic_opinion_collector.collect_historical(house='upper')
# print('Done with upper house')
# repr_topic_opinion_collector.collect_historical(house='lower')
# print('Done with lower house') 


# ## Script to produce stats on collected data

# In[4]:


repr_topic_opinion_collector = ReprTopicOpinionCollector(house="upper")
repr_topic_opinion_collector.produce_statistics()
print('Done with upper house')
repr_topic_opinion_collector = ReprTopicOpinionCollector(house="lower")
repr_topic_opinion_collector.produce_statistics()


# # Creating summary json to record topics for each politicians and how many files

# In[5]:


#create a summary json for the repr opinions data
def clean_repr_name(repr_name):
	repr_name = re.sub('\s|君|\[(.*?)\]', '', repr_name)
	return repr_name
dicts = [lower_house_repr_dict, upper_house_repr_dict]
houses = ['衆議院', '参議院']
ALL_REPRS = []
for house_dict, house in zip(dicts, houses):
	for party in house_dict.keys():
		for repr in house_dict[party]:
			repr['house'] = house
			ALL_REPRS.append(repr)

def get_hiragana_from_kanji_name(kanji_name):
	for repr in ALL_REPRS:
		if kanji_name in clean_repr_name(repr['name']):
			return repr['yomikata'], repr['house']
	return '', ''
summary_dict = {'reprs':[]}

covered_repr_names = set()
for party in [party for party in os.listdir(OUTPUT_DIR) if os.path.isdir(os.path.join(OUTPUT_DIR, party))]:
	party_dir = os.path.join(OUTPUT_DIR, party)
	for repr_name in os.listdir(party_dir):
		repr_dir_path = os.path.join(party_dir, repr_name)
		if repr_name in covered_repr_names:
			continue
		covered_repr_names.add(repr_name)
		tags = [dirname for dirname in os.listdir(repr_dir_path) if read_json(os.path.join(repr_dir_path, dirname, 'opinions.json')) != {}]
		if len(tags) == 0:
			continue
		hiragana, house = get_hiragana_from_kanji_name(repr_name)
		repr_dict = {'name': repr_name,'hiragana': hiragana,'party': party, 'house':house, 'tags': tags}
		summary_dict['reprs'].append(repr_dict)
write_json(summary_dict, os.path.join(OUTPUT_DIR, 'summary.json'))


# In[ ]:




