#%%
import os
import re
from params.paths import ROOT_DIR, CHROMEDRIVER_PATH
from api_requests.meeting_convo_collector import MeetingConvoCollector
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file
# %%
#paths
OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_repr')
create_dir(OUTPUT_DIR)
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_sangiin')

MAJOR_TOPICS = {
    'エネルギー':['エネルギー'],
    '安全保障':['安全保障'],
    '少子化対策': ['少子'],
    'LGBT':['LGBT'],
}
# %%
#reading the reprentative data for lower and upper house
lower_repr_dir = os.path.join(LOWER_HOUSE_DATA_DIR, 'repr_list')
lower_repr_file = os.listdir(lower_repr_dir)[0]
lower_house_meeting_dict = read_json(os.path.join(lower_repr_dir, lower_repr_file))

upper_repr_dir = os.path.join(UPPER_HOUSE_DATA_DIR, 'repr_list')
upper_repr_file = os.listdir(upper_repr_dir)[0]
upper_house_meeting_dict = read_json(os.path.join(upper_repr_dir, upper_repr_file))
# %%
mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")

def collect_speeches_for_repr(search_terms, repr_name, party_dir):
	repr_name = re.sub('\s|君', '', repr_name)
	conditions_list = [
		f"any={' '.join(search_terms)}",
		f"speaker={repr_name}",
		'recordPacking=json'
	]
	search_requests = mcc.make_requests(conditions_list=conditions_list)
	write_json(search_requests, os.path.join(party_dir, repr_name+'.json'))

def collect_speeches_for_reprs(search_terms, reprs, topic_dir):
	for party in reprs.keys():
		repr_list = reprs[party]
		party_dir = os.path.join(topic_dir, party)
		create_dir(party_dir)
		for repr in repr_list:
			name = repr['name']
			print(f"Collecting data for {name}")
			collect_speeches_for_repr(search_terms, name, party_dir)


def collect_speeches_for_house(house):
	house_dir = os.path.join(OUTPUT_DIR, house)
	create_dir(house_dir)
	for topic in MAJOR_TOPICS.keys():
		topic_dir = os.path.join(house_dir, topic)
		create_dir(topic_dir)
		search_terms = MAJOR_TOPICS[topic]
		repr_dict = lower_house_meeting_dict if house == 'lower' else upper_house_meeting_dict
		repr_dict = repr_dict['reprs']
		print(f"Collecting data for {topic}")
		collect_speeches_for_reprs(search_terms, repr_dict, topic_dir)
    
# %%
for house in ['lower', 'upper']:
	collect_speeches_for_house(house)