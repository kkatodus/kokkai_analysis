import os
from api_requests.meeting_convo_collector import MeetingConvoCollector
from params.paths import ROOT_DIR
from scrape.general_scraper import GeneralScraper
from selenium.webdriver.common.by import By

## URLS
GIJI_URL = "https://kokkai.ndl.go.jp/api/speech?"
REPR_LIST_URL = "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/211/giin.htm"

## PATHS
OUTPUT_DIR = os.path.join(ROOT_DIR, "data_prepping","data_sangiin")
CHROME_DRIVER_PATH = os.path.join(ROOT_DIR, "chromedriver")

## PARAMS
SCRAPE_REPR_LIST = True

## XPATHS
REPR_TABLE_ELEMENT_XPATH = "//td"
conditions_list = [
f"from={2021}-06-14",
f"until={2021}-06-18",
"nameOfHouse=参議院",
#"any=重要施設周辺及び国境離島等",
"searchRange=本文",
"recordPacking=json"
]

def scrape_repr_list():
     # scraping the list of representatives in upper house
    repr_list_file_path = os.path.join(OUTPUT_DIR, "repr_list.json")
    gs = GeneralScraper(CHROME_DRIVER_PATH)
    gs.get_url(REPR_LIST_URL)
    table_elements = gs.get_site_components_by(By.XPATH, REPR_TABLE_ELEMENT_XPATH)
    #excluding hiragana links
    table_elements = table_elements[10:]
    name_doms = table_elements[0::6]
    name_links = [name.get_attribute("href") for name in name_doms]
    name_texts = [name.text.replace("\u3000", " ").replace("\n", " ") for name in name_doms]
    yomikata_doms = table_elements[1::6]
    yomikata_text = [yomikata.text.replace("\u3000", " ") for yomikata in yomikata_doms]
    kaiha_doms = table_elements[2::6]
    kaiha_text = [kaiha.text for kaiha in kaiha_doms]
    district_doms = table_elements[3::6]
    district_text = [district.text for district in district_doms]
    period_doms = table_elements[4::6]
    period_text = [period.text for period in period_doms]
    print("done updating repr list")


def main():
    if SCRAPE_REPR_LIST:
        scrape_repr_list()
   
    #creating a list of dictionaries
    # mcc = MeetingConvoCollector(base_url = GIJI_URL)
    # request = mcc.make_requests(conditions_list, OUTPUT_DIR)
    # print(request)

if __name__ == "__main__":
    main()


