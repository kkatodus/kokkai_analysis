#%%
import os
import re
from params.paths import ROOT_DIR
from api_requests.meeting_convo_collector import MeetingConvoCollector
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_repr')
# %%
model_name = "kkatodus/jp-speech-classifier"
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


# %%
