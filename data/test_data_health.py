#!/usr/bin/env python
# coding: utf-8

# In[1]:


import os
from params.paths import ROOT_DIR
from datetime import datetime, timedelta
from tqdm import tqdm
import pandas as pd

from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data', 'data_repr_speeches')
create_dir(OUTPUT_DIR)
print(os.path.abspath(OUTPUT_DIR))
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data', 'data_sangiin')
REPR_SPEECHES_DIR = os.path.join(ROOT_DIR, 'data', 'data_repr_speeches')
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

# execute if want to collect historical data
lower_house_historical_data_path = os.path.join(LOWER_HOUSE_DATA_DIR,'repr_list', 'historical.json')
upper_house_historical_data = os.path.join(UPPER_HOUSE_DATA_DIR,'repr_list', 'historical.csv')

print("Lower Repr File", lower_repr_file)
print("Upper Repr File", upper_repr_file)


# In[17]:


def iterate_repr_speeches():
	for party in os.listdir(REPR_SPEECHES_DIR):
		if os.path.isdir(os.path.join(REPR_SPEECHES_DIR, party)):
			party_dir = os.path.join(REPR_SPEECHES_DIR, party)
			for repr_name in os.listdir(party_dir):
				repr_dir = os.path.join(party_dir, repr_name)
				if os.path.isdir(repr_dir):
					for topic_dir in os.listdir(repr_dir):
						topic_dir = os.path.join(repr_dir, topic_dir)
						if os.path.isdir(topic_dir):
							for speech_file in os.listdir(topic_dir):
								speech_path = os.path.join(topic_dir, speech_file)
								if not speech_file.endswith('.json'):
									continue
								speech_data = read_json(speech_path)
								if "repr_name" in speech_data.keys() and "speeches" in speech_data.keys():
									yield speech_data, speech_path, party



known_reprs = []
already_asked = []
for speech_data, speech_path, party in iterate_repr_speeches():
	
	for known_repr in known_reprs:
		if known_repr['repr_name'] == speech_data['repr_name'] and known_repr['party'] != party:
			if speech_data['repr_name'] in already_asked:
				continue

			
			result = input(f"Duplicate representative name found: \n Repr1 Path: {known_repr['speech_path']} \n Repr2 Path: {speech_path} \n Move on? (y/n): ")

			if result.lower() == 'y':
				already_asked.append(speech_data['repr_name'])
				break
			else:

				raise ValueError(f"Duplicate representative name found: {known_repr['repr_name']} in {known_repr['party']} and {party}")

	
	known_reprs.append({
		'repr_name': speech_data['repr_name'],
		'party': party,
		'speech_path': speech_path
	})
	




# In[ ]:




