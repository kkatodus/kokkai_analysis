import os
import json

def read_json(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as j:
            meeting_dict = json.load(j)
    else:
        raise Exception("Target file does not exist")
    return meeting_dict

def write_json(dict_obj, path):
    with open(path, "w", encoding="utf-8") as j:
        json.dump(dict_obj, j, ensure_ascii=False, indent=4)

def create_dir(path):
    os.makedirs(path, exist_ok=True)

def write_file(path, string):
    with open(path, "w", encoding="utf-8") as f:
         f.write(string)

    