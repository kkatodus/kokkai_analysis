
class InfoGetter:

    def __init__(self):
        pass

    def get_list_of_parties(self, meeting_dict):
        topic_list = meeting_dict["topics"]
        for topic in topic_list:
            if topic["individual_voting_results"]:
                party_info_topic = topic
                break
        parties = list(party_info_topic["voting_results"].keys())
        parties_ret = []
        for party_name in parties:
            party_name_sp = party_name.split("・")
            parties_ret += party_name_sp
        return parties_ret

    def extract_party_opinions(self, meeting_speech_dict, party_list):
        party_opinions_dict = {}
        if "speechRecord" in meeting_speech_dict.keys():
            for speech_dict in meeting_speech_dict["speechRecord"]:
                speech_str = speech_dict["speech"]
                for party_name in party_list:
                    if party_name in speech_str and len(speech_str) > 50 and "代表" in speech_str:
                        party_opinions_dict[party_name] = speech_dict                 
            return party_opinions_dict
        else:
            return {}
        
