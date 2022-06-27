from tokenize import String
from data_process.string_processor import StringProcessor

topic_title_cleaned = StringProcessor.clean_topic_title("日程第１０　強制労働の廃止に関する条約（第百五号）の締結のための関係法律の整備に関する法律案（衆議院提出）")

print(topic_title_cleaned)