from file_handling.file_read_writer import FileReadWriter
import os
target_dir = "C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\data_sangiin\\"
combined_meetings_json = {}
output_dir = "C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\api\\data"
output_file_name = "sangiin_meeting_vote_results.json"
output_file_path = os.path.join(output_dir, output_file_name)
if not os.path.exists(output_dir):
    os.makedirs(output_dir)
frw = FileReadWriter()

for filename in os.listdir(target_dir):
    if not "json" in filename:
        continue
    meeting_name = filename.split(".")[0]
    target_file_path = os.path.join(target_dir, filename)
    target_file_json = frw.read_json(target_file_path)
    target_file_json["meeting_name"] = meeting_name
    combined_meetings_json[meeting_name] = target_file_json
frw.write_json(combined_meetings_json, output_file_path)