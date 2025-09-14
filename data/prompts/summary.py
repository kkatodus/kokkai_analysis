from params.paths import ROOT_DIR
import os
import tiktoken

OPENAI_TOKEN_LIMIT = 128000
txts_dir = os.path.join(ROOT_DIR, 'prompts', 'txts')


class SummaryPrompt:
	def __init__(self, gpt_model='gpt-4o-mini'):
		self.enc = tiktoken.encoding_for_model(gpt_model)
	def generate_summary_prompt(self, opinions, topic):
		with open(os.path.join(txts_dir, 'summary.txt'), 'r', encoding='utf-8') as f:
			instruction = f.read()

		instruction = instruction.replace('TOPIC', topic)
		opinions_str = '\n'.join(opinions)
		while len(self.enc.encode(instruction) + self.enc.encode(opinions_str)) > OPENAI_TOKEN_LIMIT:
			print('Shortening opinions')
			opinions = opinions[:int(len(opinions)*0.9)]
			opinions_str = '\n'.join(opinions)

		return f'{instruction}\n\n{opinions_str}'