from tokenize import String
from data_process.string_processor import StringProcessor

sp = StringProcessor()
topic_title_cleaned = sp.clean_topic_title("日程第６ 公立義務教育諸学校の学級編制及び教職員定数の標準に関する法律の一部を改正する法律案（内閣提出、衆議院送付）", remove_date_plan=False, remove_brackets=False)

topic_title_split = "日程第６ 公立義務教育諸学校の学級編制及び教職員定数の標準に関する法律の一部を改正する法律案（内閣提出、衆議院送付）".split()
print(topic_title_split)

topic_title_split = "日程第７　地震防災対策特別措置法の一部を改正する法律案（衆議院提出）".split()
print(topic_title_split)