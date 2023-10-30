#%%
import os
import openai
from scrape.general_scraper import GeneralScraper
from secrets.api_keys import OPENAI_API_KEY
from params.paths import ROOT_DIR
CHROME_DRIVER_PATH = os.path.join(ROOT_DIR, "chromedriver")


#%%
openai.organization = "org-KwrqfnvZUjabTOAFL3QUAhk2"
openai.api_key = OPENAI_API_KEY

completion = openai.ChatCompletion.create(
  model="gpt-3.5-turbo",
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ]
)
print(completion.choices[0].message)
#%%
akitakata_url = 'https://www.akitakata.jp/ja/parliament/gikai_meibo/n114p170r421a086w96/'
gs = GeneralScraper(CHROME_DRIVER_PATH)
os.listdir(ROOT_DIR)

	# %%
