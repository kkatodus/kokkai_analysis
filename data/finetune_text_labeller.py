#!/usr/bin/env python
# coding: utf-8

# ## Convert the data into a classification model injestable format

# In[ ]:


import json
from params.paths import DATA_DIR
import os
import re

PARLIAMENT_SPEECH_LABELS = [
	"質問文",
	"追及・確認文",
	"答弁文",
	"反論・再反論文",
	"意見文",
	"要望・提案文",
	"批判文",
	"評価文",
	"説明文",
	"事実文",
	"謝罪・釈明文",
	"手続・運営文",
	"その他"
]

YOUTUBE_SPEECH_LABELS = [
	"政治",
	"その他",
]

TWITTER_SPEECH_LABELS = [
	"政治",
	"その他"
]

TEXT_FIELDS = [
	"speech",
	"text",
	"tweet"
]

LABEL_FIELDS = [
	"label",
	"label",
	"label"
]

PARLIAMENT_DATA_PATH = os.path.join(DATA_DIR, "diet_speech_label", "segment_diet_speech_label.jsonl")
YOUTUBE_DATA_PATH = os.path.join(DATA_DIR, "youtube_label", "youtube_segment_label.jsonl")
TWITTER_DATA_PATH = os.path.join(DATA_DIR, "tweet_label", "tweet_label.jsonl")
for path in [PARLIAMENT_DATA_PATH, YOUTUBE_DATA_PATH, TWITTER_DATA_PATH]:
	if not os.path.exists(path):
		raise FileNotFoundError(f"Required data file not found: {path}")

PARLIAMENT_DATA_PROCESSED_PATH = os.path.join(DATA_DIR, "diet_speech_label", "vector_label_diet_speech_label.jsonl")
YOUTUBE_DATA_PROCESSED_PATH = os.path.join(DATA_DIR, "youtube_label", "vector_label_youtube_segment.jsonl")
TWITTER_DATA_PROCESSED_PATH = os.path.join(DATA_DIR, "tweet_label", "vector_label_tweet_label.jsonl")

IGNORE_DATA = ["parliament", "twitter"]


def add_periods(text: str) -> str:
	"""Insert Japanese periods after sentence-ending phrases.

	- Adds "。" after any occurrence of the end words.
	- Does NOT add if it's already followed by punctuation like "。", "！", "？".
	"""
	end_words = ["ですね", "ですよ", "である", "です", "ます"]
	pattern = "(" + "|".join(re.escape(w) for w in end_words) + ")"
	# Replace end-word occurrences not already followed by punctuation.
	return re.sub(pattern + r"(?![。！？!?])", r"\1。", text)

def convert_labels_to_vector():
	for data_type, path, labels, processed_path, text_field, label_field in (
		('parliament', PARLIAMENT_DATA_PATH, PARLIAMENT_SPEECH_LABELS, PARLIAMENT_DATA_PROCESSED_PATH, TEXT_FIELDS[0], LABEL_FIELDS[0]),
		('youtube', YOUTUBE_DATA_PATH, YOUTUBE_SPEECH_LABELS, YOUTUBE_DATA_PROCESSED_PATH, TEXT_FIELDS[1], LABEL_FIELDS[1]),
		('twitter', TWITTER_DATA_PATH, TWITTER_SPEECH_LABELS, TWITTER_DATA_PROCESSED_PATH, TEXT_FIELDS[2], LABEL_FIELDS[2]),
	):
		print(f"Processing {path} into {processed_path}...")
		if data_type in IGNORE_DATA:
			print(f"Skipping {data_type} data as per configuration.")
			continue
		with open(path, "r", encoding="utf-8") as f_in, open(processed_path, "w", encoding="utf-8") as f_out:
			for line in f_in:
				data = json.loads(line)
				data_text = data[text_field]


				data_labels = data[label_field]
				if type(data_labels) == str:
					data_labels = [data_labels]
						
				label_vector = [0] * len(labels)
				for data_label in data_labels:
					if data_label in labels:
						label_index = labels.index(data_label)
						label_vector[label_index] = 1

				if sum(label_vector) == 0:
					continue
					
				processed_data = {
					"text": data_text,
					"label": label_vector,
					"text_label": data_labels
				}
				f_out.write(json.dumps(processed_data, ensure_ascii=False) + "\n")



if False:
	convert_labels_to_vector()


# ## Train classifier on the labelled data

# In[5]:


import numpy as np
from datasets import Dataset, Sequence, Value
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
)
import evaluate
from peft import LoraConfig, get_peft_model, TaskType
import torch
import random
import matplotlib.pyplot as plt


seed = 42
random.seed(seed)
np.random.seed(seed)
torch.manual_seed(seed)
torch.cuda.manual_seed_all(seed)

MODEL_NAME = "ku-nlp/deberta-v3-base-japanese"


# In[ ]:


import numpy as np
import matplotlib.pyplot as plt
import japanize_matplotlib


def plot_label_distribution_hf(ds, labels, split="train", label_col="labels", top_k=None, log_y=False):
    """
    Plot label frequency distribution for a HuggingFace Dataset / DatasetDict.

    Args:
        ds: datasets.Dataset or datasets.DatasetDict
        labels (list[str]): label names in index order
        split (str): which split to use if ds is a DatasetDict (e.g., "train")
        label_col (str): column that contains the multi-hot / multi-label vector (e.g., "labels")
        top_k (int|None): if set, plot only the top-k most frequent labels
        log_y (bool): whether to use log scale on y axis
    """
    d = ds[split] if isinstance(ds, dict) or hasattr(ds, "keys") else ds

    if label_col not in d.column_names:
        raise ValueError(f"'{label_col}' not in dataset columns: {d.column_names}")

    # Efficient: pull the whole column once
    y = d[label_col]  # list[list[float|int]] or list[np.array]
    y = np.asarray(y)

    # Handle float labels (0.0/1.0) safely
    y = (y > 0.5).astype(np.int64)

    if y.ndim != 2 or y.shape[1] != len(labels):
        raise ValueError(
            f"Expected '{label_col}' to be shape [N, {len(labels)}], got {y.shape}"
        )

    label_counts = y.sum(axis=0)
    total_samples = y.shape[0]

    # Sort
    sorted_idx = np.argsort(label_counts)[::-1]
    sorted_counts = label_counts[sorted_idx]
    sorted_labels = [labels[i] for i in sorted_idx]

    if top_k is not None:
        sorted_counts = sorted_counts[:top_k]
        sorted_labels = sorted_labels[:top_k]

    print(f"Split: {split} | Total samples: {total_samples}")
    for lab, c in zip(sorted_labels, sorted_counts):
        print(f"{lab}: {int(c)}")

    # Plot
    fig_w = max(10, len(sorted_labels) * 0.4)
    plt.figure(figsize=(fig_w, 6))
    plt.bar(sorted_labels, sorted_counts)
    plt.xticks(rotation=45, ha="right")
    plt.ylabel("Number of samples")
    plt.xlabel("Labels")
    plt.title(f"Label Distribution (Multi-label) — {split}")
    if log_y:
        plt.yscale("log")
        plt.ylabel("Number of samples (log scale)")
    plt.tight_layout()
    plt.show()


# In[ ]:


if False:
	for path in [PARLIAMENT_DATA_PROCESSED_PATH, YOUTUBE_DATA_PROCESSED_PATH, TWITTER_DATA_PROCESSED_PATH]:
		if not os.path.exists(path):
		 	raise FileNotFoundError(f"Processed data file not found: {path}")
		plot_label_distribution_hf(
			Dataset.from_json(path),
			labels=PARLIAMENT_SPEECH_LABELS if "diet_speech" in path else YOUTUBE_SPEECH_LABELS if "youtube" in path else TWITTER_SPEECH_LABELS,
		split="train",
		label_col="label",
		log_y=True,
	)


# ## First for the parliament data

# In[ ]:


if False:

	ds = Dataset.from_json(PARLIAMENT_DATA_PROCESSED_PATH).train_test_split(test_size=0.2, seed=42)

	ds = ds.rename_column("label", "labels")
	tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False, trust_remote_code=False)

	def tok(batch):
		tok = tokenizer(batch['text'], truncation=True)
		tok['labels'] = [[float(x) for x in y] for y in batch['labels']]
		return tok

	ds = ds.map(tok, batched=True, remove_columns=["text", "text_label"])

	features = ds["train"].features.copy()
	features["labels"] = Sequence(Value("float32"), length=len(PARLIAMENT_SPEECH_LABELS))  # length optional but nice
	ds = ds.cast(features)
	from collections import Counter
	c = Counter([np.argmax(x).item() for x in ds["train"]["labels"]])
	print("Counter", c)

	model = AutoModelForSequenceClassification.from_pretrained(
		MODEL_NAME,
		num_labels=len(PARLIAMENT_SPEECH_LABELS),
		device_map="auto",
	)

	model.config.problem_type = "multi_label_classification"

	lora_config = LoraConfig(
		task_type=TaskType.SEQ_CLS,
		r=8,
		lora_alpha=16,
		lora_dropout=0.05,
		init_lora_weights="gaussian",
		bias="none"
	)

	model = get_peft_model(model, lora_config)
	model.print_trainable_parameters()

	args = TrainingArguments(
		output_dir=os.path.join(DATA_DIR, "finetuned_text_labeller_parliament"),
		learning_rate=2e-5,
		per_device_train_batch_size=16,
		per_device_eval_batch_size=32,
		num_train_epochs=20,
		eval_strategy="epoch",
	)

	f1 = evaluate.load("f1")
	precision = evaluate.load("precision")
	recall = evaluate.load("recall")

	# Optional but very useful for multi-label:
	# pip install scikit-learn
	from sklearn.metrics import average_precision_score

	import numpy as np
	from sklearn.metrics import f1_score, precision_score, recall_score, average_precision_score

	LABELS = PARLIAMENT_SPEECH_LABELS
	num_labels = len(LABELS)

	def sigmoid(x):
		return 1 / (1 + np.exp(-x))

	def compute_metrics(eval_pred):
		logits, labels = eval_pred
		probs = sigmoid(logits)

		thr = 0.5
		preds = (probs >= thr).astype(np.int32)

		# make sure labels are 0/1 ints (yours are float32)
		y_true = (labels >= 0.5).astype(np.int32)

		out = {
			"f1_micro": f1_score(y_true, preds, average="micro", zero_division=0),
			"f1_macro": f1_score(y_true, preds, average="macro", zero_division=0),
			"precision_micro": precision_score(y_true, preds, average="micro", zero_division=0),
			"recall_micro": recall_score(y_true, preds, average="micro", zero_division=0),
			"pr_auc_macro": average_precision_score(y_true, probs, average="macro"),
		}

		# per-label f1
		per_label = f1_score(y_true, preds, average=None, zero_division=0)
		for i, v in enumerate(per_label):
			out[f"f1_{LABELS[i]}"] = float(v)

		return out



	trainer = Trainer(
		model=model,
		args=args,
		train_dataset=ds["train"],
		eval_dataset=ds["test"],
		tokenizer=tokenizer,
		compute_metrics=compute_metrics,
	)

	trainer.train()

	metrics = trainer.evaluate()
	print(metrics)

	from sklearn.metrics import f1_score
	pred = trainer.predict(ds["test"])
	logits = pred.predictions
	labels = pred.label_ids
	probs = 1 / (1 + np.exp(-logits))


	best_thr, best_f1 = None, -1
	for thr in np.linspace(0.05, 0.95, 19):
		preds = (probs >= thr).astype(int)
		f1_micro = f1_score(labels, preds, average="micro")
		if f1_micro > best_f1:
			best_f1, best_thr = f1_micro, thr

	print("best_thr", best_thr, "best_f1_micro", best_f1)

	import datetime
	datetime_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
	trainer.save_model(os.path.join(DATA_DIR, f"finetuned_text_labeller_parliament/final/"))




# ## Youtube data labelling

# In[ ]:


import os
import numpy as np
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
)
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

if False:
	# --- Load + split ---
	ds = Dataset.from_json(YOUTUBE_DATA_PROCESSED_PATH).train_test_split(test_size=0.2, seed=42)
	ds = ds.rename_column("label", "labels")  # original field contains one-hot vectors

	# --- Tokenizer ---
	tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)


	MAX_LEN = 256

	def onehot_to_id(v):
		v = np.asarray(v)
		if v.sum() != 1:
			raise ValueError(f"Not a single-class one-hot label: sum={v.sum()}, v={v}")
		id = v.argmax()
		return id

	def tok(batch):
		out = tokenizer(batch["text"], truncation=True, max_length=MAX_LEN)
		out["labels"] = [onehot_to_id(v) for v in batch["labels"]]  # ints for single-class

		return out

	ds = ds.map(tok, batched=True, remove_columns=["text", "text_label"])

	from collections import Counter
	c = Counter(ds["test"]["labels"])
	print("Counter", c)

	# --- Model (FULL fine-tuning, no LoRA/PEFT) ---
	num_labels = 2
	model = AutoModelForSequenceClassification.from_pretrained(
		MODEL_NAME,
		num_labels=num_labels,
		device_map="auto",  # remove if you want explicit .to(device)
	)

	# Label metadata (saved into config for HF)
	model.config.id2label = {i: lab for i, lab in enumerate(["政治", "その他"])}
	model.config.label2id = {lab: i for i, lab in enumerate(["政治", "その他"])}
	model.config.num_labels = num_labels

	# --- Metrics ---
	def compute_metrics(eval_pred):
		logits, labels = eval_pred
		preds = np.argmax(logits, axis=-1)
		return {
			"accuracy": accuracy_score(labels, preds),
			"f1_macro": f1_score(labels, preds, average="macro", zero_division=0),
			"f1_micro": f1_score(labels, preds, average="micro", zero_division=0),
			"precision_macro": precision_score(labels, preds, average="macro", zero_division=0),
			"recall_macro": recall_score(labels, preds, average="macro", zero_division=0),
		}

	# --- Training args ---
	args = TrainingArguments(
		output_dir=os.path.join(DATA_DIR, "finetuned_text_labeller_youtube"),
		learning_rate=2e-5,
		per_device_train_batch_size=16, 
		per_device_eval_batch_size=32,
		num_train_epochs=5,
		eval_strategy="epoch",
		save_strategy="epoch",
		load_best_model_at_end=True,
		metric_for_best_model="f1_macro",   # or "accuracy"
		greater_is_better=True,
		logging_steps=50,
	)

	data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

	trainer = Trainer(
		model=model,
		args=args,
		train_dataset=ds["train"],
		eval_dataset=ds["test"],
		tokenizer=tokenizer,
		data_collator=data_collator,
		compute_metrics=compute_metrics,
	)

	trainer.train()
	metrics = trainer.evaluate()
	print(metrics)

	# --- Save final (best model if load_best_model_at_end=True) ---
	OUT_DIR = os.path.join(DATA_DIR, "finetuned_text_labeller_youtube", "final")
	trainer.save_model(OUT_DIR)
	tokenizer.save_pretrained(OUT_DIR)


# ## Training classifier for twitter data

# In[5]:


import os
import numpy as np
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
)
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

if False:

	# --- Load + split ---
	ds = Dataset.from_json(TWITTER_DATA_PROCESSED_PATH).train_test_split(test_size=0.2, seed=42)
	ds = ds.rename_column("label", "labels")  # original field contains one-hot vectors

	# --- Tokenizer ---
	tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False)


	MAX_LEN = 256

	def onehot_to_id(v):
		v = np.asarray(v)
		if v.sum() != 1:
			raise ValueError(f"Not a single-class one-hot label: sum={v.sum()}, v={v}")
		id = v.argmax()
		if id >= 1:
			return 1
		return 0

	def tok(batch):
		out = tokenizer(batch["text"], truncation=True, max_length=MAX_LEN)
		out["labels"] = [onehot_to_id(v) for v in batch["labels"]]  # ints for single-class

		return out

	ds = ds.map(tok, batched=True, remove_columns=["text", "text_label"])

	from collections import Counter
	c = Counter(ds["test"]["labels"])
	print("Counter", c)

	# --- Model (FULL fine-tuning, no LoRA/PEFT) ---
	num_labels = 2
	model = AutoModelForSequenceClassification.from_pretrained(
		MODEL_NAME,
		num_labels=num_labels,
		device_map="auto",  # remove if you want explicit .to(device)
	)

	# Label metadata (saved into config for HF)
	model.config.id2label = {i: lab for i, lab in enumerate(["政治", "その他"])}
	model.config.label2id = {lab: i for i, lab in enumerate(["政治", "その他"])}
	model.config.num_labels = num_labels

	# --- Metrics ---
	def compute_metrics(eval_pred):
		logits, labels = eval_pred
		preds = np.argmax(logits, axis=-1)
		return {
			"accuracy": accuracy_score(labels, preds),
			"f1_macro": f1_score(labels, preds, average="macro", zero_division=0),
			"f1_micro": f1_score(labels, preds, average="micro", zero_division=0),
			"precision_macro": precision_score(labels, preds, average="macro", zero_division=0),
			"recall_macro": recall_score(labels, preds, average="macro", zero_division=0),
		}

	# --- Training args ---
	args = TrainingArguments(
		output_dir=os.path.join(DATA_DIR, "finetuned_text_labeller_twitter"),
		learning_rate=2e-5,
		per_device_train_batch_size=16,
		per_device_eval_batch_size=32,
		num_train_epochs=5,
		eval_strategy="epoch",
		save_strategy="epoch",
		load_best_model_at_end=True,
		metric_for_best_model="f1_macro",   # or "accuracy"
		greater_is_better=True,
		logging_steps=50,
	)

	data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

	trainer = Trainer(
		model=model,
		args=args,
		train_dataset=ds["train"],
		eval_dataset=ds["test"],
		tokenizer=tokenizer,
		data_collator=data_collator,
		compute_metrics=compute_metrics,
	)

	trainer.train()
	metrics = trainer.evaluate()
	print(metrics)

	# --- Save final (best model if load_best_model_at_end=True) ---
	OUT_DIR = os.path.join(DATA_DIR, "finetuned_text_labeller_twitter", "final")
	trainer.save_model(OUT_DIR)
	tokenizer.save_pretrained(OUT_DIR)


# ## Upload to Huggingface Hub

# In[ ]:


import os
from transformers import AutoConfig
from huggingface_hub import create_repo, upload_folder
from params.paths import DATA_DIR



BASE_MODEL = "ku-nlp/deberta-v3-base-japanese"  # <--


REPO_NAMES = [
    "text_labeller_parliament-deberta-v3-base-japanese",
	"text_labeller_youtube-full-deberta-v3-base-japanese",
    "text_labeller_twitter-full-deberta-v3-base-japanese",
]

DIRECTORIES = [
    "finetuned_text_labeller_parliament/20260114_003748/",
	"finetuned_text_labeller_youtube/final/",
    "finetuned_text_labeller_twitter/final",
]

REPO_ID = "kkatodus"

PARLIAMENT_SPEECH_LABELS = [
    "質問文",
    "追及・確認文",
    "答弁文",
    "反論・再反論文",
    "意見文",
    "要望・提案文",
    "批判文",
    "評価文",
    "説明文",
    "事実文",
    "謝罪・釈明文",
    "手続・運営文",
    "その他"
]

YOUTUBE_SPEECH_LABELS = [
	"政治",
	"その他",
]
	

TWITTER_SPEECH_LABELS = [
    "政治",
    "その他"
]

LABELS_LIST = [
    PARLIAMENT_SPEECH_LABELS, 
	YOUTUBE_SPEECH_LABELS,
    TWITTER_SPEECH_LABELS]

for repo_name, ckpt_dir, labels in zip(REPO_NAMES, DIRECTORIES, LABELS_LIST):
    print(f"Processing {repo_name} from {ckpt_dir} with {len(labels)} labels...")
    local_path = os.path.join(DATA_DIR, ckpt_dir)

    id2label = {i: label for i, label in enumerate(labels)}
    label2id = {label: i for i, label in enumerate(labels)}
    # 1️⃣ Load config
    config = AutoConfig.from_pretrained(BASE_MODEL)

    # 2️⃣ Inject label metadata
    config.id2label = id2label
    config.label2id = label2id
    config.num_labels = len(labels)
    print("config.num_labels:", config.num_labels)
    if not "twitter" in repo_name:
        config.problem_type = "multi_label_classification"

    # 3️⃣ Save config back (this updates config.json)
    config.save_pretrained(local_path)

    # 4️⃣ Create repo + upload
    create_repo(repo_id=f"{REPO_ID}/{repo_name}", exist_ok=True)

    upload_folder(
        repo_id=f"{REPO_ID}/{repo_name}",
        folder_path=local_path,
        repo_type="model",
    )


# In[ ]:





# In[ ]:




