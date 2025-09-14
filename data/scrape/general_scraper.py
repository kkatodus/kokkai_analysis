from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.firefox.options import Options

firefox_binary_path = "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"

class GeneralScraper:
    def __init__(self, firefox=False):
        if firefox:
            options = Options()
            options.binary_location = firefox_binary_path

            driver = webdriver.Firefox(options=options, executable_path='./geckodriver')
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
        