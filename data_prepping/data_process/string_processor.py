import MeCab


class StringProcessor:

    def __init__(self):
        pass

    def clean_topic_title(self, 
    topic_title, 
    remove_date_plan = True, 
    remove_brackets = True,
    remove_year=True,
    remove_speech_marks=True):
        if remove_date_plan and "日程第" in topic_title:
            topic_title = topic_title.split()[1:]
            topic_title = "".join(topic_title)

        if remove_brackets:
            while "（" in topic_title and "）" in topic_title:
                left_bracket_idx = topic_title.find("（")
                right_bracket_idx = topic_title.find("）")
                topic_title = topic_title[:left_bracket_idx] + topic_title[right_bracket_idx+1:]

        if remove_year:
            if "年度" in topic_title:
                nenndo_idx = topic_title.find("年度")
                topic_title = topic_title[nenndo_idx+2:]

        if remove_speech_marks:
            if "「" in topic_title and "」" in topic_title:
                left_speech_idx = topic_title.find("「")
                right_speech_idx = topic_title.find("」")
                topic_title = topic_title[:left_speech_idx] + topic_title[right_speech_idx+1:]

        return topic_title

    def divide_string(self, original_string):
        wakati = MeCab.Tagger("-Owakati")
        split_string_list = wakati.parse(original_string).split()
        return split_string_list

    def create_search_words(self, topic_title_separated):
        search_candidates = []
        
        for i in range(int(len(topic_title_separated)*0.5),int(len(topic_title_separated)*0.8)):
            search_candidates.append("".join(topic_title_separated[:i]))

        return search_candidates