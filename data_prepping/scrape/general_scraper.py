from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

class GeneralScraper:
    def __init__(self):
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
        self.driver = driver
    
    def get_url(self, url):
        self.driver.get(url)

    def get_site_components_by(self, by, name):
        components = self.driver.find_elements(by, name)
        return components
    
    def close_driver(self):
        self.driver.close()
        