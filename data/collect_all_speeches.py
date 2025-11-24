#!/usr/bin/env python
# coding: utf-8

# In[1]:


from __future__ import annotations
import os
import re
import logging
from datetime import datetime, timedelta
import time
from tqdm import tqdm
import pandas as pd
from dataclasses import dataclass, fields, is_dataclass
from typing import Any, Dict, List, Tuple, get_args, get_origin, Union
import json

from params.paths import ROOT_DIR
from api_requests.meeting_convo_collector import MeetingConvoCollector
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file


OUTPUT_DIR = os.path.join(ROOT_DIR, 'data', 'data_all_speeches')
LOGDIR = os.path.join(ROOT_DIR, 'logs')

create_dir(OUTPUT_DIR)


# In[2]:


from pydantic import BaseModel

@dataclass(frozen=True)
class SpeechRecord(BaseModel):
	speaker: str
	speech: str
	speechID: str
	speechOrder: int
	speakerYomi: str
	speakerGroup: str
	speakerPosition: str
	speakerRole: str
	speechURL: str
	startPage: int
	createTime: str
	updateTime: str
	issueID: str

@dataclass(frozen=True)
class MeetingRecord(BaseModel):
	issueID:str
	imageKind: str
	searchObject: int
	session: int
	meetingURL:str
	nameOfHouse: str
	nameOfMeeting: str
	issue: str
	date: str
	closing: str
	speechRecord: List[SpeechRecord]
	pdfURL:str

@dataclass(frozen=True)
class SpeechFetchedResponse(BaseModel):
	numberOfRecords:int
	numberOfReturn: int
	startRecord: int
	nextRecordPosition: int
	speechRecord: List[SpeechRecord]

@dataclass(frozen=True)
class FetchedResponse(BaseModel):
	numberOfRecords:int
	numberOfReturn: int
	startRecord: int
	nextRecordPosition: int
	meetingRecord: List[MeetingRecord]


# In[4]:


from dotenv import load_dotenv
import shutil
load_dotenv()
from dbio.representative_db import connect_db, iterate_all_persons, get_election_result_by_person_id



# --- Generic recursive constructor ---

def from_dict(cls, data):
    if data is None:
        return None

    if is_dataclass(cls):
        kwargs = {}
        for f in fields(cls):
            raw = data.get(f.name, None)
            kwargs[f.name] = _convert_value_with_defaults(f.type, raw)
        return cls(**kwargs)

    origin = get_origin(cls)
    if origin in (list, List):
        (elem_type,) = get_args(cls)
        # --- KEY FIX: accept dict-as-singleton for one-or-many APIs ---
        if data is None:
            return []
        if isinstance(data, dict):
            data = [data]
        return [ _convert_value_with_defaults(elem_type, x) for x in data ]

    return _cast_primitive(cls, data)

def _convert_value_with_defaults(tp, val):
    origin = get_origin(tp)

    if origin is Union:  # Optional[T] etc.
        args = [a for a in get_args(tp) if a is not type(None)]
        if val is None:
            return None
        return _convert_value_with_defaults(args[0], val)

    if is_dataclass(tp):
        return from_dict(tp, val or {})

    if origin in (list, List):
        (elem_type,) = get_args(tp)
        if val is None:
            return []
        # --- SAME FIX applied here too for nested lists like speechRecord ---
        if isinstance(val, dict):
            val = [val]
        return [ _convert_value_with_defaults(elem_type, x) for x in val ]

    return _cast_primitive(tp, val)

def _cast_primitive(tp, val):
    if val is None:
        return None
    if tp in (int, float, str, bool):
        try:
            return tp(val)
        except Exception:
            return val
    return val

mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/meeting?")
speechcollector = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")


starting_point = 1
fetch_num_per_request = 10


def get_and_save_issue(issues:List[str]) -> None:
	for iss in issues:
		issue_dir = os.path.join(OUTPUT_DIR, iss)
		if os.path.exists(issue_dir):
			if os.path.exists(os.path.join(issue_dir, 'meta.json')):
				meta_json = read_json(os.path.join(issue_dir, 'meta.json'))
				if meta_json['issueID'] != iss:
					# delete = input(f"Delete directory? {issueID}(y/n)")
					# if delete== "y":
					print("DELETING", os.path.join(OUTPUT_DIR, iss))
					shutil.rmtree(os.path.join(OUTPUT_DIR, iss))
				else:
					print("SKIPPING", iss)
					continue

		os.makedirs(issue_dir, exist_ok=True)
		cons = [
			f"any=''",
			f"recordPacking=json",
			f"issueID={iss}",
			f"maximumRecords={fetch_num_per_request}"
		]
		response, next_position = mcc.make_one_request(cons, 1)
		response = from_dict(FetchedResponse, response)
		meetingRecords = response.meetingRecord
		for mr in meetingRecords:
			mr = MeetingRecord(**mr)
			if mr.issueID != iss:
				raise Exception("What")
			issueID = mr.issueID
			imageKind = mr.imageKind
			searchObject = mr.searchObject
			session = mr.session
			nameOfHouse = mr.nameOfHouse
			nameOfMeeting = mr.nameOfMeeting
			issue = mr.issue
			date = mr.date
			closing = mr.closing
			pdfURL = mr.pdfURL
			print("SAVING ISSUE", issueID)

			with open(os.path.join(issue_dir, f"meta.json"), "w", encoding="utf-8") as f:
				json.dump({
					"issueID": issueID,
					"imageKind": imageKind,
					"searchObject": searchObject,
					"session": session,
					"nameOfHouse": nameOfHouse,
					"nameOfMeeting": nameOfMeeting,
					"issue": issue,
					"date": date,
					"closing": closing,
					"pdfURL": pdfURL,
					"nextRecordPosition": next_position
				}, f, ensure_ascii=False, indent=4)

			with open(os.path.join(issue_dir, f"speeches.jsonl"), "w", encoding="utf-8") as f:
				for speech in mr.speechRecord:
					json.dump(speech, f, ensure_ascii=False)
					f.write("\n")


def get_issues_from_speaker_name_and_save(name: str) -> List[str]:
	cons = [
		f"any=''",
		# f"nameOfHouse=衆議院",
		f"speaker={name}",
		f"recordPacking=json",
		f"maximumRecords=30"
	]
	next_position = 1
	while True:
		if next_position is None:
			break
		response, next_position  = speechcollector.make_one_request(cons, next_position)
		response = from_dict(SpeechFetchedResponse, response)
		speech_records = [from_dict(SpeechRecord, sr) for sr in response.speechRecord]
		issues = set([sr.issueID for sr in speech_records])
		get_and_save_issue(issues)
		time.sleep(5)
		



GET_ISSUE_ID_FROM_SPEECH_URL_FIRST = True
CUT_OFF_YEAR = 2000


if GET_ISSUE_ID_FROM_SPEECH_URL_FIRST:
	conn = connect_db(
		dbname="kokkaidoc",
		user="postgres",
		password=os.getenv("PSQL_DATABASE_PASSWORD"),
		host="localhost",
		port="5432"
	)

	logfile_path = os.path.join(LOGDIR, "speech_progress.txt")
	with open(logfile_path) as f:
		lines = f.readlines()
		last_name = lines[-1]
		last_name = last_name.strip()
		print("LAST NAME:", last_name)
	with conn.cursor() as cur:
		catched_up = False
		for person in iterate_all_persons(cur):

			if not catched_up and person.name_kanji != last_name:
				print("SKIPPING PERSON", person)
				continue
			if person.name_kanji == last_name:
				print("CAUGHT UP AT PERSON", person)
				catched_up = True
				continue
			
			count = 0
			while True:
				try:
				
					print("WORKING ON PERSON", person)
					name = person.name_kanji
					get_issues_from_speaker_name_and_save(name)
					with open(logfile_path, "a", encoding="utf-8") as f:
						f.write(f"{person.name_kanji}\n")
					break
				except Exception as e:
					time.sleep(10)
					count += 1
					print(e)
					if count > 3:
						
						break
					print("RETRYING")

			







# In[ ]:




