import MeCab


class StringProcessor:

    def __init__(self):
        pass

    def clean_topic_title(topic_title, remove_date_plan = True, remove_brackets = True):
        if remove_date_plan and "日程第" in topic_title:
            topic_title = topic_title.split("　")[1:]
            topic_title = "".join(topic_title)

        if remove_brackets:
            while "（" in topic_title and "）" in topic_title:
                left_bracket_idx = topic_title.find("（")
                right_bracket_idx = topic_title.find("）")
                topic_title = topic_title[:left_bracket_idx] + topic_title[right_bracket_idx+1:]

        return topic_title

    def divide_string(original_string):
        wakati = MeCab.Tagger("-Owakati")
        split_string_list = wakati.parse(original_string).split()
        return split_string_list


