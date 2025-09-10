#!/usr/bin/env python
# coding: utf-8

# In[2]:


import os 
import json
from params.paths import ROOT_DIR
from file_handling.file_read_writer import get_newest_file, read_json
import random as rnd

DATA_DIR = os.path.join(ROOT_DIR, 'data')
MANIFESTO_DIR = os.path.join(DATA_DIR, 'data_manifesto')
CURRENT_ELECTION_DIR = os.path.join(MANIFESTO_DIR, '2025UpperHouseElection')
PROMPTS_DIR = os.path.join(ROOT_DIR, 'prompts', "txts", "manifesto_analysis")

def get_party_list():
	party_list_path = os.path.join(CURRENT_ELECTION_DIR, 'parties.json')
	with open(party_list_path, 'r') as f:
		party_list = json.load(f)
	return party_list['parties']


PARTIES = get_party_list()
for party in PARTIES:
	os.makedirs(os.path.join(CURRENT_ELECTION_DIR, party), exist_ok=True)
	


# ## Collecting manifesto of parties

# In[3]:


from api_requests.prompter import DeepResearchGPT, DeepResearchGemini, DeepResearchClaude

class ManifestoCollector:
	def __init__(self):
		# self.prompter = DeepResearchGPT(gpt_model="o3")
		self.prompters = {
			"o3": DeepResearchGPT(gpt_model="o3"),
			"gemini-2.5-pro": DeepResearchGemini(model_name="gemini-2.5-pro"),
			# "claude-opus-4-20250514": DeepResearchClaude(model_name="claude-opus-4-20250514")
		}
		self.model_name = "gemini-2.5-pro"
		self.prompter = self.prompters[self.model_name]

	def get_manifesto_of_party(self, party_name, past_manifesto=""):
		system_prompt = open(os.path.join(PROMPTS_DIR, 'collect_manifesto_system.txt'), 'r').read()
		prompt = open(os.path.join(PROMPTS_DIR, 'collect_manifesto_prompt.txt'), 'r').read()
		prompt = prompt.replace('PARTY_NAME', party_name)
		prompt = prompt.replace('PAST_MANIFESTO', past_manifesto)

		main_focuses = open(os.path.join(CURRENT_ELECTION_DIR, 'main_focuses.txt'), 'r').read()
		prompt = prompt.replace('MAIN_FOCUSES', main_focuses)

		print("SYSTEM PROMPT:", system_prompt)
		if self.model_name == "o3":
			reply, annotations = self.prompter.prompt(prompt, system_prompt)
		else:
			reply, _, chunks = self.prompter.prompt(prompt, system_prompt)
			chunks = [c['uri'] for c in chunks]
			annotations = ','.join(chunks)

			
		return reply, annotations
	
	def get_global_manifesto(self, party_name):
		print("GETTING GLOBAL MANIFESTO FOR", party_name)
		party_manifesto_dir = os.path.join(CURRENT_ELECTION_DIR, party_name)
		global_manifesto_txt_file = [f for f in os.listdir(party_manifesto_dir) if f.endswith('.txt') and "manifesto" in f][0]
		print("OLDEST_MANIFESTO_FILE", global_manifesto_txt_file)
		global_manifesto = open(os.path.join(party_manifesto_dir, global_manifesto_txt_file), 'r', encoding='utf-8').read()
		manifesto_version = global_manifesto_txt_file.split('_')[1].split('.')[0]
		return global_manifesto, int(manifesto_version)
	



# In[ ]:


collector = ManifestoCollector()
collect_for_parties = []

# rnd.shuffle(PARTIES)
for party in collect_for_parties:
	manifesto = None
	print("Working on collecting manifesto of", party)
	past_manifesto = ""
	past_manifesto, manifesto_version = collector.get_global_manifesto(party)
	print("MANIFESTO VERSION:", manifesto_version)


	if len(past_manifesto) > 0:
		manifesto, annotations = collector.get_manifesto_of_party(party, past_manifesto)
	else:
		manifesto, annotations = collector.get_manifesto_of_party(party)

	with open(os.path.join(CURRENT_ELECTION_DIR, party, f'manifesto_{manifesto_version+1}.txt'), 'w') as f:
		f.write(manifesto)


	


# ## マニフェストの整合性評価と実行可能性評価

# In[4]:


# preprocessing of the manifesto txt files
import re
collector = ManifestoCollector()


policy_pattern = re.compile(r"""
    ^\s*TOPIC:\s*(?P<topic>[^\r\n]+)\r?\n
    ^\s*TOPIC_EN:\s*(?P<topic_en>[^\r\n]+)\r?\n
    ^\s*ASSIGNED_TOPIC_TAG:\s*(?P<assigned_tag>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_TEXT:\s*(?P<text>[^\r\n]+)\r?\n
    ^\s*MANIFESTO_SUMMARY:\s*(?P<summary>[^\r\n]+)\r?\n
    ^\s*SOURCE_URL:\s*(?P<urls>[^\r\n]+)
""", re.MULTILINE | re.VERBOSE)


def process_manifesto_for_party(party_name):
	manifesto, manifesto_version = collector.get_global_manifesto(party_name)
	print(manifesto)
	policies_in_file = [m.groupdict() for m in policy_pattern.finditer(manifesto)]
	expected_num_policies = manifesto.count("TOPIC:")
	if len(policies_in_file) != expected_num_policies:
		raise ValueError(f"WARNING: {party_name} has {len(policies_in_file)} policies, but expected {expected_num_policies}")
	
	for i, policy in enumerate(policies_in_file):
		print(policy)
		policy['id'] = f"{party_name}_{i}"
		policy['urls'] = [url.strip() for url in policy['urls'].split(',')]

	
	return policies_in_file


for party in PARTIES:
	party_policies = process_manifesto_for_party(party)
	with open(os.path.join(CURRENT_ELECTION_DIR, party, 'policies.json'), 'w') as f:
		json.dump({"policies": party_policies}, f, ensure_ascii=False, indent=4)




# In[ ]:


from thefuzz import fuzz
from api_requests.prompter import DeepResearchGPT, DeepResearchGemini, DeepResearchClaude

class ManifestoEvaluator:
	def __init__(self):
		self.prompters = {
			"o3": DeepResearchGPT(gpt_model="o3"),
			"gemini-2.5-pro": DeepResearchGemini(model_name="gemini-2.5-pro"),
			# "claude-opus-4-20250514": DeepResearchClaude(model_name="claude-opus-4-20250514")
		}

	def convert_coherence_flag_to_json(self, flag_coherence_text):
		block_re = re.compile(r"""
			^\s*POLICY_NAME1:\s*(?P<name1>.+?)\s*\r?\n      # 政策タイトル 1
			^\s*POLICY_NAME2:\s*(?P<name2>.+?)\s*\r?\n      # 政策タイトル 2
			^\s*POLICY_ID1:\s*(?P<id1>.+?)\s*\r?\n          # 政策 ID 1
			^\s*POLICY_ID2:\s*(?P<id2>.+?)\s*\r?\n          # 政策 ID 2
			^\s*整合性のない理由：(?P<reason>[\s\S]*?)      # 理由（複数行 OK）
			(?=^\s*POLICY_NAME1:|\Z)                        # 次ブロック or EOF で終了
		""", re.MULTILINE | re.VERBOSE)
		non_coherence = [
			{
				"policy1": m["policy1"].strip(),
				"policy1_id": m["id1"].strip(),
				"policy2": m["id2"].strip(),
				"policy2_id": m["policy2_id"].strip(),
				"reason":  re.sub(r"\s+", " ", m["reason"]).strip()
			}
			for m in block_re.finditer(flag_coherence_text)
		]
		return non_coherence


	def flag_coherence(self, manifesto, party_name):
		for model_name, prompter in self.prompters.items():
			# if not os.path.exists(os.path.join(CURRENT_ELECTION_DIR, party_name, f'flag_coherence_{model_name}.txt')):
			system_prompt = open(os.path.join(PROMPTS_DIR, 'flag_coherence_system.txt'), 'r').read()
			prompt = open(os.path.join(PROMPTS_DIR, 'flag_coherence_prompt.txt'), 'r').read()
			prompt = prompt.replace('MANIFESTO_TEXT', manifesto)
			print("MODEL:", model_name)
			print("PROMPT:", prompt)
			print("SYSTEM PROMPT:", system_prompt)
			if "gemini" in model_name:
				reply, _, _ = prompter.prompt(prompt, system_prompt)	
			else:
				reply, annotations = prompter.prompt(prompt, system_prompt)
			with open(os.path.join(CURRENT_ELECTION_DIR, party_name, f'flag_coherence_{model_name}.txt'), 'w') as f:
				f.write(reply)
			# if os.path.exists(os.path.join(CURRENT_ELECTION_DIR, party_name, f'flag_coherence_{model_name}.json')):
			# 	coherence_flag_text = open(os.path.join(CURRENT_ELECTION_DIR, party_name, f'flag_coherence_{model_name}.txt'), 'r').read()
			# 	non_coherence_json = self.convert_coherence_flag_to_json(coherence_flag_text)
			# 	with open(os.path.join(CURRENT_ELECTION_DIR, party_name, f'flag_coherence_{model_name}.json'), 'w') as f:
			# 		json.dump(non_coherence_json, f, ensure_ascii=False, indent=4)


	def convert_manifesto_json_to_txt(self, manifesto_json):
		for policy in manifesto_json:
			policy_txt = ""
			for key, value in policy.items():
				if type(value) == str:
					policy_txt += f"{key}:{value}\n"
				if type(value) == list:
					policy_txt += f"{key}:{','.join(value)}\n"
			policy_txt += "\n"
		return policy_txt

	

	def investigate_coherence(self, party):
		investigated_coherence = []
		# if not os.path.exists(os.path.join(CURRENT_ELECTION_DIR, party, 'investigated_coherence_progress.json')):
		# 	investigated_coherence = []
		# else:
		# 	investigated_coherence = read_json(os.path.join(CURRENT_ELECTION_DIR, party, 'investigated_coherence_progress.json'))
		party_policies = read_json(os.path.join(CURRENT_ELECTION_DIR, party, 'policies.json'))["policies"]
		policy_summaries = [p["summary"] for p in party_policies]
		policy_topics = [p["topic"] for p in party_policies]
		if len(investigated_coherence) == 0:
			for model_name in self.prompters.keys():
				coherence_flag_array = read_json(os.path.join(CURRENT_ELECTION_DIR, party, f'flag_coherence_{model_name}.json'))
				for c in coherence_flag_array:
					coherence_flag_p1 = c["policy1"]
					coherence_flag_p2 = c["policy2"]
					# get most similar policy from policy_summaries
					policy1 = max(policy_topics, key=lambda x: fuzz.ratio(x, coherence_flag_p1))
					policy2 = max(policy_topics, key=lambda x: fuzz.ratio(x, coherence_flag_p2))
					policy1_index = policy_topics.index(policy1)
					policy2_index = policy_topics.index(policy2)
					c["policy1"] = party_policies[policy1_index]
					c["policy2"] = party_policies[policy2_index]
					c["coherence_flag_p1"] = coherence_flag_p1
					c["coherence_flag_p2"] = coherence_flag_p2
					c["flagged_by"] = model_name
					investigated_coherence.append(c)

		investigate_coherence_system = open(os.path.join(PROMPTS_DIR, 'investigate_coherence_system.txt'), 'r').read()
		investigate_coherence_prompt = open(os.path.join(PROMPTS_DIR, 'investigate_coherence_prompt.txt'), 'r').read()
		# investiagate 
		for c in investigated_coherence:
			# load investigating prompts
			prompt = investigate_coherence_prompt.replace('POLICY_1_TOPIC', c["policy1"]["topic"])
			prompt = prompt.replace('POLICY_1_SUMMARY', c["policy1"]["summary"])
			prompt = prompt.replace('POLICY_1_CITATION', c["policy1"]["text"])
			prompt = prompt.replace('POLICY_1_URL', c["policy1"]["url"])
			prompt = prompt.replace('POLICY_2_TOPIC', c["policy2"]["topic"])
			prompt = prompt.replace('POLICY_2_SUMMARY', c["policy2"]["summary"])
			prompt = prompt.replace('POLICY_2_CITATION', c["policy2"]["text"])
			prompt = prompt.replace('POLICY_2_URL', c["policy2"]["url"])
			prompt = prompt.replace('COHERENCE_REASON', c["reason"])

			for model, prompter in self.prompters.items():
				if f"{model}_investigation" in c:
					print(f"Skipping {model} investigation for {c['policy1']['topic']} and {c['policy2']['topic']} because it already exists for party {party}")
					continue

				if "gemini" in model:
					reply, sorted_supports, chunks = prompter.prompt(prompt, "")
					c[f"{model}_investigation"] = {
						"sorted_supports": sorted_supports,
						"chunks": chunks,
						"reply": reply
					}
				else:
					reply, annotations = prompter.prompt(prompt, investigate_coherence_system)
					c[f"{model}_investigation"] = {
						"annotations": annotations,
						"reply": reply
					}
				with open(os.path.join(CURRENT_ELECTION_DIR, party, f'investigated_coherence_progress.json'), 'w') as f:
					json.dump(investigated_coherence, f, ensure_ascii=False, indent=4)

		return investigated_coherence
			

	


# ## Coherence flagging

# In[ ]:


evaluator = ManifestoEvaluator()
for party in PARTIES:
	policy_json_path = os.path.join(CURRENT_ELECTION_DIR, party, 'policies.json')
	policy_json = read_json(policy_json_path)
	manifesto_txt = evaluator.convert_coherence_flag_to_json(policy_json['policies'])
	evaluator.flag_coherence(manifesto_txt, party)
	


# ## Further deep dive

# In[13]:


evaluator = ManifestoEvaluator()
for party in PARTIES:
	investigated_coherence = evaluator.investigate_coherence(party)
	with open(os.path.join(CURRENT_ELECTION_DIR, party, 'investigated_coherence.json'), 'w') as f:
		json.dump(investigated_coherence, f, ensure_ascii=False, indent=4)


# In[ ]:





# In[ ]:




