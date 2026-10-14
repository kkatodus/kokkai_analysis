import re

def clean_repr_name(repr_name):
	repr_name = re.sub(r'\s|君|\[(.*?)\]', '', repr_name)
	return repr_name