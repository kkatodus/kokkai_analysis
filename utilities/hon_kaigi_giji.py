from api_requests.meeting_convo_collector import MeetingConvoCollector

base_url = "https://kokkai.ndl.go.jp/api/meeting?"
output_dir = f"..\\data_sangiin\\"

conditions_list = [
f"from={2021}-06-14",
f"until={2021}-06-17",
"nameOfHouse=参議院",
"any=長水落敏栄",
"recordPacking=json"
]

def main():
    mcc = MeetingConvoCollector()
    mcc.make_requests(conditions_list, output_dir)


if __name__ == "__main__":
    main()


