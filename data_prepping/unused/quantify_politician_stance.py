#%%
import os
import re
from params.paths import ROOT_DIR
from api_requests.meeting_convo_collector import MeetingConvoCollector
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_repr')
# %%
model_name = "kkatodus/jp-speech-classifier"
model_name = 'meta-llama/Llama-2-7b-chat-hf'
from sentence_transformers import SentenceTransformer
sentence_transformer = SentenceTransformer(model_name)
sentence_embedding = sentence_transformer.encode("そのことを踏まえて、総務省とすれば、御案内のとおり、ローカル一万プロジェクトや分散型エネルギーインフラプロジェクト、これらを活用してまいりたいというふうに考えております")

print('sentence embedding shape', sentence_embedding.shape)
# %%
topic = "LGBT"
repr_dirs = []
#generating paths to topic directories
for party in os.listdir(OUTPUT_DIR):
	if party.endswith('.json'): continue
	party_dir = os.path.join(OUTPUT_DIR, party)
	party_repr_dirs = [os.path.join(party_dir, repr_name) for repr_name in os.listdir(party_dir)]
	repr_dirs += party_repr_dirs

print('sample repr dir', repr_dirs[0])

name_and_topic_dirs = []
for repr_dir in repr_dirs:
	topic_dir = os.path.join(repr_dir, topic)
	repr_name = repr_dir.split('/')[-1]
	if os.path.exists(topic_dir):
		name_and_topic_dirs.append((repr_name, topic_dir))

print('sample topic dir', name_and_topic_dirs[0])

print(f'{len(repr_dirs)} politicians with topic {topic}')

def extract_speeches_with_key_word(data_dict, key_word):
	speeches = []
	for speech in data_dict['speeches']:
		for opinion in speech['extracted_opinions']:
			if key_word in opinion:
				speeches.append(speech)
	return speeches
for name_and_dir in name_and_topic_dirs:
	name, topic_dir = name_and_dir
	data_file = os.listdir(topic_dir)[0]
	data_path = os.path.join(topic_dir, data_file)
	data_dict = read_json(data_path)
	print('sample data file', data_file)
	break
# %%
