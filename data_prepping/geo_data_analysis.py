#%%
import csv
import json
import os
from params.paths import ROOT_DIR
import pandas as pd
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file


OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_geo')
#%%
# code to create city to coordinate dictionary
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

# code to convert city name to code and year to code
def get_city2code(path2file):
	data = read_json(path2file)
	areacode_list = data['GET_STATS_DATA']['STATISTICAL_DATA']['CLASS_INF']['CLASS_OBJ'][2]['CLASS']
	city2code = {}
	code2city = {}
	for areacode in areacode_list:
		city = areacode['@name']
		prefecture = city.split(' ')[0]
		district = ''.join(city.split(' ')[1:])
		code = areacode['@code']
		city = prefecture + '　' + district
		city2code[city] = code
		code2city[code] = city
	return city2code, code2city

def get_year2code(path2file):
	data = read_json(path2file)
	yearcode_list = data['GET_STATS_DATA']['STATISTICAL_DATA']['CLASS_INF']['CLASS_OBJ'][3]['CLASS']
	year2code = {}
	code2year = {}
	for yearcode in yearcode_list:
		year = yearcode['@name']
		code = yearcode['@code']
		year2code[year] = code
		code2year[code] = code[:4]
	return year2code, code2year


city2code, code2city = get_city2code(os.path.join(OUTPUT_DIR, 'japan_city_population_by_year.json'))
year2code, code2year = get_year2code(os.path.join(OUTPUT_DIR, 'japan_city_population_by_year.json'))
write_json(city2code, os.path.join(OUTPUT_DIR, 'city2code.json'))
write_json(code2city, os.path.join(OUTPUT_DIR, 'code2city.json'))
write_json(year2code, os.path.join(OUTPUT_DIR, 'year2code.json'))
write_json(code2year, os.path.join(OUTPUT_DIR, 'code2year.json'))

# %%
# code to generate unified json data for city population change over the years

def unify_city_population_and_position_data():
	city2coord = read_json(os.path.join(OUTPUT_DIR, 'japan_city_position.json'))
	code2city = read_json(os.path.join(OUTPUT_DIR, 'code2city.json'))
	code2year = read_json(os.path.join(OUTPUT_DIR, 'code2year.json'))
	population_data_array = read_json(os.path.join(OUTPUT_DIR, 'japan_city_population_by_year.json'))
	population_data_array = population_data_array['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF']['VALUE']
	city_population_array = []
	current_city = code2city[population_data_array[0]['@area']]
	current_city_dict = {'city':'', 'lat':'', 'long':'', 'populationByYear':{}}
	for population in population_data_array:
		try:
			city = code2city[population['@area']]
			if city != current_city:
				current_city = city
				city_population_array.append(current_city_dict)
				current_city_dict = {'city':'', 'lat':'', 'long':'', 'populationByYear':{}}
			coord = city2coord[city]
			lat, long = coord['lat'], coord['long']
			year = code2year[population['@time']]
			population = population['$']
			current_city_dict['city'] = city
			current_city_dict['lat'] = lat
			current_city_dict['long'] = long
			current_city_dict['populationByYear'][year] = population

		except KeyError:
			print(f'error with city {city}')
			continue
	return city_population_array

city_population_array = unify_city_population_and_position_data()
write_json(city_population_array, os.path.join(OUTPUT_DIR, 'city_population_array.json'))
# %%
