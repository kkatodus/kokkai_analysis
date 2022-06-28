
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
        
