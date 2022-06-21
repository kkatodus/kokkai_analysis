
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
import os
import re
output_dir = "..\\data_sangiin\\"
chromedriver_path = "..\\chromedriver.exe"
main_website_url = "https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html"


#necessary xpath
meeting_period_xpath = "//font[contains(text(), '年')]"
topic_xpath = "//tr//td//p//tt//font//a"
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
            "individual_voting_results":None,
            "whole_result":"",
            "voting_results":{}
            }

party_vote_results_layout = {
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

def collect_individual_votes(one_topic_dict):
    whole_result = driver.find_element(By.XPATH, whole_result_num_xpath)
    whole_result = whole_result.text.split("　　　")
    whole_result_dict = {}

    #getting the entire voting result of the house
    keys = ["total_votes", "yay", "nay"]
    for key, result in zip(keys, whole_result):
        result = int(result.split("　")[1])
        whole_result_dict[key] = result
    party_names = driver.find_elements(By.XPATH, party_names_xpath)
    party_votes = driver.find_elements(By.XPATH, party_vote_xpath)

    #collecting individual voting results for each party
    for party_name, party_vote in zip(party_names, party_votes):
        party_dict = party_vote_results_layout.copy()
        party_dict, party_name = collect_whole_party_vote(party_name, party_dict)
        one_topic_dict["voting_results"][party_name] = party_dict

    one_topic_dict["whole_result"] = whole_result_dict
    return one_topic_dict

def collect_whole_result(topic_dict):
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
    for topic_name, topic_url in zip(topic_names, topic_urls):
        driver.get(topic_url)
        individual_votes = check_for_individual_votes()

        topic_dict = topic_layout.copy()
        topic_dict["topic_title"] = topic_name
        
        if individual_votes:
            topic_dict["individual_voting_results"] = True
            topic_dict = collect_individual_votes(topic_dict)
        else:
            topic_dict["individual_voting_results"] = False
            topic_dict = collect_whole_result(topic_dict)

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
    meeting_links = driver.find_elements(By.PARTIAL_LINK_TEXT, "常会")
    meeting_names = [meeting_link.text for meeting_link in meeting_links]
    meeting_urls = [meeting_link.get_attribute("href") for meeting_link in meeting_links]
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
        meeting_dict = iterate_topics(meeting_dict)
        meeting_file_name = f"{meeting_name}.json"
        meeting_path = os.path.join(output_dir, meeting_file_name)
        print("Saving Json")
        save_json(meeting_dict, meeting_path)

    
if __name__ == "__main__":
    iterate_meetings()