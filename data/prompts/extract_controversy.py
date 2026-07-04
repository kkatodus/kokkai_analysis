from params.paths import ROOT_DIR
import os

from prompts.prompt_utils import fit_prompt_with_items

txts_dir = os.path.join(ROOT_DIR, 'prompts', 'txts')
BREAK_STR = '--------------------------------------------------------'


class ExtractControversyPrompt:
	def generate_axis_extraction_prompt(self, summaries, topic):
		with open(os.path.join(txts_dir, 'quantify_repr_stances', 'extract_axis.txt'), 'r', encoding='utf-8') as f:
			instruction = f.read()
		instruction = instruction.replace('TOPIC', topic)
		return fit_prompt_with_items(instruction, summaries, suffix=BREAK_STR)
