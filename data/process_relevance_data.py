#!/usr/bin/env python
# coding: utf-8

# In[1]:


import os
from dotenv import load_dotenv
from params.paths import ROOT_DIR, DATA_DIR
from dbio.representative_db import connect_db, get_person_by_column, get_closest_person_by_name

load_dotenv()

RELEVANCE_DATA_DIR = os.path.join(DATA_DIR, "relevance_data")
SPEECH_FILE_PATH = os.path.join(RELEVANCE_DATA_DIR, "speech.tsv")
DISCUSSION_FILE = os.path.join(RELEVANCE_DATA_DIR, "discussion.tsv")
ISSUE_FILE = os.path.join(RELEVANCE_DATA_DIR, "issue.tsv")
AGGREGATE_FILE = os.path.join(RELEVANCE_DATA_DIR, "aggregate.tsv")
conn = connect_db(
	dbname="kokkaidoc",
	user="postgres",
	password=os.getenv("PSQL_DATABASE_PASSWORD"),
	host="localhost",
	port="5432"
)

with conn.cursor() as cur:
	rows = get_person_by_column(cur, "name_kanji", "河野太郎")
	if len(rows) == 1:
		person_id = rows[0].person_id
		print(person_id)

# investigate files
with open(SPEECH_FILE_PATH, "r") as f:
	first_line = f.readline()
	second_line = f.readline()
	third_line = f.readline()
	print("------------------------------------------")
	print("PATH",SPEECH_FILE_PATH)
	print("columns\n", first_line)
	print("examples\n", second_line)
	print("examples\n", third_line)
with open(DISCUSSION_FILE, "r") as f:
	first_line = f.readline()
	second_line = f.readline()
	third_line = f.readline()
	print("------------------------------------------")
	print("PATH",DISCUSSION_FILE)
	print("columns\n", first_line)
	print("examples\n", second_line)
	print("examples\n", third_line)
with open(ISSUE_FILE, "r") as f:
	first_line = f.readline()
	second_line = f.readline()
	third_line = f.readline()
	print("------------------------------------------")
	print("PATH",ISSUE_FILE)
	print("columns\n", first_line)
	print("examples\n", second_line)
	print("examples\n", third_line)

with open(AGGREGATE_FILE, "r") as f:
	first_line = f.readline()
	second_line = f.readline()
	third_line = f.readline()
	print("------------------------------------------")
	print("PATH",AGGREGATE_FILE)
	print("columns\n", first_line)
	print("examples\n", second_line)
	print("examples\n", third_line)


# ## lets first process the low hanging fruit of processing the aggregate file into separate files and attaching person ids

# In[2]:


import json
output_dir = os.path.join(RELEVANCE_DATA_DIR, "aggregate_processed")
os.makedirs(output_dir, exist_ok=True)


conn = connect_db(
	dbname="kokkaidoc",
	user="postgres",
	password=os.getenv("PSQL_DATABASE_PASSWORD"),
	host="localhost",
	port="5432"
)

speaker_id_conversion = {
	"福島みずほ": "福島瑞穂",
	"大石あきこ": "大石晃子"
}

cur = conn.cursor()
processed_datas = {}

with open(AGGREGATE_FILE, "r") as f, open(os.path.join(RELEVANCE_DATA_DIR, "aggregate_processed.jsonl"), "w") as f_out:
	columns = f.readline().strip().split("\t")
	for line_number, line in enumerate(f):
		line_values = line.strip().split("\t")
		if len(line_values) != len(columns):
			raise ValueError(f"Line {line_number} has {len(line_values)} columns, expected {len(columns)}")
		
		processed_data = {k: v for k, v in zip(columns, line_values)}
		print(processed_data)
		speaker_id = processed_data["speakerID"]
		if speaker_id in speaker_id_conversion:
			speaker_id = speaker_id_conversion[speaker_id]
		person_row_from_db = get_person_by_column(cur, "name_kanji", speaker_id)
		if len(person_row_from_db) != 1:
			print(f"Found {len(person_row_from_db)} persons with name {speaker_id}, passing for now")
			continue
		person_id = person_row_from_db[0].person_id
		if person_id in processed_datas:
			processed_datas[person_id]["Total_Count"] += int(processed_data["Total_Count"])
			processed_datas[person_id]["R_True_P_True"] += int(processed_data["R_True_P_True"])
			processed_datas[person_id]["R_True_P_False"] += int(processed_data["R_True_P_False"])
			processed_datas[person_id]["R_False_P_True"] += int(processed_data["R_False_P_True"])
			processed_datas[person_id]["R_False_P_False"] += int(processed_data["R_False_P_False"])
			processed_datas[person_id]["prop_R_True_P_True"] = processed_datas[person_id]["R_True_P_True"] / processed_datas[person_id]["Total_Count"]
			processed_datas[person_id]["prop_R_True_P_False"] = processed_datas[person_id]["R_True_P_False"] / processed_datas[person_id]["Total_Count"]
			processed_datas[person_id]["prop_R_False_P_True"] = processed_datas[person_id]["R_False_P_True"] / processed_datas[person_id]["Total_Count"]
			processed_datas[person_id]["prop_R_False_P_False"] = processed_datas[person_id]["R_False_P_False"] / processed_datas[person_id]["Total_Count"]
			processed_datas[person_id]["prop_R_True_P_True"] = processed_datas[person_id]["R_True_P_True"] / processed_datas[person_id]["Total_Count"]
			continue

		processed_data["person_id"] = person_id
		total_count = int(processed_data["Total_Count"])
		prop_prd_rel = int(processed_data["R_True_P_True"]) / total_count
		prop_notprd_rel = int(processed_data["R_True_P_False"]) / total_count
		prop_prd_notrel = int(processed_data["R_False_P_True"]) / total_count
		prop_notprd_notrel = int(processed_data["R_False_P_False"]) / total_count
		processed_data["prop_R_True_P_True"] = prop_prd_rel
		processed_data["prop_R_True_P_False"] = prop_notprd_rel
		processed_data["prop_R_False_P_True"] = prop_prd_notrel
		processed_data["prop_R_False_P_False"] = prop_notprd_notrel
		processed_data["Total_Count"] = int(processed_data["Total_Count"])
		processed_data["R_True_P_True"] = int(processed_data["R_True_P_True"])
		processed_data["R_True_P_False"] = int(processed_data["R_True_P_False"])
		processed_data["R_False_P_True"] = int(processed_data["R_False_P_True"])
		processed_data["R_False_P_False"] = int(processed_data["R_False_P_False"])
		processed_datas[person_id] = processed_data

		# f_out.write(json.dumps(processed_data, ensure_ascii=False) + "\n") 
		# with open(os.path.join(output_dir, f"{person_id}.json"), "w") as f:
		# 	json.dump(processed_data, f, ensure_ascii=False)

	for person_id, data in processed_datas.items():
		f_out.write(json.dumps(data, ensure_ascii=False) + "\n")
		with open(os.path.join(output_dir, f"{person_id}.json"), "w") as f:
			json.dump(data, f, ensure_ascii=False)

cur.close()
conn.close()
# for how many people did we find data?
print(f"Found data for {len(os.listdir(output_dir))} people")


# ## Now lets process the discussion file

# In[ ]:


from params.paths import DATA_DIR
import shutil

repr_speeches_organized_dir = os.path.join(DATA_DIR, "repr_speeches_id_organized")
repr_speeches_organized_with_prd_and_rl_dir = os.path.join(DATA_DIR, "repr_speeches_id_organized_with_prd_and_rl")
all_speeches_with_relevance_dir = os.path.join(DATA_DIR, "data_all_speeches_with_prd_and_rl")
os.makedirs(all_speeches_with_relevance_dir, exist_ok=True)

conn = connect_db(
	dbname="kokkaidoc",
	user="postgres",
	password=os.getenv("PSQL_DATABASE_PASSWORD"),
	host="localhost",
	port="5432"
)

def return_files_with_speech_id(speech_id:str, repr_speeches_dir:str):
	if not os.path.exists(repr_speeches_dir):
		return []
	repr_speeches_files = os.listdir(repr_speeches_dir)
	files_with_speech_id = []
	for file in repr_speeches_files:
		with open(os.path.join(repr_speeches_dir, file), "r") as f:
			for line in f:
				data = json.loads(line)
				if data['speechID'] == speech_id:
					files_with_speech_id.append(file)
	return files_with_speech_id

def create_new_file_with_productivity_flag_for_speech_id(
	speech_id: str,
	rewrite_file_dir: str,
	rewrite_file_name: str, 
	is_productive: bool,
	is_relevant: bool,
	quality_reason: str,
):
	tmp_file_path = os.path.join(rewrite_file_dir, f"tmp_{rewrite_file_name}")
	rewrite_file_path = os.path.join(rewrite_file_dir, rewrite_file_name)

	with open(rewrite_file_path, "r") as f, open(tmp_file_path, "w") as f_out:
		for line in f:
			data = json.loads(line)
			if data['speechID'] == speech_id:
				data['is_productive'] = is_productive
				data['is_relevant'] = is_relevant
				data['quality_reason'] = quality_reason
			f_out.write(json.dumps(data, ensure_ascii=False) + "\n")
	os.remove(rewrite_file_path)
	os.rename(tmp_file_path, rewrite_file_path)




cur = conn.cursor()
person_kanji2id_cache = {}

print("Processing discussion file")
with open(DISCUSSION_FILE, "r") as f:
	columns = f.readline().strip().split("\t")
	number_of_lines = sum(1 for line in f)
	f.seek(0)
	next(f)

	print("Number of lines", number_of_lines)
	for line_number, line in enumerate(f):
		print("Processing line number", line_number, "of", number_of_lines)
		line_values = line.strip().split("\t")
		if len(line_values) != len(columns):
			raise ValueError(f"Line {line_number} has {len(line_values)} columns, expected {len(columns)}")
		
		processed_data = {k: v for k, v in zip(columns, line_values)}
		# print("Processed data for line number", line_number, "of", number_of_lines, "\n", processed_data)
		# print(processed_data)
		initiator = processed_data['initiator']
		if initiator in speaker_id_conversion:
			initiator = speaker_id_conversion[initiator]
		quality_reason = processed_data['quality_reason']
		issue_id = processed_data['issueID']
		speech_id = processed_data['discussionID']
		is_productive = processed_data['is_productive']
		is_relevant = processed_data['is_relevant']

		if initiator not in person_kanji2id_cache:
			print("Cache miss for", initiator, "getting from db")
			person_row_from_db = get_person_by_column(cur, "name_kanji", initiator)
			if len(person_row_from_db) != 1:
				continue
			person_kanji2id_cache[initiator] = person_row_from_db[0].person_id
			print("Caching", initiator, "->", person_kanji2id_cache[initiator])
		person_id = person_kanji2id_cache[initiator]
		repr_speeches_dir = os.path.join(repr_speeches_organized_dir, str(person_id))
		output_for_person_dir = os.path.join(repr_speeches_organized_with_prd_and_rl_dir, str(person_id))
		os.makedirs(output_for_person_dir, exist_ok=True)
		files_with_speech_id = return_files_with_speech_id(speech_id, repr_speeches_dir)
		if len(files_with_speech_id) == 0:
			continue
		for file in files_with_speech_id:
			if "tmp_" in file:
				continue
			file_path = os.path.join(repr_speeches_dir, file)
			output_file_path = os.path.join(output_for_person_dir, file)
			if not os.path.exists(output_file_path):
				shutil.copy(file_path, output_file_path)

			create_new_file_with_productivity_flag_for_speech_id(
				speech_id=speech_id,
				rewrite_file_dir=output_for_person_dir,
				rewrite_file_name=file,
				is_productive=is_productive,
				is_relevant=is_relevant,
				quality_reason=quality_reason,
			)
		# now lets change the file we have in data_all_speeches_with_prd_and_rl
		issue_dir = os.path.join(all_speeches_with_relevance_dir, str(issue_id))
		speeches_file_path = os.path.join(issue_dir, "speeches.jsonl")
		output_tmp_file = os.path.join(issue_dir, "tmp_speeches.jsonl")
		with open(speeches_file_path, "r") as f, open(output_tmp_file, "w") as f_out:
			for line in f:
				data = json.loads(line)
				if data['speechID'] == speech_id:
					data['is_productive'] = is_productive
					data['is_relevant'] = is_relevant
					data['quality_reason'] = quality_reason
				f_out.write(json.dumps(data, ensure_ascii=False) + "\n")
		os.remove(speeches_file_path)
		os.rename(output_tmp_file, speeches_file_path)

cur.close()
conn.close()


# ## Temp script to sort all repr speeches according to date

# In[ ]:


from params.paths import DATA_DIR
target_dir = os.path.join(DATA_DIR, "repr_speeches_id_organized_with_prd_and_rl")

for person_id in os.listdir(target_dir):
	print("person id", person_id)
	person_dir = os.path.join(target_dir, person_id)
	for file in os.listdir(person_dir):
		if "tmp_" in file:
			continue
		file_path = os.path.join(person_dir, file)

		with open(file_path, "r") as f:
			lines = f.readlines()
			lines = [json.loads(line) for line in lines]
			lines = sorted(lines, key=lambda x: x["meta"]["date"], reverse=True)
		with open(file_path, "w") as f_out:
			for line in lines:
				f_out.write(json.dumps(line, ensure_ascii=False) + "\n")
		
		
		


# ## Temp Script to extract all the unproductive or irrelevant speeches into a different file

# In[ ]:


from params.paths import DATA_DIR
import os
import json
TARGET_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized_with_prd_and_rl")

for person_id in os.listdir(TARGET_DIR):
	person_dir = os.path.join(TARGET_DIR, person_id)
	unproductive_file = os.path.join(person_dir, "Unproductive.jsonl")
	unrelevant_file = os.path.join(person_dir, "Irrelevant.jsonl")
	found_unproductive = False
	found_unrelevant = False
	with open(unproductive_file, "w") as f_unproductive, open(unrelevant_file, "w") as f_unrelevant:
		all_speeches_file_path = os.path.join(person_dir, "all_speeches.jsonl")
		with open(all_speeches_file_path, "r") as f_all:
			for line in f_all:
				data = json.loads(line)
				if not "is_productive" in data:
					continue
				if data["is_productive"] == "False":
					f_unproductive.write(line)
					found_unproductive = True
				if data["is_relevant"] == "False":
					f_unrelevant.write(line)
					found_unrelevant = True
	if not found_unproductive and os.path.exists(unproductive_file):
		os.remove(unproductive_file)
	if not found_unrelevant and os.path.exists(unrelevant_file):
		os.remove(unrelevant_file)


# In[ ]:




