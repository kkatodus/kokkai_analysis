from api_requests.meeting_convo_collector import MeetingConvoCollector

base_url = "https://kokkai.ndl.go.jp/api/speech?"
output_dir = f"..\\test\\"

conditions_list = [
f"from={2021}-06-14",
f"until={2021}-06-18",
"nameOfHouse=参議院",
#"any=重要施設周辺及び国境離島等",
"searchRange=本文",
"recordPacking=json"
]

def main():
    mcc = MeetingConvoCollector(base_url = base_url)
    mcc.make_requests(conditions_list, output_dir)


if __name__ == "__main__":
    main()


