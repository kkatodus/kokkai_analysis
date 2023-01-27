
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from file_handling.file_read_writer import FileReadWriter
import os
import time
output_dir = "C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\data_sangiin"
chromedriver_path = "C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\chromedriver.exe"
main_website_url = "https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html"
FileReadWriter.create_dir(output_dir)

skip_first_n_meetings = len([file_name for file_name in os.listdir(output_dir) if ".json" in file_name])

#necessary xpath
meeting_period_xpath = "//font[contains(text(), '年')]"
topic_xpath = "//tr//td//p//tt//font//a"
topic_dates_xpath = "//tbody//tr//td//div//p//tt//font"
whole_result_xpath = "//font//b"
party_vote_xpath = "//caption[@class='party']/following-sibling::tbody"
party_names_xpath = "//caption[@class='party']"
whole_result_num_xpath = "//*[contains(text(), '投票総数')]"


meeting_layout = {
    "period":"",
    "num_topics":None,
    "topics":[]
}

topic_layout = {
            "topic_title":"",
            "topic_date":"",
            "individual_voting_results":None,
            "whole_result":"",
            "voting_results":[]
            }

party_vote_results_layout = {
    "party_name":"",
    "member_num":None, 
    "yay":None,
    "nay":None,
    "votes":[]
}

def create_meeting_dict_or_load_json(filename):
    meeting_json_path = os.path.join(output_dir, filename)
    if os.path.exists(meeting_json_path):
        meeting_dict = json.load(meeting_json_path)
    else:
        meeting_dict = meeting_layout.copy()
    return meeting_dict

def save_json(dict_obj, path):
    with open(path, "w", encoding="utf-8") as j:
        json.dump(dict_obj, j, ensure_ascii=False, indent=4)

def collect_whole_party_vote(party_caption, party_dict):
    party_vote_numbers = party_caption.text.split("\n")[2]
    party_vote_numbers = party_vote_numbers.split("　　　")
    
    keys = ["yay", "nay"]
    #getting results of whole party vote
    for vote, key in zip(party_vote_numbers, keys):
        vote_num = vote.split(" ")
        vote_num = [num for num in vote_num if num != ""]
        vote_num = vote_num[1]
        party_dict[key] = int(vote_num)
    #extracting party name and member number
    party_name_and_mem_num = party_caption.text.split("\n")[0]
    repl_chars = "(名)"
    for repl_char in repl_chars:
        party_name_and_mem_num = party_name_and_mem_num.replace(repl_char, ",")
    party_name_and_mem_num = party_name_and_mem_num.split(",")
    party_name = party_name_and_mem_num[0]
    party_mem_num = int(party_name_and_mem_num[1])
    party_dict["member_num"] = party_mem_num
    return party_dict, party_name

def collect_individual_party_vote(party_vote_tbody_dom):
    party_vote_tr_doms = party_vote_tbody_dom.find_elements(By.TAG_NAME, "tr")
    #print(len(party_vote_tr_doms))
    votes = {}
    for party_vote_tr_dom in party_vote_tr_doms[1:len(party_vote_tr_doms)-1]:
        party_vote_pros = party_vote_tr_dom.find_elements(By.CLASS_NAME, "pro")
        party_vote_cons = party_vote_tr_dom.find_elements(By.CLASS_NAME, "con")
        party_vote_nams = party_vote_tr_dom.find_elements(By.TAG_NAME, "tt")
        # print(len(party_vote_pros))
        # print(len(party_vote_cons))
        # print(len(party_vote_nams))
        for pro, con, nam in zip(party_vote_pros, party_vote_cons, party_vote_nams):
            vote = ""
            try:
                pro.find_element(By.TAG_NAME, "img")
                vote = "yay"
            except:
                try:
                    con.find_element(By.TAG_NAME, "img")
                    vote = "nay"
                except:
                    vote = "abstain"
            name_str = nam.text
            # print(name_str)
            name_str = name_str.replace("\u3000", "")
            name_str = name_str.replace(" ", "")
            if name_str != "":
                votes[name_str] = vote
    return votes

def collect_individual_votes():
    whole_result = driver.find_element(By.XPATH, whole_result_num_xpath)
    whole_result = whole_result.text.split("　　　")
    whole_result_dict = {}

    one_topic_dict = {
        "topic_title":"",
        "topic_date":"",
        "individual_voting_results":None,
        "whole_result":"",
        "voting_results":[]
    }
    #getting the entire voting result of the house
    keys = ["total_votes", "yay", "nay"]
    for key, result in zip(keys, whole_result):
        result = int(result.split("　")[1])
        whole_result_dict[key] = result
    party_names = driver.find_elements(By.XPATH, party_names_xpath)
    party_votes = driver.find_elements(By.XPATH, party_vote_xpath)
    party_voting_array = []
    #collecting individual voting results for each party
    for party_name, party_vote_tbody_dom in zip(party_names, party_votes):
        party_dict = {
            "party_name":"",
            "member_num":None, 
            "yay":None,
            "nay":None,
            "votes":[]
            }
        party_dict, party_name = collect_whole_party_vote(party_name, party_dict)
        party_dict["party_name"] = party_name
        votes = collect_individual_party_vote(party_vote_tbody_dom)
        party_dict["votes"] = votes.copy()
        party_voting_array.append(party_dict)
    one_topic_dict["voting_results"] = party_voting_array

    one_topic_dict["whole_result"] = whole_result_dict.copy()
    return one_topic_dict

def collect_whole_result():
    topic_dict = topic_layout.copy()
    whole_result = driver.find_element(By.XPATH, whole_result_xpath).text
    topic_dict["whole_result"] = whole_result
    topic_dict["voting_results"] = None
    return topic_dict

def check_for_individual_votes():
    try:
        _ = driver.find_element(By.CLASS_NAME, "party")
        return True
    except:
        return False

def iterate_topics(meeting_dict):
    topic_links = driver.find_elements(By.XPATH, topic_xpath)
    topic_urls = [topic_link.get_attribute("href") for topic_link in topic_links]
    topic_names = [topic_link.text for topic_link in topic_links]
    meeting_dict["num_topics"] = len(topic_urls)
    first_topic = None
    for topic_name, topic_url in zip(topic_names, topic_urls):
        if len(meeting_dict["topics"]) > 0:
            first_topic = meeting_dict["topics"][0]
        driver.get(topic_url)
        individual_votes = check_for_individual_votes()

        if individual_votes:
            topic_dict = collect_individual_votes()
            topic_dict["individual_voting_results"] = True
            print("individual")
        else:
            topic_dict = collect_whole_result()
            topic_dict["individual_voting_results"] = False

        topic_dict["topic_title"] = topic_name
        topic_date_str = driver.find_element(By.XPATH, topic_dates_xpath).text
        topic_date_str = topic_date_str.split("\n")[1]
        topic_dict["topic_date"] = topic_date_str
        
        meeting_dict["topics"].append(topic_dict)
    return meeting_dict

def iterate_meetings():
    global driver
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    #prepping chromedriver
    service = Service(executable_path=chromedriver_path)
    driver = webdriver.Chrome(service=service)
    driver.get(main_website_url)
    #get links to the different meetings
    meeting_links = []
    meeting_types = ["常会","臨時会"]
    for meeting_type in meeting_types:
        one_meeting_links = driver.find_elements(By.PARTIAL_LINK_TEXT, meeting_type)
        meeting_links += one_meeting_links
    meeting_names = [meeting_link.text for meeting_link in meeting_links][skip_first_n_meetings:]
    meeting_urls = [meeting_link.get_attribute("href") for meeting_link in meeting_links][skip_first_n_meetings:]
    for meeting_name, meeting_url in zip(meeting_names, meeting_urls):
        #jump to meeting page
        driver.get(meeting_url)
        meeting_dates = driver.find_elements(By.XPATH, meeting_period_xpath)
        meeting_start = meeting_dates[-1].text
        meeting_end = meeting_dates[0].text
        meeting_period = meeting_start + "~" + meeting_end
        #create dict or load from pre-existing json file
        meeting_dict = create_meeting_dict_or_load_json(meeting_name)
        meeting_dict["period"] = meeting_period
        meeting_dict["topics"] = []
        meeting_dict = iterate_topics(meeting_dict)
        meeting_file_name = f"{meeting_name}.json"
        meeting_path = os.path.join(output_dir, meeting_file_name)
        print("Saving Json")
        save_json(meeting_dict, meeting_path)

    
if __name__ == "__main__":
    iterate_meetings()