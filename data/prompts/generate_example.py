from params.paths import ROOT_DIR
import os

txts_dir = os.path.join(ROOT_DIR, 'prompts', 'txts')

def generate_example_prompt(topic, stance):
    with open(os.path.join(txts_dir, 'generate_example.txt'), 'r', encoding='utf-8') as f:
        instruction = f.read()

    instruction = instruction.replace('TOPIC', topic)
    instruction = instruction.replace('STANCE', stance)
    return  instruction
