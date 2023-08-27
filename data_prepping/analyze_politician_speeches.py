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
# %%
#collecting the speeches for each politician
mcc = MeetingConvoCollector("https://kokkai.ndl.go.jp/api/speech?")
topics = ['防衛', '少子化', 'LGBT', '移民', 'エネルギー']
repr_dict = lower_house_meeting_dict['reprs']

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

def iterate_speeches(request):
	output_array = []
	for record in request:
		if record['numberOfRecords'] == 0:
			continue
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

for topic in topics:
	for party in repr_dict.keys():
		for repr in repr_dict[party]:
			repr_name = repr['name']
			repr_name = clean_repr_name(repr_name)
			create_dir(os.path.join(OUTPUT_DIR, repr_name))
			if os.path.exists(os.path.join(OUTPUT_DIR, repr_name, f"{topic}.json")):
				print('Already collected', repr_name, topic, party)
				continue
			print(f"Collecting speeches for {repr_name}")
			conditions_list = [f"any={topic}",f"speaker={repr_name}",'recordPacking=json','maximumRecords=100']
			speeches = mcc.make_requests(conditions_list)
			speeches = iterate_speeches(speeches)
			output_json = {'repr_name': repr_name, 'speeches': speeches}
			write_json(output_json, os.path.join(OUTPUT_DIR, repr_name, f"{topic}.json"))
		
# %%
