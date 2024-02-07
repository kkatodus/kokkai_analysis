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

def read_hdf5_file(path):
    
    with h5py.File(path, 'r') as f:
        out_dict = {}
        for key in f.keys():
            value = f[key][:]
            out_dict[key] = value
        return out_dict
    
def read_txt_file(path):
    with open(path, "r", encoding="utf-8") as f:
         return f.read().splitlines()