from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager

# firefox_binary_path = "/mnt/c/Program Files/Mozilla Firefox/firefox.exe"/

class GeneralScraper:
    def __init__(self, firefox=False):
        if firefox:
            options = FirefoxOptions()
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.set_preference("remote.active-protocols", 3)
            service = FirefoxService(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
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
        