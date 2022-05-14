import requests
import json
import time
import os
#some parameters

base_url = "https://kokkai.ndl.go.jp/api/meeting?"
year = 2020
output_dir = f"C:\\Users\\katok\\Documents\\Projects\\kokkai\\data\\{year}"

conditions_list = [
f"from={year}-01-01",
f"until={year}-12-31",
"nameofHouse=衆議院",
"recordPacking=json"
]


condition_link = ""
#format the conditions for the request
for idx, condition in enumerate(conditions_list):
    if idx == len(conditions_list)-1:
        condition_link+= condition
    else:
        condition_link += (condition + "&")
starting_point = 1

gettable = True
while gettable:
    try:
        request_url = base_url+f"startRecord={starting_point}&"+condition_link
        print(request_url)
        response = requests.get(request_url)
        response = response.json()
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        with open(f"{output_dir}\\request_data&starting={starting_point}_{condition_link}.json", "w", encoding = "utf-8") as f:
            json.dump(response, f, ensure_ascii=False, indent=4)
        starting_point = response["nextRecordPosition"]
        time.sleep(10)
    except: 
        gettable = False
        print("No more records")

