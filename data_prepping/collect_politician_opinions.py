#!/usr/bin/env python
# coding: utf-8

# In[1]:


import os
import re
import logging
import torch
from transformers import AutoTokenizer, BertForSequenceClassification
from params.paths import ROOT_DIR, CHROMEDRIVER_PATH
from api_requests.meeting_convo_collector import MeetingConvoCollector

from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data', 'data_repr_new')
create_dir(OUTPUT_DIR)
print(os.path.abspath(OUTPUT_DIR))
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin')

#reading the reprentative data for lower and upper house
lower_repr_dir = os.path.join(LOWER_HOUSE_DATA_DIR, 'repr_list')
lower_repr_file = os.listdir(lower_repr_dir)[0]
lower_house_meeting_dict = read_json(os.path.join(lower_repr_dir, lower_repr_file))

upper_repr_dir = os.path.join(UPPER_HOUSE_DATA_DIR, 'repr_list')
upper_repr_file = os.listdir(upper_repr_dir)[0]
upper_house_meeting_dict = read_json(os.path.join(upper_repr_dir, upper_repr_file))
repr_dict = lower_house_meeting_dict['reprs']


# In[2]:


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


class ReprTopicOpinionCollector:
	def __init__(self):
		self.mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")
		self.topic_dict = read_json(os.path.join(ROOT_DIR, 'resource','search_words_for_topics.json'))

		self.model_name = "kkatodus/jp-speech-classifier"
		self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
		self.model = BertForSequenceClassification.from_pretrained(self.model_name)

		log_dir = os.path.join(ROOT_DIR, 'logs')
		create_dir(log_dir)
		logging.basicConfig(filename=os.path.join(log_dir, 'politician_opinion_collection.log'), filemode='w', format='%(asctime)s - %(message)s')
		self.logger = logging.getLogger()
		self.logger.setLevel(logging.DEBUG)

		self.current_party = None
		self.current_repr = None
		self.current_topic = None
		self.current_search_words = None
		self.current_search_word = None
		self.current_speeches_dict_for_repr_for_topic = []
	
	def check_search_words_in_string(self, string):
		for search_word in self.current_search_words:
			if search_word in string:
				return True
		return False
	
	def create_mini_batches_from_sentences(self, sentences, batch_size=200):
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
			if len(extracted_opinions) > 0:
				# speech_dict = {'speech_id': speech_id, 'house_name': house_name, 'meeting_name': meeting_name, 'date': date, 'speech_text': speech_text, 'speech_url': speech_url, 'speaker_group':speaker_group,'extracted_opinions': extracted_opinions}
				speech_dict = {'speech_id': speech_id, 'house_name': house_name, 'meeting_name': meeting_name, 'date': date, 'speech_url': speech_url, 'speaker_group':speaker_group,'extracted_opinions': extracted_opinions}
				output_array.append(speech_dict)
		return output_array

	def add_processed_speeches(self):
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
			self.current_speeches_dict_for_repr_for_topic.extend(processed_speeches)
			self.logger.info(f"Added {len(processed_speeches)} speeches to the list with {len(self.current_speeches_dict_for_repr_for_topic)} speeches in total")

	def collect(self):
		for party in repr_dict.keys():
			self.current_party = party
			for repr in repr_dict[party]:
				self.current_repr = repr
				self.current_repr_name = clean_repr_name(repr['name'])
				for topic, search_words in self.topic_dict.items():
					self.current_topic = topic
					self.current_search_words = search_words
					repr_topic_dir = os.path.join(OUTPUT_DIR, party, self.current_repr_name, topic)
					topic_file_path = os.path.join(repr_topic_dir, 'opinions.json')
					if os.path.exists(topic_file_path):
						print('Already collected speeches for',party, self.current_repr_name, topic)
						continue
					print(f"Collecting speeches for {self.current_repr_name} with topic {self.current_topic}")
					for search_word in search_words:
						self.current_search_word = search_word
						self.add_processed_speeches()
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
		


# # Script to collect opinion based sentences for each topic

# In[3]:


repr_topic_opinion_collector = ReprTopicOpinionCollector()
repr_topic_opinion_collector.collect()


# # Creating summary json to record topics for each politicians and how many files

# In[ ]:


#create a summary json for the repr opinions data
summary_dict = {'reprs':{}}
for party in repr_dict.keys():
	summary_dict['reprs'][party] = {}
	for repr in repr_dict[party]:
		repr_name = repr['name']
		repr_name = clean_repr_name(repr_name)
		repr_dir_path = os.path.join(OUTPUT_DIR,party, repr_name)
		if not os.path.exists(repr_dir_path):
			continue
		tags = [dirname for dirname in os.listdir(repr_dir_path)]
		if len(tags) == 0:
			continue
		summary_dict['reprs'][party][repr_name] = {}
		summary_dict['reprs'][party][repr_name]['tags'] = tags
		summary_dict['reprs'][party][repr_name]['number_of_files'] = {}
		for tag in tags:
			topic_dir = os.path.join(repr_dir_path, tag)
			number_of_files = len(os.listdir(topic_dir))
			summary_dict['reprs'][party][repr_name]['number_of_files'][tag] = number_of_files
write_json(summary_dict, os.path.join(OUTPUT_DIR, 'summary.json'))


# In[ ]:




