import time
import requests
import json
import os

class MeetingConvoCollector:

    def __init__(self, base_url):
        self.base_url = base_url

    def make_requests(self, conditions_list, output_dir):
        #format the conditions for the request
        conditions_link = "&".join(conditions_list)
        starting_point = 1

        gettable = True
        while gettable:
            try:
                request_url = self.base_url+f"startRecord={starting_point}&"+conditions_link
                print(request_url)
                
                response = requests.get(request_url)
                response = response.json()
                
                next_position = response["nextRecordPosition"]
                if not os.path.exists(output_dir):
                    os.makedirs(output_dir)
                
                with open(f"{output_dir}\\{conditions_link}.json", "w", encoding = "utf-8") as f:
                    json.dump(response, f, ensure_ascii=False, indent=4)
                
                starting_point = next_position
                time.sleep(10)
            except: 
                gettable = False
                print("No more records")

