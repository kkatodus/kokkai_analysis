import re

def clean_repr_name(repr_name):
	repr_name = re.sub('\s|君|\[(.*?)\]', '', repr_name)
	return repr_name