import os
import json

class FileReadWriter:
    def __init__(self):
        pass

    def read_json(self, path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as j:
                meeting_dict = json.load(j)
        else:
            raise Exception("Target file does not exist")
        return meeting_dict

    def write_json(self, dict_obj, path):
        with open(path, "w", encoding="utf-8") as j:
            json.dump(dict_obj, j, ensure_ascii=False, indent=4)


    