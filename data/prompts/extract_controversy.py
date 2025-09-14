from params.paths import ROOT_DIR
import os
import tiktoken

txts_dir = os.path.join(ROOT_DIR, 'prompts', 'txts')
OPENAI_TOKEN_LIMIT = 128000

class ExtractControversyPrompt:
	def __init__(self, gpt_model='gpt-4o-mini'):
		self.enc = tiktoken.encoding_for_model(gpt_model)


	def generate_axis_extraction_prompt(self, summaries, topic):
		with open(os.path.join(txts_dir, 'extract_axis.txt'), 'r', encoding='utf-8') as f:
			instruction = f.read()
		instruction = instruction.replace('TOPIC', topic)
		summaries_str = '\n'.join(summaries)
		break_str = '--------------------------------------------------------'

		while len(self.enc.encode(instruction) + self.enc.encode(summaries_str) + self.enc.encode(break_str)) > OPENAI_TOKEN_LIMIT:
			print('Shortening summaries')
			summaries = summaries[:int(len(summaries)*0.9)]
			summaries_str = '\n'.join(summaries)

		return f'{instruction}\n\n{summaries_str}\n\n{break_str}'
