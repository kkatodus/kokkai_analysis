#%%
import csv
import json
import os
from params.paths import ROOT_DIR

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_geo')
filename = 'japan_city_position.csv'



import pandas as pd
import json
import os
from params.paths import ROOT_DIR

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_geo')
filename = 'japan_city_position.csv'
japanese_prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
# Read CSV file into a pandas dataframe
df = pd.read_csv(os.path.join(OUTPUT_DIR, filename), delimiter='\t', encoding='utf-8')

# Create an empty dictionary to store the data
data = {}

cur_prefecture = ''
# Iterate over each row in the dataframe
for row in df.itertuples():
	# Create a key using the 'name' column
	if row.name in japanese_prefectures:
		cur_prefecture = row.name
		continue
	key = row.name
	# Create a value using an array containing values from 'lat' and 'long' columns
	value = {
		'lat': row.lat,
		'long': row.long,
		'building': row.building,
		'address': row.address}
	# Add the key-value pair to the dictionary
	if key in data.keys():
		print('key already exists')
	data[cur_prefecture+'　' + key] = value

# Write the dictionary to a JSON file
with open(os.path.join(OUTPUT_DIR, 'japan_city_position.json'), 'w', encoding='utf-8') as f:
	json.dump(data, f, ensure_ascii=False, indent=4)

# %%
