"""Topic tagging for speeches by search-word matching (resource/experiment_config.json).

Shared by the speech updater; `reorganize_all_repr_speeches.py` has the original copy.
"""
import json
import os
from typing import List

DEFAULT_TOPICS_FILE = os.path.join(os.path.dirname(__file__), "..", "resource", "experiment_config.json")


def load_topics(path: str = DEFAULT_TOPICS_FILE) -> List[dict]:
	with open(path, encoding="utf-8") as f:
		return json.load(f)


def identify_topic_for_speech(speech_text: str, topics: List[dict]) -> List[str]:
	return [
		topic["topic_name_en"]
		for topic in topics
		if any(word in speech_text for word in topic["search_words"])
	]
