import MeCab
import unidic

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

    def divide_string(self, original_string, exclusions=None):
        wakati = MeCab.Tagger(f"-d {unidic.DICDIR}")
        parsed = wakati.parse(original_string)
        split_string_list = [parse_item.split('\t')[0] for parse_item in parsed.split("\n")]
        extra = [parse_item.split('\t')[-1] for parse_item in parsed.split("\n")]
        final_str_list = []
        final_extra = []
        if exclusions:
            for string, ext in zip(split_string_list, extra):
                type_of_word = ext.split(',')[0]
                if type_of_word in exclusions:
                      continue
                else:
                    final_str_list.append(string)
                    final_extra.append(ext)
        else:
            final_str_list = split_string_list
            final_extra = extra
                 
        return final_str_list, final_extra

    def create_search_words(self, topic_title_separated, topic_title_cleaned):
        search_candidates = []
        topic_title_split = topic_title_cleaned.split("、")
        search_candidates += topic_title_split
        for i in range(int(len(topic_title_separated)*0.5),int(len(topic_title_separated)*0.8)):
            search_candidates.append("".join(topic_title_separated[:i]))

        return search_candidates