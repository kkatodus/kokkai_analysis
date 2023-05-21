from selenium.webdriver.common.by import By

from params.paths import paths
from scrape.general_scraper import GeneralScraper


def main():
    gs = GeneralScraper(paths["chromedriver_path"])
    repr_list_page_url = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm"
    gs.get_url(repr_list_page_url)
    hiragana_list_xpath = "//a[contains(@href, 'giin.htm')]"
    hiragana_link_components = gs.get_site_components_by(By.XPATH, hiragana_list_xpath)
    hiragana_links = [component.get_attribute("href") for component in hiragana_link_components]
    repr_dict = {}
    repr_row_xpath = "//tr[@valign='top']"
    for link in hiragana_links:
        gs.get_url(link)
        repr_row_components = gs.get_site_components_by(By.XPATH, repr_row_xpath)
        for idx, repr_row_component in enumerate(repr_row_components):
            if idx == 0:
                continue
            


    pass

if __name__ == "__main__":
    main()