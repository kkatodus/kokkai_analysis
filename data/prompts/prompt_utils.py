DEFAULT_MAX_PROMPT_CHARS = 300_000


def fit_prompt_with_items(
	instruction: str,
	items: list[str],
	*,
	suffix: str = "",
	max_chars: int = DEFAULT_MAX_PROMPT_CHARS,
	separator: str = "\n",
) -> str:
	"""Shrink a list of text blocks until the full prompt fits within a char budget."""
	working_items = list(items)
	while working_items:
		body = separator.join(working_items)
		prompt = f"{instruction}\n\n{body}"
		if suffix:
			prompt = f"{prompt}\n\n{suffix}"
		if len(prompt) <= max_chars:
			return prompt
		print("Shortening prompt content")
		next_len = max(1, int(len(working_items) * 0.9))
		if next_len >= len(working_items):
			break
		working_items = working_items[:next_len]

	body = separator.join(working_items)
	prompt = f"{instruction}\n\n{body}"
	if suffix:
		prompt = f"{prompt}\n\n{suffix}"
	return prompt
