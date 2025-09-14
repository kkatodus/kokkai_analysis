import time
import requests
import json
import os

class MeetingConvoCollector:

    def __init__(self, base_url):
        self.base_url = base_url

    def make_requests(self, conditions_list, max_length=500):
        #format the conditions for the request
        conditions_link = "&".join(conditions_list)
        starting_point = 1

        request_dicts_list = []
        while True:
                request_url = self.base_url+f"startRecord={starting_point}&"+conditions_link
                print(request_url)
                
                response = requests.get(request_url)
                response = response.json()
                
                if "nextRecordPosition" not in response.keys():
                    print("No more records")
                    break
                next_position = response["nextRecordPosition"]
                request_dicts_list.append(response)
                
                starting_point = next_position
                time.sleep(5)
        return request_dicts_list
        
    def make_one_request(self, conditions_list, starting_point=1):
        conditions_link = "&".join(conditions_list)
        request_url = self.base_url+f"startRecord={starting_point}&"+conditions_link
        print(request_url)
        response = requests.get(request_url)
        response = response.json()
        if "nextRecordPosition" not in response.keys():
          print("No more records")
          return response, None
        next_position = response["nextRecordPosition"]
        return response, next_position
		
