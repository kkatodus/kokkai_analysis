from data_process.string_processor import StringProcessor
from file_handling.file_read_writer import FileReadWriter
from api_requests.meeting_convo_collector import MeetingConvoCollector
from data_process.info_getter import InfoGetter
import os
from datetime import datetime, timedelta


def main():
    meeting_data_dir = "..\\data_sangiin\\"
    party_opinions_dir = os.path.join(meeting_data_dir,"party_opinions")
    if not os.path.exists(party_opinions_dir):
        os.makedirs(party_opinions_dir)
    frw = FileReadWriter()
    sp = StringProcessor()
    mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")
    ig = InfoGetter()

    num_meetings = 3
    meeting_json_files = [filename for filename in os.listdir(meeting_data_dir) if ".json" in filename]
    for idx, meeting_filename in enumerate(meeting_json_files):
        if idx == num_meetings:
            break
        sangiin_data_filepath = os.path.join(meeting_data_dir, meeting_filename)
        sangiin_meeting_dict = frw.read_json(sangiin_data_filepath)
        party_list = set(ig.get_list_of_parties(sangiin_meeting_dict))
      
        for topic_idx, topic_dict in enumerate(sangiin_meeting_dict["topics"]):
            topic_title = topic_dict["topic_title"]
            topic_date = topic_dict["topic_date"]
            topic_title_cleaned = sp.clean_topic_title(topic_title)
            topic_title_separated = sp.divide_string(topic_title_cleaned)
            topic_search_candidates = sp.create_search_words(topic_title_separated)
           
            topic_date_dt_obj = datetime.strptime(topic_date,"%Y年 %m月 %d日")
            start_date = topic_date_dt_obj - timedelta(2)
            end_date = topic_date_dt_obj + timedelta(2)
            start_date = start_date.strftime("%Y-%m-%d")
            end_date = end_date.strftime("%Y-%m-%d")
            for search_candidate in topic_search_candidates:
                conditions_list = [
                    f"from={start_date}",
                    f"until={end_date}",
                    "nameOfHouse=参議院",
                    f"any={search_candidate}",
                    "searchRange=本文",
                    "recordPacking=json"
                    ]
                search_requests = mcc.make_requests(conditions_list, party_opinions_dir)
                #if there are results coming back stop searching other candidates
                if not (len(search_requests) == 1 and search_requests[0]["numberOfRecords"] == 0):
                    break
            for idx, search_request in enumerate(search_requests):
                file_name = f"topic_idx={topic_idx}_start_from={idx}_{'_'.join(conditions_list)}.json"
                file_path = os.path.join(party_opinions_dir, topic_title_cleaned + ".json")
                #frw.write_json(search_request, file_path)
                party_opinions = ig.extract_party_opinions(search_request, party_list)
                frw.write_json(party_opinions, file_path)



if __name__ == "__main__":
    main()