#!/usr/bin/env python
# coding: utf-8

# In[3]:


from dotenv import load_dotenv
import os
from typing import Iterator
import json
from dbio.representative_db import create_tables_if_not_exist, connect_db, get_person_by_column, insert_speeches_bulk, Speech, get_speech_by_column, get_all_data_for_column_for_table
from params.paths import ROOT_DIR

speeches_dir = os.path.join(ROOT_DIR, "data", "data_all_speeches")

load_dotenv()


# In[4]:


def iterate_speeches(speeches_jsonl_path: str, meta_data_json_path: str) -> Iterator[dict]:
	with open(speeches_jsonl_path, "r") as f:
		speeches = []
		for line in f:
			speech = json.loads(line)
			speeches.append(speech)
	return speeches

def read_meta_data(meta_data_json_path: str) -> dict:
	with open(meta_data_json_path, "r") as f:
		return json.load(f)

conn = connect_db(
	dbname="kokkaidoc",
	user="postgres",
	password=os.getenv("PSQL_DATABASE_PASSWORD"),
	host="localhost",
	port="5432",
)
with conn.cursor() as cur:
	create_tables_if_not_exist(cur)
	conn.commit()



# In[ ]:


conn = None
try:
    conn = connect_db(
        dbname="kokkaidoc",
        user="postgres",
        password=os.getenv("PSQL_DATABASE_PASSWORD"),
        host="localhost",
        port="5432",
    )
    print("Connected.")

    with conn.cursor() as cur:
        already_retrieved_speeches = set(get_all_data_for_column_for_table(cur, "speech_id", "speeches"))
        print("Already retrieved speeches: ", len(already_retrieved_speeches))
        for folder_name in os.listdir(speeches_dir):
            folder_path = os.path.join(speeches_dir, folder_name)
            speeches_jsonl_path = os.path.join(folder_path, "speeches.jsonl")
            meta_data_json_path = os.path.join(folder_path, "meta.json")
            if not os.path.isdir(folder_path):
                continue
            speeches = iterate_speeches(speeches_jsonl_path, meta_data_json_path)
            meta_data = read_meta_data(meta_data_json_path)
            persons = []
            for speech in speeches:
                if speech["speaker"] == "会議録情報":
                    continue
                if speech["speechID"] in already_retrieved_speeches:
                    continue
                
                persons_retrieved = get_person_by_column(cur, "name_kanji", speech["speaker"])
                if not persons_retrieved or len(persons_retrieved) > 1:
                    persons.append(None)
                else:
                    persons.append(persons_retrieved[0])
            print(persons)
            #prepare insert speeches
            speeches_to_insert = []
            for speech, person in zip(speeches, persons):
                if person is None:
                    continue
                speeches_to_insert.append(Speech(
                    issue_id=meta_data["issueID"],
                    name_of_house=meta_data["nameOfHouse"],
                    name_of_meeting=meta_data["nameOfMeeting"],
                    date=meta_data["date"],
                    pdf_url=meta_data["pdfURL"],
                    speech_id=speech["speechID"],
                    speaker=speech["speaker"],
                    speech=speech["speech"],
                    speech_url=speech["speechURL"],
                    person_id=person.person_id
                ))
            if len(speeches_to_insert) > 0:
                insert_speeches_bulk(cur, speeches_to_insert)
            conn.commit()
            already_retrieved_speeches.update([s.speech_id for s in speeches_to_insert])
                

except Exception as e:
    if conn:
        conn.rollback()
    raise
finally:
    if conn:
        conn.close()


# In[ ]:




