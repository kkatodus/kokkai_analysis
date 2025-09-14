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
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file
import pandas as pd


OUTPUT_DIR = os.path.join(ROOT_DIR, 'data', 'data_repr_speeches')
create_dir(OUTPUT_DIR)
print(os.path.abspath(OUTPUT_DIR))
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin')
TODAY_STR = datetime.today().strftime('%Y-%m-%d')
MAX_MONTH_OLD = 6
MONTH_AGO_STR = (datetime.today() - timedelta(days=30*MAX_MONTH_OLD)).strftime('%Y-%m-%d')

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


print("Lower Repr File", lower_repr_file)
print("Upper Repr File", upper_repr_file)

repr_history_prompt = ""
topic_summary_prompt = ""

class ReadableReprSummaryGenerator:
	def __init__(self):
		pass

	def create_repr_history(self):
		pass

	def create_readable_for_politician_for_topic(self, topic_opinions_path:str, party:str=None, name:str=None):
		speeches_json_data = read_json(topic_opinions_path)
		print(speeches_json_data)




sample_path = "data/data_repr_speeches/自民/あかま二郎/防衛/opinions.json"
create_readable_for_politician_for_topic(sample_path)



