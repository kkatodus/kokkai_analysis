#!/usr/bin/env python
# coding: utf-8

# In[17]:


import os
from google.cloud import bigquery
from params.paths import DATA_DIR


ORGANIZED_SPEECHES_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
PROJECT_ID = "idea-a"
TABLE_ID = "jpdiet.diet-speech"
client = bigquery.Client()


# In[18]:


import datetime
import json
import os
import tempfile

for person_id in os.listdir(ORGANIZED_SPEECHES_DIR):
	repr_dir = os.path.join(ORGANIZED_SPEECHES_DIR, person_id)
	all_speeches_path = os.path.join(repr_dir, "all_speeches.jsonl")


	# Add whatever extra fields you want on every JSON object.
	# Example: stamp when this load happened and where it came from.
	extra_fields = {
		"source_path": all_speeches_path,
		"person_id": person_id,
	}

	tmp_path = None
	try:
		with open(all_speeches_path, "r", encoding="utf-8") as src, tempfile.NamedTemporaryFile(
			mode="w", encoding="utf-8", suffix=".jsonl", delete=False
		) as tmp:
			tmp_path = tmp.name
			for line in src:
				line = line.strip()
				if not line:
					continue
				obj = json.loads(line)
				obj['meta']['nextRecordPosition'] = 0
				obj.update(extra_fields)
				tmp.write(json.dumps(obj, ensure_ascii=False) + "\n")

		job_config = bigquery.LoadJobConfig(
			source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
			write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
			ignore_unknown_values=True,
			# Needed if your destination table doesn't already have these columns.
			schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION],
			schema=[
				bigquery.SchemaField("ingested_at", "DATETIME", mode="NULLABLE"),
				bigquery.SchemaField("source_path", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("person_id", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speechID", "STRING", mode="REQUIRED"),
				bigquery.SchemaField("speechOrder", "INT64", mode="NULLABLE"),
				bigquery.SchemaField("speaker", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speakerYomi", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speakerGroup", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speakerPosition", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speakerRole", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("speech", "STRING", mode="NULLABLE"),
				bigquery.SchemaField("startPage", "INT64", mode="NULLABLE"),
				bigquery.SchemaField("createTime", "DATETIME", mode="NULLABLE"),  # "2019-09-05 05:23:55"
				bigquery.SchemaField("updateTime", "DATETIME", mode="NULLABLE"),
				bigquery.SchemaField("speechURL", "STRING", mode="NULLABLE"),
				bigquery.SchemaField(
					"meta",
					"RECORD",
					mode="NULLABLE",
					fields=[
						bigquery.SchemaField("issueID", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("imageKind", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("searchObject", "INT64", mode="NULLABLE"),
						bigquery.SchemaField("session", "INT64", mode="NULLABLE"),
						bigquery.SchemaField("nameOfHouse", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("nameOfMeeting", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("issue", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("date", "DATE", mode="NULLABLE"),  # "1981-04-15"
						bigquery.SchemaField("closing", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("pdfURL", "STRING", mode="NULLABLE"),
						bigquery.SchemaField("nextRecordPosition", "INT64", mode="NULLABLE"),
        			],
    			),
				

			]
			
		)

		with open(tmp_path, "rb") as f:
			job = client.load_table_from_file(f, TABLE_ID, job_config=job_config)
			job.result()

		print("Appended all speeches to BigQuery")
		print(f"Job ID: {job.job_id}")
		print(f"Table ID: {TABLE_ID}")
		print(f"Number of speeches: {job.output_rows}")
	finally:
		if tmp_path and os.path.exists(tmp_path):
			os.remove(tmp_path)


# In[ ]:




