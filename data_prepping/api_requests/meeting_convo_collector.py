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

        request_dicts_list = []
        while gettable:
            try:
                request_url = self.base_url+f"startRecord={starting_point}&"+conditions_link
                print(request_url)
                
                response = requests.get(request_url)
                response = response.json()
                
                next_position = response["nextRecordPosition"]
                request_dicts_list.append(response)
                
                starting_point = next_position
                time.sleep(5)
            except: 
                gettable = False
                print("No more records")

        return request_dicts_list
