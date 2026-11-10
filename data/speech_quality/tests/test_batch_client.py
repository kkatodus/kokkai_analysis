import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest import mock

from speech_quality import batch_client as bc
from speech_quality.batch_client import (BatchRequest, BatchUnavailable, ClaudeBatch, FallbackOverBudget,
	GeminiBatchClient, decode_key, encode_key, output_est, provider_for, submit_with_fallback, tokens_est)
from speech_quality.labels import parse_labels


class ProviderTest(unittest.TestCase):
	def test_provider_and_estimates(self):
		self.assertEqual(provider_for("claude-opus-5-5"), "claude")
		self.assertEqual(provider_for("gemini-3.8-flash"), "gemini")
		with self.assertRaises(ValueError):
			provider_for("gpt-5")
		self.assertGreater(tokens_est("claude-opus-5-5", 1000), tokens_est("gemini-3.8-flash", 1000))
		self.assertEqual(output_est("gemini-3.8-flash", 160), 160)
		self.assertGreater(output_est("claude-opus-5-5", 160), 160)

	def test_key_roundtrip(self):
		for key in ("121505254X00120260115", "10:NuclearPower:0", "a_b c/d"):
			cid = encode_key(key)
			self.assertRegex(cid, r"^[A-Za-z0-9_-]+$")
			self.assertEqual(decode_key(cid), key)


class ClaudeParamsTest(unittest.TestCase):
	def test_params_shape(self):
		r = BatchRequest(key="k", system="S", user="U", json_schema={"type": "object", "properties": {"a": {"type": "string"}}},
			temperature=0, max_tokens=4096, effort="low")
		p = ClaudeBatch.params("claude-opus-5-5", r)
		self.assertEqual(p["model"], "claude-opus-5-5")
		self.assertNotIn("temperature", p)              # Claude 5.5 rejects sampling parameters
		self.assertNotIn("thinking", p)                 # adaptive by default; effort steers depth
		self.assertEqual(p["output_config"]["effort"], "low")
		self.assertEqual(p["output_config"]["format"]["type"], "json_schema")
		self.assertIs(p["output_config"]["format"]["schema"]["additionalProperties"], False)
		self.assertEqual(p["system"][0]["cache_control"], {"type": "ephemeral"})
		self.assertEqual(p["messages"], [{"role": "user", "content": "U"}])
		p2 = ClaudeBatch.params("claude-opus-5-5", BatchRequest(key="k", system="S", user="U"))
		self.assertNotIn("format", p2["output_config"])

	def test_normalize_success_refusal_error(self):
		usage = NS(input_tokens=100, output_tokens=20, cache_read_input_tokens=50, cache_creation_input_tokens=10)
		ok = NS(custom_id=encode_key("10:T:0"), result=NS(type="succeeded", message=NS(stop_reason="end_turn", usage=usage,
			content=[NS(type="thinking", thinking=""), NS(type="text", text='{"a": 1}')])))
		res = ClaudeBatch.normalize(ok)
		self.assertEqual((res.key, res.text, res.input_tokens, res.output_tokens, res.cache_read, res.cache_write, res.error),
			("10:T:0", '{"a": 1}', 160, 20, 50, 10, None))
		refused = NS(custom_id="k", result=NS(type="succeeded", message=NS(stop_reason="refusal", usage=usage, content=[],
			stop_details=NS(category="cyber", explanation="no"))))
		self.assertTrue(ClaudeBatch.normalize(refused).error.startswith("refusal: cyber"))
		errored = NS(custom_id="k", result=NS(type="errored", error=NS(type="invalid_request", message="bad")))
		res = ClaudeBatch.normalize(errored)
		self.assertEqual(res.error, "errored: invalid_request bad")
		self.assertEqual(res.input_tokens, 0)


class GeminiLineTest(unittest.TestCase):
	def test_line_shape(self):
		r = BatchRequest(key="k", system="S", user="U", json_schema={"type": "object"}, temperature=0, effort="low")
		line = GeminiBatchClient.line(r)
		gen = line["request"]["generationConfig"]
		self.assertEqual(line["key"], "k")
		self.assertEqual(gen["temperature"], 0)
		self.assertEqual(gen["responseMimeType"], "application/json")
		self.assertEqual(gen["thinkingConfig"], {"thinkingLevel": "low"})
		self.assertEqual(line["request"]["systemInstruction"]["parts"][0]["text"], "S")
		gen2 = GeminiBatchClient.line(BatchRequest(key="k", system="S", user="U"))["request"]["generationConfig"]
		self.assertNotIn("temperature", gen2)
		self.assertNotIn("responseJsonSchema", gen2)

	def test_normalize(self):
		line = {"key": "k", "response": {"candidates": [{"content": {"parts": [{"thought": True, "text": "hmm"}, {"text": "{}"}]}}],
			"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2, "thoughtsTokenCount": 3}}}
		res = GeminiBatchClient.normalize(line)
		self.assertEqual((res.text, res.input_tokens, res.output_tokens, res.error), ("{}", 10, 5, None))
		self.assertTrue(GeminiBatchClient.normalize({"key": "k", "error": {"code": 400}}).error)


class FakeClient:
	def __init__(self, fail=None):
		self.fail, self.calls = fail, []

	def submit(self, model, requests, display_name, work_dir):
		self.calls.append(model)
		if self.fail:
			raise BatchUnavailable(self.fail)
		return f"{model}-batch"


class FallbackTest(unittest.TestCase):
	def test_primary_then_fallback(self):
		claude, gemini = FakeClient(fail="claude: AuthenticationError"), FakeClient()
		clients = {"claude": claude, "gemini": gemini}
		with mock.patch.object(bc, "client_for", side_effect=lambda m: clients[provider_for(m)]):
			used, name, note = submit_with_fallback("claude-opus-5-5", "gemini-3.8-flash", [], "d", Path("/tmp"))
			self.assertEqual((used, name), ("gemini-3.8-flash", "gemini-3.8-flash-batch"))
			self.assertIn("claude-opus-5-5 unavailable", note)
			claude.fail = None
			used, name, note = submit_with_fallback("claude-opus-5-5", "gemini-3.8-flash", [], "d", Path("/tmp"))
			self.assertEqual((used, note), ("claude-opus-5-5", None))

	def test_fallback_blocked_by_budget(self):
		clients = {"claude": FakeClient(fail="credits gone"), "gemini": FakeClient()}
		with mock.patch.object(bc, "client_for", side_effect=lambda m: clients[provider_for(m)]):
			with self.assertRaises(FallbackOverBudget) as cm:
				submit_with_fallback("claude-sonnet-5-5", "gemini-3.8-flash", [], "d", Path("/tmp"), lambda m: "cap reached")
			self.assertIn("cap reached", str(cm.exception))
			self.assertEqual(clients["gemini"].calls, [])
			used, _, _ = submit_with_fallback("claude-sonnet-5-5", "gemini-3.8-flash", [], "d", Path("/tmp"), lambda m: None)
			self.assertEqual(used, "gemini-3.8-flash")

	def test_no_fallback_raises(self):
		with mock.patch.object(bc, "client_for", return_value=FakeClient(fail="down")):
			with self.assertRaises(BatchUnavailable):
				submit_with_fallback("claude-opus-5-5", None, [], "d", Path("/tmp"))
			with self.assertRaises(BatchUnavailable):  # same provider is not a fallback
				submit_with_fallback("claude-opus-5-5", "claude-haiku-5-5", [], "d", Path("/tmp"))

	def test_missing_key_falls_back(self):
		bc._CLIENTS.clear()
		with mock.patch.dict("os.environ", {"ANTHROPIC_API_KEY": "", "GEMINI_API_KEY": "g"}):
			with mock.patch.object(GeminiBatchClient, "submit", return_value="batches/1"):
				used, name, note = submit_with_fallback("claude-opus-5-5", "gemini-3.8-flash", [], "d", Path("/tmp"))
		bc._CLIENTS.clear()
		self.assertEqual((used, name), ("gemini-3.8-flash", "batches/1"))
		self.assertIn("ANTHROPIC_API_KEY not set", note)


class ParseLabelsTest(unittest.TestCase):
	def test_parse(self):
		good = '{"function": "policy", "issues": [], "contribution": "substantive", "responsible": "neither", "outcomes": [], "topic": "t", "reason": "r"}'
		self.assertEqual(parse_labels(good)["function"], "policy")
		self.assertIsNone(parse_labels("not json"))
		self.assertIsNone(parse_labels('{"function": "policy"}'))


if __name__ == "__main__":
	unittest.main()
