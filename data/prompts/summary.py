from params.paths import ROOT_DIR
import os

from prompts.prompt_utils import fit_prompt_with_items

txts_dir = os.path.join(ROOT_DIR, 'prompts', 'txts')


class SummaryPrompt:
	def generate_summary_prompt(self, opinions, topic):
		with open(os.path.join(txts_dir, 'quantify_repr_stances', 'summary.txt'), 'r', encoding='utf-8') as f:
			instruction = f.read()

		instruction = instruction.replace('TOPIC', topic)
		return fit_prompt_with_items(instruction, opinions)
