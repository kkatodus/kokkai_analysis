#%%
import torch

# %%
from transformers import AutoTokenizer, BertForSequenceClassification

model_name = "kkatodus/jp-speech-classifier"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = BertForSequenceClassification.from_pretrained(model_name)


#%%
#Testing the loaded model with a sample sentence
example_sentence = "こうしたルールをやめて、住民の命と暮らしを支えるための財政需要に応えた地方財政の在り方へと根本的に転換すべきではありませんか"
example_sentence2 = "バナナはおやつに入りますか"
sentences = [example_sentence, example_sentence2]
encoded = tokenizer(sentences, return_tensors="pt", padding=True, truncation=True, max_length=512)

with torch.no_grad():
	logits = model(**encoded).logits
predicted_class_id = logits.argmax(dim=1)
for idx, pred_id in enumerate(list(predicted_class_id)):
	print(f"{sentences[idx]} => {model.config.id2label[pred_id.item()]}")


# %%
import os
import re
from params.paths import ROOT_DIR, CHROMEDRIVER_PATH
from api_requests.meeting_convo_collector import MeetingConvoCollector
from file_handling.file_read_writer import read_json, write_json, create_dir, write_file

OUTPUT_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_repr')
create_dir(OUTPUT_DIR)
LOWER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_shugiin')
UPPER_HOUSE_DATA_DIR = os.path.join(ROOT_DIR, 'data_prepping', 'data', 'data_sangiin')

#reading the reprentative data for lower and upper house
lower_repr_dir = os.path.join(LOWER_HOUSE_DATA_DIR, 'repr_list')
lower_repr_file = os.listdir(lower_repr_dir)[0]
lower_house_meeting_dict = read_json(os.path.join(lower_repr_dir, lower_repr_file))

upper_repr_dir = os.path.join(UPPER_HOUSE_DATA_DIR, 'repr_list')
upper_repr_file = os.listdir(upper_repr_dir)[0]
upper_house_meeting_dict = read_json(os.path.join(upper_repr_dir, upper_repr_file))
repr_dict = lower_house_meeting_dict['reprs']
# %%
#collecting the speeches for each politician
mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")
topics = ['防衛', '少子化', 'LGBT', '移民', 'エネルギー','夫婦別姓','原発', '消費税', '国債', '防衛予算']

def extract_opinions(speech, target_class = ['意見文']):
	speech_segments = speech.split('。')
	encoded = tokenizer(speech_segments, return_tensors="pt", padding=True, truncation=True, max_length=512)
	with torch.no_grad():
		logits = model(**encoded).logits
	predicted_class_id = logits.argmax(dim=1)
	classes = [model.config.id2label[pred_id.item()] for pred_id in list(predicted_class_id)]
	extracted_segments = []
	for idx, (sentence, pred_class) in enumerate(zip(speech_segments, classes)):
		if pred_class in target_class:
			extracted_segments.append(sentence)
	return extracted_segments

def iterate_speeches(record):
	output_array = []
	if record['numberOfRecords'] == 0:
		return output_array
	print('speech record length', len(record['speechRecord']))
	for speech in record['speechRecord']:
		speech_id = speech['speechID']
		house_name = speech['nameOfHouse']
		meeting_name = speech['nameOfMeeting']
		date = speech['date']
		speech_text = speech['speech']
		speech_url = speech['speechURL']
		speaker_group = speech['speakerGroup']
		extracted_opinions = extract_opinions(speech_text)
		if len(extracted_opinions) > 0:
			speech_dict = {'speech_id': speech_id, 'house_name': house_name, 'meeting_name': meeting_name, 'date': date, 'speech_text': speech_text, 'speech_url': speech_url, 'speaker_group':speaker_group,'extracted_opinions': extracted_opinions}
			output_array.append(speech_dict)
	return output_array

def clean_repr_name(repr_name):
	repr_name = re.sub('\s|君|\[(.*?)\]', '', repr_name)
	return repr_name
# %%
for party in repr_dict.keys():
	for repr in repr_dict[party]:
		for topic in topics:
			repr_name = repr['name']
			repr_name = clean_repr_name(repr_name)		
			repr_topic_dir = os.path.join(OUTPUT_DIR, party, repr_name, topic)	
			if os.path.exists(repr_topic_dir):
				print('Already collected speeches for',party, repr_name, topic)
				continue
			print(f"Collecting speeches for {repr_name}")
			conditions_list = [f"any={topic}",f"speaker={repr_name}",'recordPacking=json','maximumRecords=50']
			start_point = 1
			idx = 0
			while True:
				if start_point is None:
					break
				speeches, start_point = mcc.make_one_request(conditions_list, starting_point=start_point)
				
				print('iterating speeches')
				speeches = iterate_speeches(speeches)
				if len(speeches) == 0:
					print('no speeches extracted')	
					continue
				create_dir(repr_topic_dir)
				output_json = {'repr_name': repr_name, 'speeches': speeches}
				idx = idx + 1
				print(f"Writing {idx}th file for {repr_name}")
				write_json(output_json, os.path.join(OUTPUT_DIR,party, repr_name, topic, f"{idx}.json"))
		
# %%
#create a summary json for the repr opinions data
summary_dict = {'reprs':{}}
for party in repr_dict.keys():
	summary_dict['reprs'][party] = {}
	for repr in repr_dict[party]:
		repr_name = repr['name']
		repr_name = clean_repr_name(repr_name)
		repr_dir_path = os.path.join(OUTPUT_DIR,party, repr_name)
		if not os.path.exists(repr_dir_path):
			continue
		tags = [dirname for dirname in os.listdir(repr_dir_path)]
		if len(tags) == 0:
			continue
		summary_dict['reprs'][party][repr_name] = {}
		summary_dict['reprs'][party][repr_name]['tags'] = tags
		summary_dict['reprs'][party][repr_name]['number_of_files'] = {}
		for tag in tags:
			topic_dir = os.path.join(repr_dir_path, tag)
			number_of_files = len(os.listdir(topic_dir))
			summary_dict['reprs'][party][repr_name]['number_of_files'][tag] = number_of_files
write_json(summary_dict, os.path.join(OUTPUT_DIR, 'summary.json'))
# %%
