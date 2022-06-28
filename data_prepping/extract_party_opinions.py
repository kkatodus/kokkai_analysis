from data_process.string_processor import StringProcessor
from file_handling.file_read_writer import FileReadWriter
from api_requests.meeting_convo_collector import MeetingConvoCollector
import os


def main():
    meeting_data_dir = "..\\data_sangiin"

    frw = FileReadWriter()
    sp = StringProcessor()
    mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")

    num_meetings = 3
    for idx, meeting_filename in enumerate(os.listdir(meeting_data_dir)):
        if idx == num_meetings:
            break
        sangiin_data_filepath = os.path.join(meeting_data_dir, meeting_filename)
        sangiin_meeting_dict = frw.read_json(sangiin_data_filepath)
        print(sangiin_data_filepath)
        print(f"Number of topics: {len(sangiin_meeting_dict['topics'])}")
        for topic_dict in sangiin_meeting_dict["topics"]:
            topic_title = topic_dict["topic_title"]
            topic_date = topic_dict["topic_date"]
            topic_title_cleaned = sp.clean_topic_title(topic_title)
            #print(topic_title_cleaned)
            #print(topic_date)

    

if __name__ == "__main__":
    main()