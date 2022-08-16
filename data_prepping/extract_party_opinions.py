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
        meeting_name = meeting_filename[:meeting_filename.index(".")]
        if idx == num_meetings:
            break
        meeting_party_opinion_dict = {} 
        sangiin_data_filepath = os.path.join(meeting_data_dir, meeting_filename)
        sangiin_meeting_dict = frw.read_json(sangiin_data_filepath)
        party_list = set(ig.get_list_of_parties(sangiin_meeting_dict))
      
        for topic_idx, topic_dict in enumerate(sangiin_meeting_dict["topics"]):
            topic_title = topic_dict["topic_title"]
            topic_date = topic_dict["topic_date"]
            topic_title_cleaned = sp.clean_topic_title(topic_title)
            topic_title_separated = sp.divide_string(topic_title_cleaned)
            topic_search_candidates = sp.create_search_words(topic_title_separated, topic_title_cleaned)
            topic_search_candidates = topic_search_candidates[:int(len(topic_search_candidates)/2)]
           
            topic_date_dt_obj = datetime.strptime(topic_date,"%Y年 %m月 %d日")
            start_date = topic_date_dt_obj - timedelta(2)
            end_date = topic_date_dt_obj + timedelta(2)
            start_date = start_date.strftime("%Y-%m-%d")
            end_date = end_date.strftime("%Y-%m-%d")
            topic_party_opinions_dict = {}
            for search_candidate_idx, search_candidate in enumerate(topic_search_candidates):
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
                for idx, search_request in enumerate(search_requests):
                    party_opinions = ig.extract_party_opinions(search_request, party_list)
                    topic_party_opinions_dict.update(party_opinions)
                if topic_party_opinions_dict != {}:
                    break
            meeting_party_opinion_dict[f"{meeting_name}_{topic_title}"] = topic_party_opinions_dict

            file_path = os.path.join(party_opinions_dir, meeting_filename)
            frw.write_json(meeting_party_opinion_dict, file_path)

if __name__ == "__main__":
    main()