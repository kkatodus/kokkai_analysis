from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service as FirefoxService

class GeneralScraper:
    def __init__(self, firefox=False):
        if firefox:
            driver = webdriver.Firefox(executable_path='./geckodriver')
        else:
            ChromeOptions = webdriver.ChromeOptions()
            ChromeOptions.add_argument('--disable-browser-side-navigation')
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options = ChromeOptions)
        self.driver = driver
    
    def get_url(self, url):
        self.driver.get(url)

    def get_site_components_by(self, by, name):
        components = self.driver.find_elements(by, name)
        return components
    
    def close_driver(self):
        self.driver.close()
        