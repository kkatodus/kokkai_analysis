from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
import time
import os
#parameters
output_dir = "..\\data_sangiin\\"
chromedriver_path = "..\\chromedriver.exe"
main_website_url = "https://xn--hhr797a3hrxtn.com/house-of-councillors/"
politician_list_file_name = "politician_list.csv"
areas = [
    "北海道",
    "東北",
    "関東",
    "中部",
    "近畿",
    "中国",
    "四国",
    "九州"
]

xpath_to_politician_list = "//div[@id='MENU']/following-sibling::div//h2/following-sibling::ul//a"
xpath_to_voting_row = "//div[@id='KIZI']/following-sibling::table//tr"
    


def obtain_politician_voting_info(politician_name):
    global driver
    next_page = True
    print(politician_name)
    while next_page:
        voting_rows = driver.find_elements(By.XPATH, xpath_to_voting_row)
        
        for voting_row in voting_rows[1:]:
            voting_topic = voting_row.find_element(By.TAG_NAME, "a")
            cols = voting_row.find_elements(By.TAG_NAME, "td")
            yay_col = cols[2]
            nay_col = cols[3]
            abstain_col = cols[4]
            if yay_col.text == "○":
                vote = "Yay"
            elif nay_col.text == "×":
                vote = "Nay"
            else:
                vote = "Abstain"
            print(voting_topic.text, vote)
        try:
            next_link = driver.find_element(By.LINK_TEXT, ">")
            next_link.click()
        except Exception as e:
            print("_______________________Next Politician_________________________________")
            next_page = False


def sangiin_collect():
    global driver
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    #prepping chromedriver
    service = Service(executable_path=chromedriver_path)
    driver = webdriver.Chrome(service=service)
    for area in areas:
        driver.get(main_website_url)
        area_link = driver.find_element(By.LINK_TEXT, area)
        area_link.click()
        politician_links = driver.find_elements(By.XPATH, xpath_to_politician_list)
        politician_names = [politician_link.text for politician_link in politician_links][:-3]
        politician_links = [politician.get_attribute("href") for politician in politician_links][:-3]
        for name, link in zip(politician_names, politician_links):
            driver.get(link)
            obtain_politician_voting_info(name)
        time.sleep(5)

if __name__ == "__main__":
    sangiin_collect()