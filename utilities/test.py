import json
import os

year = 2020
data_dir_path = f"C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\data\\{year}\\"

file_list = sorted(os.listdir(data_dir_path), key=lambda x:x.split("_")[0])
first_file_name = file_list[0]
print("First_file", first_file_name)
first_file_path = f"{data_dir_path}{first_file_name}"
with open(first_file_path, "r", encoding = "utf-8") as f:
    first_file_json = json.load(f)
    meeting_content_summary = first_file_json["meetingRecord"][0]["speechRecord"][0]["speech"].split("\r\n")
    meeting_content_summary = [content.replace("\u3000","") for content in meeting_content_summary]
    print(meeting_content_summary)