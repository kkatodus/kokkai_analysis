import os
import json
import h5py
from datetime import datetime
import numpy as np
def read_json(path):
    if not os.path.exists(path):
       raise Exception("Target file does not exist", path)
    elif not path.endswith(".json"):
        raise Exception("File is not a json file")
    with open(path, "r", encoding="utf-8") as j:
        meeting_dict = json.load(j)
    return meeting_dict

def write_json(dict_obj:dict, path:str)->None:
    if not path.endswith(".json"):
        raise Exception("File is not a json file")
    with open(path, "w", encoding="utf-8") as j:
        json.dump(dict_obj, j, ensure_ascii=False, indent=4)

def create_dir(path):
    os.makedirs(path, exist_ok=True)

def write_file(path, string):
    with open(path, "w", encoding="utf-8") as f:
         f.write(string)

def read_hdf5_file(path:str)->dict:
    with h5py.File(path, 'r') as f:
        out_dict = {}
        for key in f.keys():
            value = f[key][()]
            # Check if the value is a NumPy array of bytes (indicating a stored string)
            if isinstance(value, np.ndarray) and value.dtype.kind in {'S', 'U'}:
                out_dict[key] = value.astype(str)  # Convert byte arrays to string
            elif isinstance(value, bytes):  # Single string case
                out_dict[key] = value.decode('utf-8')
            elif isinstance(value, np.ndarray) and value.dtype.kind == 'O':  # Array of strings
                out_dict[key] = [x.decode('utf-8') if isinstance(x, bytes) else x for x in value]
            else:
                out_dict[key] = value[:]  # Regular NumPy array
        return out_dict

def read_txt_file(path):
    with open(path, "r", encoding="utf-8") as f:
         return f.read().splitlines()

def is_file_stale(path, max_day_stale=1):
	if not os.path.exists(path):
		return True
	mod_time = os.path.getmtime(path)
	mod_time = datetime.fromtimestamp(mod_time)
	delta = datetime.now() - mod_time
	return int(delta.days) >= max_day_stale


def get_newest_file(dir):
	most_recent_file = None
	most_recent_time = 0
	for entry in os.scandir(dir):
		if entry.is_file:
			mod_time = entry.stat().st_mtime
			if mod_time > most_recent_time:
				most_recent_time = mod_time
				most_recent_file = entry.name
	return most_recent_file

def get_newest_dir(dir):
	most_recent_dir = None
	most_recent_time = 0
	for entry in os.scandir(dir):
		if entry.is_dir:
			mod_time = entry.stat().st_mtime
			if mod_time > most_recent_time:
				most_recent_time = mod_time
				most_recent_dir = entry.name
	return most_recent_dir
	