"""Batch LLM providers behind one interface: Claude Message Batches (the default) and
Gemini Batch (the fallback).

A job builds provider-neutral `BatchRequest`s, calls `submit_with_fallback`, and later
collects `BatchResult`s with `client_for(model)`. The model id names the provider
(claude-* / gemini-*), so a batch recorded in label_batch.model is always collected
from the provider that ran it. Submission falls back to the other provider when the
primary one can't take the batch (missing key, auth or billing error, quota, outage);
the caller gets a note for Slack.

Claude: api.anthropic.com Message Batches via the official `anthropic` SDK. Results
keep for 29 days. Keys become `custom_id`s, which only allow [A-Za-z0-9_-] (see
`encode_key`). Claude 5.5 models think by default and reject sampling parameters, so
`effort` steers depth and `temperature` is Gemini-only.
Gemini: see gemini_batch.py.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, Iterator, List, Optional, Tuple

from .gemini_batch import DONE_STATES, GeminiBatch

log = logging.getLogger("speech_quality.batch")

# Japanese text, measured on the same gold prompts: Gemini 5,968 vs Claude 10,156 input tokens
# per exchange (0.56 and 0.95 tokens per char). Claude's output count includes its thinking.
TOKENS_PER_CHAR = {"claude": 1.0, "gemini": 0.6}
OUTPUT_FACTOR = {"claude": 2.0, "gemini": 1.0}


class BatchUnavailable(RuntimeError):
	"""The provider can't take this batch right now (no key, auth, billing, quota, outage)."""


class FallbackOverBudget(BatchUnavailable):
	"""The primary provider is unavailable and the fallback's budget doesn't cover the batch."""


@dataclass
class BatchRequest:
	key: str
	system: str
	user: str
	json_schema: Optional[dict] = None     # structured JSON output
	temperature: Optional[float] = None    # Gemini only
	max_tokens: int = 4096                 # Claude only; thinking counts toward it
	effort: str = "low"                    # Claude output_config.effort / Gemini thinkingLevel


@dataclass
class BatchResult:
	key: str
	text: str = ""
	input_tokens: int = 0                  # everything billed as input, cache reads and writes included
	output_tokens: int = 0
	cache_read: int = 0
	cache_write: int = 0
	error: Optional[str] = None            # set when the request produced no usable answer


def provider_for(model: str) -> str:
	if model.startswith("claude-"):
		return "claude"
	if model.startswith("gemini-"):
		return "gemini"
	raise ValueError(f"unknown provider for model {model!r}")


def tokens_est(model: str, chars: int) -> int:
	return int(chars * TOKENS_PER_CHAR[provider_for(model)])


def output_est(model: str, gemini_est: int) -> int:
	"""Expected output tokens per request, from the Gemini-measured baseline."""
	return int(gemini_est * OUTPUT_FACTOR[provider_for(model)])


def strict(schema):
	"""Claude's structured output wants additionalProperties: false on every object."""
	if isinstance(schema, dict):
		out = {k: strict(v) for k, v in schema.items()}
		if out.get("type") == "object":
			out["additionalProperties"] = False
		return out
	if isinstance(schema, list):
		return [strict(v) for v in schema]
	return schema


def encode_key(key: str) -> str:
	"""Reversible map of any key onto Claude's custom_id alphabet [A-Za-z0-9_-]."""
	return re.sub(r"[^A-Za-z0-9-]", lambda m: f"_{ord(m.group()):02x}_", key)


def decode_key(custom_id: str) -> str:
	return re.sub(r"_([0-9a-f]{2})_", lambda m: chr(int(m.group(1), 16)), custom_id)


class BatchClient:
	provider: str

	def submit(self, model: str, requests: List[BatchRequest], display_name: str, work_dir: Path) -> str:
		"""Submit one batch; returns its name. Raises BatchUnavailable if the provider can't take it."""
		raise NotImplementedError

	def check(self, name: str) -> Tuple[str, Optional[str]]:
		"""("running" | "ended" | "failed", error text for failed)."""
		raise NotImplementedError

	def results(self, name: str) -> Iterator[BatchResult]:
		raise NotImplementedError


class ClaudeBatch(BatchClient):
	provider = "claude"

	def __init__(self, api_key: Optional[str] = None):
		key = api_key or os.environ.get("ANTHROPIC_API_KEY")
		if not key:
			raise BatchUnavailable("ANTHROPIC_API_KEY not set")
		import anthropic  # the Gemini path must work without the package

		self.sdk = anthropic
		self.client = anthropic.Anthropic(api_key=key, max_retries=4)

	@staticmethod
	def params(model: str, r: BatchRequest) -> dict:
		p = {
			"model": model,
			"max_tokens": r.max_tokens,
			# the shared system prompt is cached across the batch
			"system": [{"type": "text", "text": r.system, "cache_control": {"type": "ephemeral"}}],
			"messages": [{"role": "user", "content": r.user}],
			"output_config": {"effort": r.effort},
		}
		if r.json_schema is not None:
			p["output_config"]["format"] = {"type": "json_schema", "schema": strict(r.json_schema)}
		return p

	def submit(self, model: str, requests: List[BatchRequest], display_name: str, work_dir: Path) -> str:
		reqs = [{"custom_id": encode_key(r.key), "params": self.params(model, r)} for r in requests]
		try:
			batch = self.client.messages.batches.create(requests=reqs)
		except (self.sdk.APIStatusError, self.sdk.APIConnectionError) as e:
			raise BatchUnavailable(f"claude: {_short(e)}") from e
		return batch.id

	def check(self, name: str) -> Tuple[str, Optional[str]]:
		b = self.client.messages.batches.retrieve(name)
		if b.processing_status != "ended":
			return "running", None
		return "ended", None

	def results(self, name: str) -> Iterator[BatchResult]:
		for item in self.client.messages.batches.results(name):
			yield self.normalize(item)

	@staticmethod
	def normalize(item) -> BatchResult:
		"""One MessageBatchIndividualResponse → BatchResult."""
		out = BatchResult(key=decode_key(item.custom_id))
		res = item.result
		if res.type != "succeeded":
			err = getattr(res, "error", None)
			out.error = f"{res.type}: {getattr(err, 'type', '')} {getattr(err, 'message', '')}".strip()
			return out
		msg = res.message
		u = msg.usage
		out.cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
		out.cache_write = getattr(u, "cache_creation_input_tokens", 0) or 0
		out.input_tokens = (u.input_tokens or 0) + out.cache_read + out.cache_write
		out.output_tokens = u.output_tokens or 0
		if msg.stop_reason == "refusal":
			d = getattr(msg, "stop_details", None)
			out.error = f"refusal: {getattr(d, 'category', None)} {getattr(d, 'explanation', '') or ''}".strip()
			return out
		out.text = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text")
		if msg.stop_reason == "max_tokens":
			out.error = "max_tokens: answer cut off"
		return out


class GeminiBatchClient(BatchClient):
	provider = "gemini"

	def __init__(self, api_key: Optional[str] = None):
		key = api_key or os.environ.get("GEMINI_API_KEY")
		if not key:
			raise BatchUnavailable("GEMINI_API_KEY not set")
		self.gb = GeminiBatch(key)
		self._jobs: Dict[str, dict] = {}

	@staticmethod
	def line(r: BatchRequest) -> dict:
		gen: dict = {"thinkingConfig": {"thinkingLevel": r.effort}}
		if r.temperature is not None:
			gen["temperature"] = r.temperature
		if r.json_schema is not None:
			gen["responseMimeType"] = "application/json"
			gen["responseJsonSchema"] = r.json_schema
		return {
			"key": r.key,
			"request": {
				"systemInstruction": {"parts": [{"text": r.system}]},
				"contents": [{"role": "user", "parts": [{"text": r.user}]}],
				"generationConfig": gen,
			},
		}

	def submit(self, model: str, requests: List[BatchRequest], display_name: str, work_dir: Path) -> str:
		work_dir.mkdir(parents=True, exist_ok=True)
		path = work_dir / f"{datetime.now():%Y%m%d-%H%M%S-%f}-{display_name}.jsonl"
		with open(path, "w", encoding="utf-8") as f:
			for r in requests:
				f.write(json.dumps(self.line(r), ensure_ascii=False) + "\n")
		try:
			file_name = self.gb.upload(path, display_name)
			return self.gb.create(model, file_name, display_name)
		except (RuntimeError, OSError) as e:
			raise BatchUnavailable(f"gemini: {_short(e)}") from e
		finally:
			path.unlink(missing_ok=True)  # the request is rebuilt from the mirror if it has to be resent

	def check(self, name: str) -> Tuple[str, Optional[str]]:
		job = self.gb.get(name)
		state = self.gb.state(job)
		if state not in DONE_STATES:
			return "running", None
		if not state.endswith("SUCCEEDED"):
			return "failed", json.dumps(job.get("error") or job.get("metadata", {}).get("error") or state, ensure_ascii=False)[:2000]
		self._jobs[name] = job
		return "ended", None

	def results(self, name: str) -> Iterator[BatchResult]:
		job = self._jobs.get(name) or self.gb.get(name)
		out_file = self.gb.result_file(job)
		if not out_file:
			raise RuntimeError(f"batch {name} succeeded but has no responses file: {json.dumps(job)[:500]}")
		for line in self.gb.download(out_file):
			yield self.normalize(line)

	@staticmethod
	def normalize(line: dict) -> BatchResult:
		out = BatchResult(key=line.get("key", ""))
		resp = line.get("response") or {}
		u = resp.get("usageMetadata") or {}
		out.input_tokens = u.get("promptTokenCount", 0)
		out.output_tokens = u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)
		if line.get("error"):
			out.error = json.dumps(line["error"], ensure_ascii=False)[:300]
			return out
		try:
			parts = resp["candidates"][0]["content"]["parts"]
			out.text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
		except (KeyError, IndexError, TypeError):
			out.error = f"no candidate: {json.dumps(resp, ensure_ascii=False)[:200]}"
		return out


_CLIENTS: Dict[str, BatchClient] = {}


def client_for(model: str) -> BatchClient:
	"""One client per provider for the process. Raises BatchUnavailable when its key is missing."""
	provider = provider_for(model)
	if provider not in _CLIENTS:
		_CLIENTS[provider] = ClaudeBatch() if provider == "claude" else GeminiBatchClient()
	return _CLIENTS[provider]


def submit_with_fallback(model: str, fallback_model: Optional[str], requests: List[BatchRequest], display_name: str,
		work_dir: Path, fallback_blocked: Optional[Callable[[str], Optional[str]]] = None) -> Tuple[str, str, Optional[str]]:
	"""Submit to `model`'s provider, or to `fallback_model`'s when that one can't take the batch.

	`fallback_blocked(fallback_model)` may return a reason (e.g. the fallback's cap is reached), in which
	case FallbackOverBudget is raised instead of submitting there.
	Returns (model actually used, batch name, note for the report or None)."""
	try:
		return model, client_for(model).submit(model, requests, display_name, work_dir), None
	except BatchUnavailable as e:
		if not fallback_model or provider_for(fallback_model) == provider_for(model):
			raise
		reason = fallback_blocked(fallback_model) if fallback_blocked else None
		if reason:
			raise FallbackOverBudget(f"{model} unavailable ({e}); {fallback_model} not used: {reason}") from e
		log.warning("%s unavailable (%s); falling back to %s", model, e, fallback_model)
		name = client_for(fallback_model).submit(fallback_model, requests, display_name, work_dir)
		return fallback_model, name, f"{model} unavailable ({e}); used {fallback_model}"


def _short(e: BaseException) -> str:
	return f"{type(e).__name__}: {str(e)[:300]}"


__all__ = ["BatchRequest", "BatchResult", "BatchUnavailable", "FallbackOverBudget", "BatchClient", "ClaudeBatch", "GeminiBatchClient",
	"client_for", "submit_with_fallback", "provider_for", "tokens_est", "output_est", "strict", "encode_key", "decode_key"]
