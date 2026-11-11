import json
import tempfile
import unittest
from pathlib import Path

from speech_quality import publish


def row(start, issue="I20250101", date="2025-01-01", q=1, a=(9,), **kw):
	r = {"start_speech_id": start, "issue_id": issue, "speech_ids": [start, f"{issue}_{int(start[-3:]) + 1:03d}"],
		"date": date, "questioner": "甲", "questioner_group": "A党", "questioner_person_id": q, "answerer_person_ids": list(a),
		"function": "policy", "contribution": "substantive", "issues": [], "responsible": "neither", "outcomes": ["proposal"],
		"topic": "other", "reason": "理由", "model": "gemini-3.8-flash"}
	r.update(kw)
	return r


ROWS = [
	row("I20250101_002"),
	row("I20250101_010", contribution="limited", responsible="questioner",
		issues=[{"type": "softball", "by": "questioner", "extent": "most"}], outcomes=[]),
	row("I20240601_004", issue="I20240601", date="2024-06-01", q=2, a=(1,), questioner_group="B党", function="oversight",
		issues=[{"type": "evasive", "by": "answerer", "extent": "part"}], outcomes=["new_information"], responsible="answerer"),
	row("I20240601_020", issue="I20240601", date="2024-06-01", q=None, a=(9,)),
]


class PublishTest(unittest.TestCase):
	def test_aggregate_counts_per_role(self):
		agg = publish.aggregate(ROWS, {1: "甲", 2: "乙", 9: "大臣"})
		self.assertEqual(agg["coverage"], {"from": "2024-06-01", "to": "2025-01-01", "exchanges": 4, "meetings": 2})
		self.assertEqual(agg["models"], {"gemini-3.8-flash": 4})
		by = {p["person_id"]: p for p in agg["persons"]}
		self.assertEqual(sorted(by), [1, 2, 9])
		p1 = by[1]
		self.assertEqual(p1["group"], "A党")
		self.assertEqual(p1["as_questioner"]["n"], 2)
		self.assertEqual(p1["as_questioner"]["contribution"], {"substantive": 1, "limited": 1, "none": 0})
		self.assertEqual(p1["as_questioner"]["issues"]["softball"], {"part": 0, "most": 1})
		self.assertEqual(p1["as_questioner"]["outcomes"]["proposal"], 1)
		self.assertEqual(p1["as_questioner"]["flagged"], {"any": 1, "most": 1})
		self.assertEqual(p1["as_answerer"]["flagged"], {"any": 1, "most": 0})
		# person 1 also answered person 2's exchange and was flagged evasive there
		self.assertEqual(p1["as_answerer"]["n"], 1)
		self.assertEqual(p1["as_answerer"]["issues"]["evasive"], {"part": 1, "most": 0})
		self.assertEqual(p1["as_answerer"]["outcomes"]["new_information"], 1)
		# the minister only answers: no questioner counts, no group
		self.assertIsNone(by[9]["as_questioner"])
		self.assertIsNone(by[9]["group"])
		self.assertEqual(by[9]["as_answerer"]["n"], 3)
		# totals count every row once, including the unmatched questioner
		self.assertEqual(agg["totals"]["as_questioner"]["n"], 4)
		self.assertEqual(agg["totals"]["as_questioner"]["function"]["oversight"], 1)

	def test_person_lines_roles_and_order(self):
		lines = publish.person_lines(ROWS, 1, {"I20250101": ("衆議院", "内閣委員会")})
		self.assertEqual([l["role"] for l in lines], ["questioner", "questioner", "answerer"])
		self.assertEqual(lines[0]["start_speech_id"], "I20250101_010")  # newest first, later exchange first
		self.assertEqual(lines[0]["orders"], [10, 11])
		self.assertEqual(lines[0]["meeting"], "内閣委員会")
		self.assertIsNone(lines[2]["meeting"])
		self.assertEqual(lines[2]["issues"][0]["type"], "evasive")

	def test_persons_in(self):
		self.assertEqual(publish.persons_in(ROWS), {1, 2, 9})


if __name__ == "__main__":
	unittest.main()


class SiteStatsTest(unittest.TestCase):
	def test_counts_shares_and_current_only_rankings(self):
		agg = publish.aggregate(ROWS, {1: "甲", 2: "乙", 9: "大臣"})
		current = {
			1: {"house": "lower", "group": "A党", "name": "甲 太郎", "terms_lower": 3},
			9: {"house": "lower", "group": "与党", "name": "大臣", "terms_lower": 8},
			7: {"house": "upper", "group": "C党", "name": "丙", "terms_lower": None},
		}
		doc = publish.site_stats(agg, current, {1: "甲", 9: "大臣", 7: "丙"}, {1: 40, 7: 90, 2: 500},
			{"speeches": 630, "meetings": 12, "from": "2000-01-20"}, 4815)
		self.assertEqual(doc["current_members"], {"lower": 2, "upper": 1})
		self.assertNotIn("data_bytes", doc)
		self.assertEqual(publish.site_stats(agg, current, {}, {}, {"speeches": 0, "meetings": 0, "from": None}, 0,
			data_bytes=123)["data_bytes"], 123)
		self.assertEqual(doc["labels"]["exchanges"], 4)
		self.assertEqual(doc["labels"]["persons"], 3)
		self.assertEqual(doc["function_share"]["oversight"], 0.25)
		self.assertEqual(doc["contribution_share"]["substantive"], 0.75)
		# softball (most) + evasive (part) on different rows: each counted once
		self.assertEqual(doc["issue_share"]["softball"], 0.25)
		self.assertEqual(doc["issue_share"]["evasive"], 0.25)
		# person 2 is not sitting: excluded from every ranking even with the most speeches
		self.assertEqual([p["person_id"] for p in doc["top_speakers_current"]], [7, 1])
		self.assertEqual(doc["top_speakers_current"][0], {"person_id": 7, "name": "丙", "group": "C党", "n": 90})
		self.assertEqual([p["person_id"] for p in doc["top_questioners_current"]], [1])
		self.assertEqual([(p["person_id"], p["n"]) for p in doc["top_answerers_current"]], [(9, 3), (1, 1)])
		# terms only for the lower house
		self.assertEqual([(p["person_id"], p["n"]) for p in doc["top_terms_lower_current"]], [(9, 8), (1, 3)])

	def test_current_members_reads_newest_snapshot(self):
		with tempfile.TemporaryDirectory() as d:
			m = Path(d) / "parliamentMembers"
			m.mkdir()
			(m / "shugiin_20250101.json").write_text(json.dumps({"reprs": [{"person_id": 1, "kaiha": "旧", "name": "x"}]}))
			(m / "shugiin_20260101.json").write_text(json.dumps({"reprs": [
				{"person_id": 2, "kaiha": "自民", "name": "逢沢  一郎", "number_of_terms_lower": 14},
				{"person_id": None, "kaiha": "無", "name": "y"}]}), encoding="utf-8")
			(m / "sangiin_20260101.json").write_text(json.dumps({"reprs": [{"person_id": "5", "kaiha": "立憲", "name": "z"}]}))
			cur = publish.current_members(Path(d))
		self.assertEqual(sorted(cur), [2, 5])
		self.assertEqual(cur[2], {"house": "lower", "group": "自民", "name": "逢沢 一郎", "terms_lower": 14})
		self.assertEqual(cur[5]["house"], "upper")
		self.assertIsNone(cur[5]["terms_lower"])

