import os
from params.paths import ROOT_DIR
import json
from collections import Counter, defaultdict

data_dir = os.path.join(ROOT_DIR, "data", "data_all_speeches")
speech_id_counter = defaultdict(int)
counter = 0
for dir_name in os.listdir(data_dir):
    speech_file_path = os.path.join(data_dir, dir_name, "speeches.jsonl")
    with open(speech_file_path) as f:
        for line in f.readlines():
            line_json = json.loads(line)
            speech_id_counter[line_json["speechID"]] += 1
            counter += 1
print("Counter", speech_id_counter)
print("total number of speeches", counter)
