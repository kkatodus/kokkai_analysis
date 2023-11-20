import os
import json
import h5py
import numpy as np
def read_json(path):
    if not os.path.exists(path):
       raise Exception("Target file does not exist")
    elif not path.endswith(".json"):
        raise Exception("File is not a json file")
    with open(path, "r", encoding="utf-8") as j:
        meeting_dict = json.load(j)
    return meeting_dict

def write_json(dict_obj, path):
    if not path.endswith(".json"):
        raise Exception("File is not a json file")
    with open(path, "w", encoding="utf-8") as j:
        json.dump(dict_obj, j, ensure_ascii=False, indent=4)

def create_dir(path):
    os.makedirs(path, exist_ok=True)

def write_file(path, string):
    with open(path, "w", encoding="utf-8") as f:
         f.write(string)
