from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

class GeneralScraper:
    def __init__(self, chromedriver_path):
        service = Service(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service)
        self.driver = driver
    
    def get_url(self, url):
        self.driver.get(url)

    def get_site_components_by(self, by, name):
        components = self.driver.find_elements(by, name)
        return components
    
    def close_driver(self):
        self.driver.close()
        