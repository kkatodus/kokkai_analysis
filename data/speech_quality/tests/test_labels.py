import json
import tempfile
import unittest
from pathlib import Path

from speech_quality import labels
from speech_quality.label_job import take


def speech(i, header, text="質問です。" * 20, order=None):
	return {"speechID": f"X_{i:03d}", "speechOrder": i if order is None else order, "speaker": header.strip("○委員君"),
		"speakerGroup": "自由民主党", "speech": f"○{header}　{text}"}


MEETING = [
	{"speechID": "X_000", "speechOrder": 0, "speaker": "会議録情報", "speech": "前付"},
	speech(1, "委員長（山田君）", "これより会議を開きます。"),
	speech(2, "佐藤委員"),
	speech(3, "国務大臣（林君）", "お答えします。" * 20),
	speech(4, "鈴木委員"),
	speech(5, "国務大臣（林君）", "お答えします。" * 20),
]


def row(start, **kw):
	r = {"start_speech_id": start, "issue_id": "I20250101", "speech_ids": [start], "model": "m", "prompt_version": "v3",
		"function": "policy", "contribution": "substantive", "issues": [], "responsible": "neither", "outcomes": [],
		"topic": "other", "reason": "理由"}
	r.update(kw)
	return r


class LabelsTest(unittest.TestCase):
	def setUp(self):
		self.tmp = tempfile.TemporaryDirectory()
		self.issues = Path(self.tmp.name)
		d = self.issues / "I20250101"
		d.mkdir()
		(d / "meta.json").write_text(json.dumps({"date": "2025-01-01", "nameOfHouse": "衆議院", "nameOfMeeting": "内閣委員会"}))
		(d / "speeches.jsonl").write_text("".join(json.dumps(s, ensure_ascii=False) + "\n" for s in MEETING))

	def tearDown(self):
		self.tmp.cleanup()

	def lines(self):
		return [json.loads(l) for l in (self.issues / "I20250101" / "speeches.jsonl").read_text().splitlines()]

	def test_units(self):
		units = labels.units_for_issue(self.issues, "I20250101")
		self.assertEqual([u.key for u in units], ["X_002", "X_004"])
		self.assertEqual(len(units[1].earlier), 1)

	def test_plenary_skipped(self):
		(self.issues / "I20250101" / "meta.json").write_text(json.dumps({"date": "2025-01-01", "nameOfMeeting": "本会議"}))
		self.assertEqual(labels.units_for_issue(self.issues, "I20250101"), [])

	def test_productive_counts_only_most(self):
		self.assertTrue(labels.productive({"contribution": "limited", "issues": [{"type": "softball", "by": "questioner", "extent": "part"}]}))
		self.assertFalse(labels.productive({"contribution": "limited", "issues": [{"type": "softball", "by": "questioner", "extent": "most"}]}))
		self.assertTrue(labels.productive({"contribution": "limited", "issues": [{"type": "evasive", "by": "answerer", "extent": "most"}]}))
		self.assertFalse(labels.productive({"contribution": "none", "issues": []}))

	def test_write_puts_label_on_first_speech_and_clears_stale(self):
		labels.write_issue(self.issues, "I20250101", [row("X_004", issues=[{"type": "grandstanding", "by": "questioner", "extent": "most"}])])
		ls = self.lines()
		self.assertEqual(ls[4]["is_productive"], "False")
		self.assertEqual(ls[4]["quality"]["function"], "policy")
		self.assertNotIn("quality", ls[2])
		self.assertTrue(labels.write_issue(self.issues, "I20250101", [row("X_002")]))
		ls = self.lines()
		self.assertNotIn("quality", ls[4])
		self.assertEqual(ls[2]["is_productive"], "True")
		self.assertFalse(labels.write_issue(self.issues, "I20250101", [row("X_002")]))

	def test_hash_changes_with_text(self):
		u = labels.units_for_issue(self.issues, "I20250101")[0]
		h = u.content_hash
		u.exchange.turns[0].text += "訂正"
		self.assertNotEqual(h, u.content_hash)

	def test_take_respects_budget(self):
		units = labels.units_for_issue(self.issues, "I20250101")

		class Cur:
			def execute(self, *a):
				pass

			def fetchone(self):
				return (1000.0, 1000.0)  # $1000 per 1M tokens: each unit costs about $1

		for model in ("gemini-3.8-flash", "claude-opus-5-5"):
			self.assertEqual(len(take(iter(units), 10, 1e9, Cur(), model)), 2)
			self.assertEqual(len(take(iter(units), 1, 1e9, Cur(), model)), 1)
			self.assertEqual(take(iter(units), 10, 0.01, Cur(), model), [])


if __name__ == "__main__":
	unittest.main()
