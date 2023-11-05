#%%
import os
import openai
import json
from scrape.general_scraper import GeneralScraper
from selenium.webdriver.common.by import By
from secrets.api_keys import OPENAI_API_KEY
from file_handling.file_read_writer import read_json, write_json, create_dir
from params.paths import ROOT_DIR
RESOURCE_DIR = os.path.join(ROOT_DIR, 'resource')

openai.organization = "org-KwrqfnvZUjabTOAFL3QUAhk2"
openai.api_key = OPENAI_API_KEY
#%%
gs = GeneralScraper()
scraping_resource_path = os.path.join(RESOURCE_DIR, 'local_gov_repr_scrape.json')
scraping_resource = read_json(scraping_resource_path)

def all_reprs_on_one_page():
	urls = []
	xpath = ''
	while True:
		url = input('Get all the urls and press 0 when you are done. You can also press x to change the xpath.If you leave the input black, the city will be skipped.')
		if url == '0':
			break
		if url == 'x':
			xpath = input('Enter the xpath for the representative list.')
			continue
		urls.append(url)
	return urls, xpath

def all_reprs_on_multiple_pages():
	urls_to_main_pages = []
	xpath_to_individual_pages = ''
	xpath_to_repr_info = ''
	while True:
		url = input('Get all the urls and press 0 when you are done. \nYou can also type "xind" to change the xpath to the links to individual pages. \n You can also type "xpage" to enter the xpath to repr info. If you leave the list empty the city will be skipped')
		if url == '0':
			break
		if url == 'xind':
			xpath_to_individual_pages = input('Enter the xpath for the links to individual pages.')
			continue
		if url == 'xpage':
			xpath_to_repr_info = input('Enter the xpath for the representative info.')
			continue
		urls_to_main_pages.append(url)
	return urls_to_main_pages, xpath_to_individual_pages, xpath_to_repr_info

def get_text_from_local_repr_page(city_name):
	city_resource = scraping_resource[city_name]
	urls = city_resource['urls']
	all_texts = []
	for url in urls:
		gs.get_url(url)
		reprs_component = gs.get_site_components_by(By.XPATH, city_resource['reprs_xpath'])
		if len(reprs_component) > 0:
			all_texts.append(reprs_component[0].text)
	return all_texts


#%%
for idx, city_name in enumerate(scraping_resource.keys()):
	do_it_again = False
	while True:

		print(city_name, f'{idx}/{len(scraping_resource.keys())}')
		if 'urls' in scraping_resource[city_name].keys() and not do_it_again:
			break
		gs.get_url('https://www.google.com/search?q=' + city_name + '議会議員')
		if input('They have individual pages for reprs, type "ind", otherwise press enter') == 'ind':
			urls_to_main_pages, xpath_to_individual_pages, xpath_to_repr_info = all_reprs_on_multiple_pages()
			scraping_resource[city_name]['multiple_pages'] = True
			scraping_resource[city_name]['urls'] = urls_to_main_pages
			scraping_resource[city_name]['ind_reprs_xpath'] = xpath_to_individual_pages
			scraping_resource[city_name]['ind_reprs_info_xpath'] = xpath_to_repr_info

		else:
			urls, xpath = all_reprs_on_one_page()
			scraping_resource[city_name]['urls'] = urls
			scraping_resource[city_name]['reprs_xpath'] = xpath
		approved = input(f'The following is the final result\n {city_name}\n{scraping_resource[city_name]}\nDo you want to continue?(y/n)') 
		if approved == 'y' or approved == '':
			break
		else:
			print('Please enter the information again.')
			do_it_again = True
			continue
	write_json(scraping_resource, scraping_resource_path)

#%%
city_name = '広島県　安芸高田市'
city_resource = scraping_resource[city_name]
gs.get_url(city_resource['url'])
reprs_component = gs.get_site_components_by(By.XPATH, city_resource['reprs_xpath'])
print(reprs_component[0].text)
#%%

request_text = '以下のテキストから議員の情報を辞書のリスト形式で取得してください。抽出する情報は名前（漢字）、名前（フリガナ）、会派、年齢、所属委員会、名前から推定される性別、です。\n' + reprs_component[0].text

completion = openai.ChatCompletion.create(
  model="gpt-3.5-turbo",
  messages=[
    {"role": "user", "content": request_text}
  ]
)
#%%
print(completion.choices[0].message)

# %%
print(completion)
write_json(json.loads(completion.choices[0].message.content), 'test.json')

# %%
