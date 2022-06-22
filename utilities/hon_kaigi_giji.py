import requests
import json
import time
import os
import sys
#some parameters

base_url = "https://kokkai.ndl.go.jp/api/meeting?"
year = int(sys.argv[1])
output_dir = f"C:\\Users\\katok\\Documents\\Projects\\kokkai_analysis\\data_sangiin\\{year}"

conditions_list = [
f"from={year}-01-01",
f"until={year}-12-31",
"nameofHouse=参議院",
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
        
        next_position = response["nextRecordPosition"]
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        with open(f"{output_dir}\\{starting_point}_{next_position}.json", "w", encoding = "utf-8") as f:
            json.dump(response, f, ensure_ascii=False, indent=4)
        
        starting_point = next_position
        time.sleep(10)
    except: 
        gettable = False
        print("No more records")

