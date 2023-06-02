import os
import re
from selenium.common.exceptions import NoSuchElementException
from api_requests.meeting_convo_collector import MeetingConvoCollector
from params.paths import ROOT_DIR
from scrape.general_scraper import GeneralScraper
from selenium.webdriver.common.by import By
from file_handling.file_read_writer import read_json, write_json, create_dir

## URLS
GIJI_URL = "https://kokkai.ndl.go.jp/api/speech?"

UPPER_REPR_LIST_URL = "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/211/giin.htm"
LOWER_REPR_LIST_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm"

UPPER_MEETING_INFO_PAGE_URL = "https://www.sangiin.go.jp/japanese/kon_kokkaijyoho/index.html"
LOWER_MEETING_INFO_PAGE_URL = "https://www.shugiin.go.jp/internet/itdb_iinkai.nsf/html/iinkai/list.htm"


## PATHS
UPPER_OUTPUT_DIR = os.path.join(ROOT_DIR, "data_prepping","data_sangiin")
LOWER_OUTPUT_DIR = os.path.join(ROOT_DIR, "data_prepping","data_shugiin")

UPPER_SPEECH_OUTPUT_DIR = os.path.join(UPPER_OUTPUT_DIR, "speeches")
LOWER_SPEECH_OUTPUT_DIR = os.path.join(LOWER_OUTPUT_DIR, "speeches")

create_dir(UPPER_OUTPUT_DIR)
create_dir(LOWER_OUTPUT_DIR)
create_dir(UPPER_SPEECH_OUTPUT_DIR)
create_dir(LOWER_SPEECH_OUTPUT_DIR)

CHROME_DRIVER_PATH = os.path.join(ROOT_DIR, "chromedriver")

## PARAMS
SCRAPE_UPPER_REPR_LIST = False
SCRAPE_LOWER_REPR_LIST = False
SCRAPE_UPPER_MEETING_MEMBER_LIST = False

#LAYOUT
REPR_LIST_LAYOUT = {
    "meeting_period":"",
    "reprs":[]
}

## XPATHS
REPR_TABLE_ELEMENT_XPATH = "//td"

def scrape_upper_repr_list():
     # scraping the list of representatives in upper house
    gs.get_url(UPPER_REPR_LIST_URL) 
    table_elements = gs.get_site_components_by(By.XPATH, REPR_TABLE_ELEMENT_XPATH)
    #excluding hiragana links
    table_elements = table_elements[10:]
    #getting the different doms for different info
    name_doms = table_elements[0::6]
    name_links = [name.find_element(By.TAG_NAME, 'a').get_attribute("href") for name in name_doms]
    name_texts = [name.text.replace("\u3000", " ").replace("\n", " ") for name in name_doms]

    yomikata_doms = table_elements[1::6]
    yomikata_text = [yomikata.text.replace("\u3000", " ") for yomikata in yomikata_doms]
    
    kaiha_doms = table_elements[2::6]
    kaiha_text = [kaiha.text for kaiha in kaiha_doms]
    
    district_doms = table_elements[3::6]
    district_text = [district.text for district in district_doms]
    
    period_doms = table_elements[4::6]
    period_text = [period.text for period in period_doms]

    #getting the meeting name and period
    meeting_period_component = gs.get_site_components_by(By.XPATH, "//p[@class='exp']")[0]
    meeting_period_text = meeting_period_component.text
    #storing all the info in json format
    out_dict = REPR_LIST_LAYOUT.copy()
    out_dict["meeting_period"] = meeting_period_text
    for link, name, yomikata, kaiha, district, period in zip(name_links, name_texts, yomikata_text, 
                                                             kaiha_text, district_text, period_text):
        repr_dict = {
            "name":name,
            "yomikata":yomikata,
            "kaiha":kaiha,
            "district":district,
            "period":period,
            "link":link
        }

        out_dict["reprs"].append(repr_dict)
    
    #saving json
    repr_list_json_path = os.path.join(UPPER_OUTPUT_DIR, "repr_list",f"{meeting_period_text}_repr_list.json")
    write_json(out_dict, repr_list_json_path)

def scrape_lower_repr_list():
    gs.get_url(LOWER_REPR_LIST_URL)
    #iterating through hiragana links
    hiragana_links = gs.get_site_components_by(By.XPATH, "//div[@id='mainlayout']//p//a")
    hiragana_links = [link.get_attribute("href") for link in hiragana_links]
    for link in hiragana_links:
        gs.get_url(link)
        table_elements = gs.get_site_components_by(By.TAG_NAME, 'td')
        #excluding junk
        date_up2date = table_elements[0].text
        table_elements = table_elements[7:-1]
        #getting the different doms for different info
        name_doms = table_elements[0::5]
        name_texts = [name.text.replace("\u3000", " ").replace("\n", " ") for name in name_doms]

        yomikata_doms = table_elements[1::5]
        yomikata_text = [yomikata.text.replace("\u3000", " ") for yomikata in yomikata_doms]

        kaiha_doms = table_elements[2::5]
        kaiha_text = [kaiha.text for kaiha in kaiha_doms]

        district_doms = table_elements[3::5]
        district_text = [district.text for district in district_doms]
        
        period_doms = table_elements[4::5]
        period_text = [period.text for period in period_doms]

        #storing all the info in json format
        out_dict = REPR_LIST_LAYOUT.copy()
        out_dict["meeting_period"] = date_up2date
        for name, yomikata, kaiha, district, period in zip(name_texts, yomikata_text,
                                                                    kaiha_text, district_text, period_text):
                split_period = list(filter(None, re.split("（|）|参", period)))
                if len(split_period) == 2:
                    terms_in_upper = int(split_period[-1])
                else:
                    terms_in_upper = 0
                terms_in_lower = int(split_period[0])
                repr_dict = {
                    "name":name,
                    "yomikata":yomikata,
                    "kaiha":kaiha,
                    "district":district,
                    "number_of_terms_lower":terms_in_lower,
                    "number_of_terms_upper":terms_in_upper,
                }
        
                out_dict["reprs"].append(repr_dict)
    
    #saving json
    repr_list_json_path = os.path.join(LOWER_OUTPUT_DIR, "repr_list",f"{date_up2date[:-2]}_repr_list.json")
    write_json(out_dict, repr_list_json_path)

def scrape_upper_meeting_member_list():
    gs.get_url(UPPER_MEETING_INFO_PAGE_URL)
    meeting_period = gs.get_site_components_by(By.XPATH, "//p[@class='subtitle']")[0].text
    #getting the link to all the meeting member lists
    meeting_member_link_components = gs.get_site_components_by(By.LINK_TEXT, "委員名簿")
    meeting_member_links = [link.get_attribute("href") for link in meeting_member_link_components]
    meeting_member_dict = {"meeting_period":meeting_period, "meetings":{}}
    for link in meeting_member_links:
        gs.get_url(link)
        meeting_name = gs.get_site_components_by(By.TAG_NAME, "h3")[0].text
        meeting_table_elements = gs.get_site_components_by(By.TAG_NAME, "td")
        role_components = meeting_table_elements[0::4]
        role_texts = [role.text for role in role_components]
        try:
            name_components = [name.find_element(By.TAG_NAME, "a") for name in meeting_table_elements[1::4]]
        except NoSuchElementException:
            name_components = meeting_table_elements[1::4]
        name_texts = [name.text for name in name_components]
        name_links = [name.get_attribute("href") for name in name_components]

        party_components = meeting_table_elements[2::4]
        party_texts = [party.text for party in party_components]
        for role, name, link, party in zip(role_texts, name_texts, name_links, party_texts):
            member_dict = {
                "role":role,
                "name":name,
                "link":link,
                "party":party
            }
            if not meeting_name in meeting_member_dict['meetings'].keys():
                meeting_member_dict['meetings'][meeting_name] = []
            meeting_member_dict['meetings'][meeting_name].append(member_dict)
    
    #saving json
    output_dir = os.path.join(UPPER_OUTPUT_DIR, "meeting_member_lists")
    create_dir(output_dir)
    meeting_member_json_path = os.path.join(output_dir, f"{meeting_period}.json")
    write_json(meeting_member_dict, meeting_member_json_path)

def scrape_lower_meeting_member_list():
    #TODO implement
    pass
 
def scrape_upper_meeting_bills_info():
    pass



def main():
    #declaring global variables
    global gs
    gs = GeneralScraper(CHROME_DRIVER_PATH)

    if SCRAPE_UPPER_REPR_LIST:
        scrape_upper_repr_list()
    if SCRAPE_LOWER_REPR_LIST:
        scrape_lower_repr_list()
    if SCRAPE_UPPER_MEETING_MEMBER_LIST:
        scrape_upper_meeting_member_list()

    #choose which repr list to use
    upper_house_repr_list_dir = os.path.join(UPPER_OUTPUT_DIR, "repr_list")
    upper_house_repr_list_file = [file for file in os.listdir(upper_house_repr_list_dir) if file.endswith("json")][0]
    repr_list = read_json(os.path.join(upper_house_repr_list_dir, upper_house_repr_list_file))
    gs.close_driver()

    return
    #Collecting the meeting speeches
    mcc = MeetingConvoCollector(base_url = GIJI_URL)
    # getting rid of the space so that we have a match in all of the name
    for speaker in repr_list['reprs']:
        speaker_name = "".join(speaker["name"].split())
        conditions_list = [
            f"from={2022}-01-14",
            # f"until={2021}-06-18",
            f"speaker={speaker_name}",
            "nameOfHouse=参議院",
            "searchRange=本文",
            "recordPacking=json"
        ]
        requests = mcc.make_requests(conditions_list)
        write_json(requests, os.path.join(UPPER_SPEECH_OUTPUT_DIR, f'{speaker_name}.json'))
        print("got requests")


if __name__ == "__main__":
    main()


