import os
from params.paths import ROOT_DIR
from file_handling.file_read_writer import read_json, write_json, create_dir
import matplotlib.pyplot as plt

## PATHS
UPPER_OUTPUT_DIR = os.path.join(ROOT_DIR, "data_prepping","data_sangiin")

UPPER_VOTING_RESULTS_DIR = os.path.join(UPPER_OUTPUT_DIR, "voting_results")

def measure_upper_intra_party_dissension():
    upper_voting_files = os.listdir(UPPER_VOTING_RESULTS_DIR)
    dissension_record_dict = {}
    for voting_file in upper_voting_files:
        voting_filepath = os.path.join(UPPER_VOTING_RESULTS_DIR, voting_file)
        voting_dict = read_json(voting_filepath)
        party_dissensions_for_file = {}
        for topic in voting_dict["topics"]:
            if not topic['individual_voting_results']:
                continue
            for party_vote in topic["voting_results"]:
                party_name = party_vote["party_name"]
                yay_vote = party_vote["yay"]
                nay_vote = party_vote["nay"]
                total_member_num = party_vote["member_num"]
                is_party_dissension = not (yay_vote == total_member_num or nay_vote == total_member_num)
                if party_name not in party_dissensions_for_file.keys():
                    party_dissensions_for_file[party_name] = {'dissension':0, 'total':0}
                if is_party_dissension:
                    party_dissensions_for_file[party_name]['dissension'] += 1
                party_dissensions_for_file[party_name]['total'] += 1
        dissension_record_dict[voting_file] = party_dissensions_for_file
    write_json(dissension_record_dict, os.path.join(UPPER_OUTPUT_DIR, "dissension_record.json"))

def graph_dissension_record():
    dissension_record_path = os.path.join(UPPER_OUTPUT_DIR, "dissension_record.json")
    dissension_record_dict = read_json(dissension_record_path)
    dissension_list = {}
    for meeting_file in dissension_record_dict.keys():
        meeting_dict = dissension_record_dict[meeting_file]
        for party_name in meeting_dict.keys():
            if not "自由民主党" in party_name:
                continue
            if party_name not in dissension_list.keys():
                dissension_list[party_name] = []
            party_dict = meeting_dict[party_name]
            total = party_dict['total']
            dissension = party_dict['dissension']
            dissension_rate = dissension / total
            dissension_list[party_name].append(dissension_rate)
    plt.plot(dissension_list["自由民主党"])
    plt.show()

def main():
    measure_upper_intra_party_dissension()
    graph_dissension_record()

if __name__ == "__main__":
    main()
