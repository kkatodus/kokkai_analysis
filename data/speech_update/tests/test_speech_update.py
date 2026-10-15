"""Unit tests. Run from data/:  python -m unittest discover -s speech_update/tests -t ."""
from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from speech_update import resolver as resolver_mod
from speech_update.fetch import diff_issue, fetch, latest_issue_date, read_issue
from speech_update.models import META_KEYS, meeting_from_api
from speech_update.ndl_client import NdlClient, NdlError, NdlRejected
from speech_update.resolver import SpeakerResolver, party_matches
from speech_update.review_store import Decision, ReviewKey
from speech_update.route import Router, merge_person_file, remove_from_person_dir, sort_lines
from speech_update.state import State
from speech_update.upload import Uploader, upload_order
from speech_update.variants import normalise_name, same_name

TOPICS = [{"topic_name_en": "Defence", "search_words": ["防衛"]}]


def speech(issue: str, order: int, speaker="山田一郎", text="発言", group="自由民主党", update="2026-10-01 00:00:00") -> dict:
	return {
		"speechID": f"{issue}_{order:03d}", "speechOrder": order, "speaker": speaker,
		"speakerYomi": "やまだいちろう", "speakerGroup": group, "speakerPosition": None,
		"speakerRole": None, "speech": text, "startPage": 1, "createTime": "2026-10-01 00:00:00",
		"updateTime": update, "speechURL": f"https://kokkai.ndl.go.jp/txt/{issue}/{order}",
	}


def api_meeting(issue: str, day: str, speeches) -> dict:
	return {
		"issueID": issue, "imageKind": "会議録", "searchObject": 0, "session": 222,
		"nameOfHouse": "衆議院", "nameOfMeeting": "予算委員会", "issue": "第1号", "date": day,
		"closing": None, "meetingURL": f"https://kokkai.ndl.go.jp/txt/{issue}", "pdfURL": None,
		"speechRecord": speeches,
	}


class FakeResponse:
	def __init__(self, status: int, body=None, text=""):
		self.status_code = status
		self._body = body
		self.text = text or json.dumps(body or {})

	def json(self):
		if self._body is None:
			raise ValueError("not json")
		return self._body


class FakeSession:
	def __init__(self, responses):
		self.responses = list(responses)
		self.headers = {}
		self.calls = []

	def get(self, url, params=None, timeout=None):
		self.calls.append(dict(params))
		return self.responses.pop(0)


def client_with(responses) -> NdlClient:
	return NdlClient(min_interval=0, session=FakeSession(responses), sleep=lambda s: None)


class ModelsTest(unittest.TestCase):
	def test_single_speech_dict_becomes_list_and_meta_shape(self):
		m = meeting_from_api(api_meeting("X1", "2026-10-05", speech("X1", 1)))
		self.assertEqual(len(m.speechRecord), 1)
		self.assertEqual(tuple(m.meta_dict()), META_KEYS)
		self.assertNotIn("meetingURL", m.meta_dict())
		self.assertEqual(m.speech_dicts()[0], speech("X1", 1))


class NdlClientTest(unittest.TestCase):
	def test_pages_until_next_record_position_is_empty(self):
		c = client_with([
			FakeResponse(200, {"numberOfRecords": 2, "nextRecordPosition": 2, "meetingRecord": [api_meeting("A", "2026-10-01", [])]}),
			FakeResponse(200, {"numberOfRecords": 2, "nextRecordPosition": None, "meetingRecord": api_meeting("B", "2026-10-02", [])}),
		])
		ids = [m["issueID"] for m in c.iter_meetings(date(2026, 10, 1), date(2026, 10, 2))]
		self.assertEqual(ids, ["A", "B"])
		self.assertEqual([p["startRecord"] for p in c.session.calls], [1, 2])

	def test_retries_5xx_and_bad_json(self):
		c = client_with([FakeResponse(503), FakeResponse(200, None, "<html>"), FakeResponse(200, {"numberOfRecords": 0})])
		self.assertEqual(list(c.iter_meetings(date(2026, 1, 1), date(2026, 1, 2))), [])
		self.assertEqual(c.requests_made, 3)

	def test_gives_up_after_max_tries(self):
		c = client_with([FakeResponse(500)] * 5)
		with self.assertRaises(NdlError):
			list(c.iter_meetings(date(2026, 1, 1), date(2026, 1, 2)))

	def test_4xx_is_not_retried(self):
		c = client_with([FakeResponse(403, None, "blocked")])
		with self.assertRaises(NdlRejected):
			list(c.iter_meetings(date(2026, 1, 1), date(2026, 1, 2)))
		self.assertEqual(c.requests_made, 1)

	def test_user_agent_overrides_requests_default(self):
		c = client_with([])
		self.assertTrue(c.session.headers["User-Agent"].startswith("kokkai-doc-speech-update"))


class FetchTest(unittest.TestCase):
	def setUp(self):
		self.tmp = tempfile.TemporaryDirectory()
		self.issues = Path(self.tmp.name) / "issues"
		self.issues.mkdir()

	def tearDown(self):
		self.tmp.cleanup()

	def _page(self, *meetings):
		return FakeResponse(200, {"numberOfRecords": len(meetings), "nextRecordPosition": None, "meetingRecord": list(meetings)})

	def test_new_then_unchanged_then_changed(self):
		m = api_meeting("X20261005", "2026-10-05", [speech("X20261005", 1)])
		r1 = fetch(client_with([self._page(m)]), self.issues, date(2026, 10, 1), date(2026, 10, 6))
		self.assertEqual(r1.new, ["X20261005"])
		meta, speeches = read_issue(self.issues / "X20261005")
		self.assertIsNone(meta["nextRecordPosition"])
		self.assertEqual(speeches, [speech("X20261005", 1)])

		r2 = fetch(client_with([self._page(m)]), self.issues, date(2026, 10, 1), date(2026, 10, 6))
		self.assertEqual((r2.new, r2.changed), ([], []))

		m2 = api_meeting("X20261005", "2026-10-05", [speech("X20261005", 1, text="訂正", update="2026-10-09 00:00:00")])
		r3 = fetch(client_with([self._page(m2)]), self.issues, date(2026, 10, 1), date(2026, 10, 6))
		self.assertEqual(r3.changed, ["X20261005"])

	def test_dry_run_writes_nothing(self):
		m = api_meeting("X20261005", "2026-10-05", [speech("X20261005", 1)])
		r = fetch(client_with([self._page(m)]), self.issues, date(2026, 10, 1), date(2026, 10, 6), dry_run=True)
		self.assertEqual(r.new, ["X20261005"])
		self.assertIn("X20261005", r.meetings)
		self.assertFalse((self.issues / "X20261005").exists())

	def test_removed_speech_is_reported(self):
		existing = ({"issueID": "X"}, [speech("X", 1), speech("X", 2)])
		status, removed = diff_issue(existing, meeting_from_api(api_meeting("X", "2026-10-05", [speech("X", 1)])))
		self.assertEqual((status, removed), ("changed", ["X_002"]))

	def test_existing_next_record_position_is_ignored(self):
		m = meeting_from_api(api_meeting("X", "2026-10-05", [speech("X", 1)]))
		meta = m.meta_dict() | {"nextRecordPosition": 11}
		self.assertEqual(diff_issue((meta, m.speech_dicts()), m), (None, []))

	def test_latest_issue_date_from_ids(self):
		for i in ("121904293X00120251126", "122215382X00120261005", "notanissue"):
			(self.issues / i).mkdir()
		self.assertEqual(latest_issue_date(self.issues), date(2026, 10, 5))


class RouteTest(unittest.TestCase):
	def setUp(self):
		self.tmp = tempfile.TemporaryDirectory()
		self.persons = Path(self.tmp.name) / "repr_speeches_id_organized"

	def tearDown(self):
		self.tmp.cleanup()

	def _lines(self, pid, stem="all_speeches"):
		with open(self.persons / str(pid) / f"{stem}.jsonl", encoding="utf-8") as f:
			return [json.loads(l) for l in f]

	def test_sort_newest_meeting_first_then_speech_order(self):
		lines = [
			{"speechID": "a", "speechOrder": 2, "meta": {"date": "2025-01-01", "issueID": "A"}},
			{"speechID": "b", "speechOrder": 5, "meta": {"date": "2026-01-01", "issueID": "B"}},
			{"speechID": "c", "speechOrder": 1, "meta": {"date": "2026-01-01", "issueID": "B"}},
			{"speechID": "d", "speechOrder": 1, "meta": {"date": "2025-01-01", "issueID": "A"}},
		]
		self.assertEqual([l["speechID"] for l in sort_lines(lines)], ["c", "b", "d", "a"])

	def test_merge_replaces_adds_and_skips_noop(self):
		path = self.persons / "1" / "all_speeches.jsonl"
		meta = {"date": "2026-01-01", "issueID": "B"}
		first = {"x": {"speechID": "x", "speechOrder": 1, "speech": "old", "meta": meta}}
		self.assertEqual(merge_person_file(path, first, dry_run=False), (1, 0, True))
		self.assertEqual(merge_person_file(path, first, dry_run=False), (0, 0, False))
		second = {
			"x": {"speechID": "x", "speechOrder": 1, "speech": "new", "meta": meta},
			"y": {"speechID": "y", "speechOrder": 2, "speech": "y", "meta": meta},
		}
		self.assertEqual(merge_person_file(path, second, dry_run=False), (1, 1, True))
		self.assertEqual([(l["speechID"], l["speech"]) for l in self._lines(1)], [("x", "new"), ("y", "y")])

	def test_merge_keeps_fields_added_by_other_pipelines(self):
		path = self.persons / "1" / "all_speeches.jsonl"
		meta = {"date": "2026-01-01", "issueID": "B"}
		annotated = {"speechID": "x", "speechOrder": 1, "speech": "old", "meta": meta, "is_relevant": True, "quality_reason": "r"}
		merge_person_file(path, {"x": annotated}, dry_run=False)
		plain = {"speechID": "x", "speechOrder": 1, "speech": "old", "meta": meta}
		self.assertEqual(merge_person_file(path, {"x": plain}, dry_run=False), (0, 0, False))
		corrected = dict(plain, speech="new")
		self.assertEqual(merge_person_file(path, {"x": corrected}, dry_run=False), (0, 1, True))
		self.assertEqual(self._lines(1)[0], dict(corrected, is_relevant=True, quality_reason="r"))

	def test_route_merges_topics_and_queues_unmatched_members(self):
		resolver = mock.Mock()
		resolver.resolve.side_effect = lambda speaker, yomi, group, d: {
			"会議録情報": resolver_mod.Resolution(None, "procedural"),
			"山田一郎": resolver_mod.Resolution(7, "name"),
			"新人議員": resolver_mod.Resolution(None, "not_found"),
			"政府参考人": resolver_mod.Resolution(None, "not_found"),
		}[speaker]
		meta = {"issueID": "B", "date": "2026-10-05"}
		speeches = [
			speech("B", 0, speaker="会議録情報", group=None),
			speech("B", 1, text="防衛について"),
			speech("B", 2, speaker="新人議員"),
			speech("B", 3, speaker="政府参考人", group=None),
			speech("B", 4),
		]
		r = Router(resolver, self.persons, TOPICS).route([(meta, speeches)])
		self.assertEqual((r.matched, r.procedural, r.non_member_skipped, r.added), (2, 1, 1, 2))
		self.assertEqual([u["speaker"] for u in r.unmatched_members], ["新人議員"])
		self.assertEqual(sorted(r.paths_written), ["repr_speeches_id_organized/7/Defence.jsonl", "repr_speeches_id_organized/7/all_speeches.jsonl"])
		self.assertEqual([l["speechID"] for l in self._lines(7, "Defence")], ["B_001"])
		self.assertEqual(self._lines(7)[0]["meta"], meta)

	def test_dry_run_route_writes_nothing(self):
		resolver = mock.Mock()
		resolver.resolve.return_value = resolver_mod.Resolution(7, "name")
		r = Router(resolver, self.persons, TOPICS, dry_run=True).route([({"issueID": "B", "date": "2026-10-05"}, [speech("B", 1)])])
		self.assertEqual(r.added, 1)
		self.assertFalse(self.persons.exists())


class ResolverTest(unittest.TestCase):
	def test_party_matches_whole_names_only(self):
		self.assertTrue(party_matches("自由民主党", "自由民主党・無所属の会"))
		self.assertTrue(party_matches("立憲民主党", "立憲民主党・社民・無所属"))
		self.assertTrue(party_matches("自由民主党", "自民党"))
		self.assertFalse(party_matches("民主党", "自由民主党・無所属の会"))
		self.assertFalse(party_matches(None, "自由民主党"))

	def _resolver(self, wins):
		cur = mock.Mock()
		cur.fetchall.side_effect = lambda: wins[cur.execute.call_args[0][1][0]]
		return SpeakerResolver(cur, flag=False)

	def test_same_name_disambiguated_by_winning_party_before_meeting(self):
		# 鬼木誠: 1070 LDP (lower house), 3960 CDP (upper house, from 2022)
		wins = {
			1070: [(date(2012, 12, 16), "自由民主党", "当選")],
			3960: [(date(2022, 7, 10), "立憲民主党", "当選")],
		}
		people = [mock.Mock(person_id=1070), mock.Mock(person_id=3960)]
		with mock.patch.object(resolver_mod, "get_politician_id_by_name", return_value=None), \
			mock.patch.object(resolver_mod, "get_person_by_column", return_value=people):
			r = self._resolver(wins)
			self.assertEqual(r.resolve("鬼木誠", "おにきまこと", "立憲民主・社民・無所属", "2023-03-01"), resolver_mod.Resolution(3960, "disambiguated"))
			self.assertEqual(r.resolve("鬼木誠", "おにきまこと", "社民・無所属", "2023-03-01").reason, "ambiguous")
			self.assertEqual(r.resolve("鬼木誠", "おにきまこと", "立憲民主党・社民・無所属", "2023-03-01"), resolver_mod.Resolution(3960, "disambiguated"))
			self.assertEqual(r.resolve("鬼木誠", "おにきまこと", "自由民主党・無所属の会", "2023-03-01"), resolver_mod.Resolution(1070, "disambiguated"))
			# CDP win is after this meeting date
			self.assertEqual(r.resolve("鬼木誠", "おにきまこと", "立憲民主党・社民・無所属", "2020-01-01").reason, "ambiguous")

	def test_same_name_disambiguated_by_kana(self):
		# 大津力: 5278 おおつとむ, 5727 おおつつとむ
		people = [mock.Mock(person_id=5278), mock.Mock(person_id=5727)]
		lookup = lambda cur, col, val: people if col == "name_kanji" else [p for p in people if val == "おおつつとむ" and p.person_id == 5727]
		with mock.patch.object(resolver_mod, "get_politician_id_by_name", return_value=None), \
			mock.patch.object(resolver_mod, "get_person_by_column", side_effect=lookup):
			self.assertEqual(self._resolver({}).resolve("大津力", "おおつつとむ", "参政党", "2026-03-01"), resolver_mod.Resolution(5727, "disambiguated"))

	def test_duplicate_person_rows_stay_unmatched(self):
		wins = {2603: [(date(2024, 10, 27), "立憲民主党", "当選")], 5724: [(date(2024, 10, 27), "立憲民主党", "当選")]}
		people = [mock.Mock(person_id=2603), mock.Mock(person_id=5724)]
		with mock.patch.object(resolver_mod, "get_politician_id_by_name", return_value=None), \
			mock.patch.object(resolver_mod, "get_person_by_column", return_value=people):
			self.assertEqual(self._resolver(wins).resolve("寺田学", "てらたまなぶ", "立憲民主党・無所属", "2026-03-01").reason, "ambiguous")

	def test_procedural_and_cache(self):
		with mock.patch.object(resolver_mod, "get_politician_id_by_name", return_value=10) as g:
			r = SpeakerResolver(mock.Mock(), flag=False)
			self.assertEqual(r.resolve("会議録情報", None, None, "2026-01-01").reason, "procedural")
			self.assertEqual(r.resolve("", None, None, "2026-01-01").reason, "procedural")
			r.resolve("菅野和太郎", "かんのわたろう", "自由民主党", "1969-01-01")
			r.resolve("菅野和太郎", "かんのわたろう", "自由民主党", "1970-01-01")
			self.assertEqual(g.call_count, 1)


class VariantsTest(unittest.TestCase):
	def test_old_forms_and_kana_match_but_different_characters_do_not(self):
		self.assertTrue(same_name("宮澤喜一", "宮沢喜一"))
		self.assertTrue(same_name("淡谷悠藏", "淡谷悠蔵"))
		self.assertTrue(same_name("佐佐弘雄", "佐々弘雄"))
		self.assertTrue(same_name("春名直章", "春名 直章"))
		self.assertEqual(normalise_name("ジョッキ"), normalise_name("ジョツキ"))
		self.assertFalse(same_name("中村正雄", "中村正男"))
		self.assertFalse(same_name("太田正孝", "太田昌孝"))


class ConfidenceTest(unittest.TestCase):
	PEOPLE = {
		2648: ("中村正男", "なかむらまさお"),
		1977: ("鈴木俊一", "すずきしゅんいち"),
		3631: ("福島瑞穂", "ふくしまみずほ"),
		111: ("宮沢喜一", "みやざわきいち"),
		500: ("中村正雄", "なかむらまさお"),
	}
	TERMS = {
		2648: [(date(1983, 12, 18), date(1997, 8, 17))],
		1977: [(date(1990, 2, 18), date(2030, 3, 10))],
		3631: [(date(1998, 7, 12), date(2030, 8, 1))],
		111: [(date(1953, 4, 24), date(1996, 11, 19))],
		500: [(date(1947, 4, 25), date(1987, 8, 1))],
	}

	def resolve(self, speaker, yomi, pid, day, decisions=None, group="会派"):
		r = SpeakerResolver(mock.Mock(), decisions=decisions or {})
		r._people = self.PEOPLE
		r._terms = self.TERMS
		with mock.patch.object(resolver_mod, "get_politician_id_by_name", return_value=pid):
			return r.resolve(speaker, yomi, group, day)

	def test_service_terms(self):
		elections = [
			(date(1983, 12, 18), "衆", True),
			(date(1986, 7, 6), "衆", False),   # lost: the 1983 term ends here
			(date(1990, 2, 18), "衆", True),   # no later election: full 4-year term
			(date(1995, 7, 23), "参", True),
			(date(1999, 4, 1), None, True),    # local election: no term
		]
		self.assertEqual(resolver_mod.service_terms(elections), [
			(date(1983, 12, 18), date(1986, 8, 5)),
			(date(1990, 2, 18), date(1994, 3, 20)),
			(date(1995, 7, 23), date(2001, 8, 22)),
		])
		self.assertEqual(resolver_mod.election_house("補欠選挙", "大分県選挙区"), "参")
		self.assertEqual(resolver_mod.election_house("補欠選挙", "愛媛2区"), "衆")
		self.assertEqual(resolver_mod.election_house("同", "東海ブロック"), "衆")
		self.assertIsNone(resolver_mod.election_house("浦安市議会議員選挙", "千葉県浦安市"))

	def test_sure_matches(self):
		self.assertEqual(self.resolve("宮澤喜一", "みやざわきいち", 111, "1975-01-01").confidence, "sure")
		self.assertEqual(self.resolve("福島みずほ", "ふくしまみずほ", 3631, "2005-01-01").confidence, "sure")
		self.assertEqual(self.resolve("鈴木俊一", "すずきしゅんいち", 1977, "2000-01-01", group=None).confidence, "sure")

	def test_flags(self):
		r = self.resolve("中村正雄", "なかむらまさお", 2648, "1985-01-01")
		self.assertEqual((r.person_id, r.confidence, r.review_key), (2648, "review", ReviewKey("中村正雄", "なかむらまさお", 2648, "kanji_differs")))
		# a member (has a group) outside the known terms: election data gap or someone else
		self.assertEqual(self.resolve("宮澤喜一", "みやざわきいち", 111, "2005-01-01").review_key.reason, "out_of_term")
		self.assertEqual(self.resolve("福島みずほ", "ふくしまみづほ", 3631, "2005-01-01").review_key.reason, "kanji_differs")

	def test_not_serving_is_dropped_without_review(self):
		# 鈴木俊一 the civil servant, 1960: no group, outside #1977's terms
		r = self.resolve("鈴木俊一", "", 1977, "1960-01-01", group=None)
		self.assertEqual((r.person_id, r.reason, r.confidence), (None, "not_serving", "sure"))
		self.assertEqual(r.review_key, ReviewKey("鈴木俊一", "", 1977, "not_serving"))
		# even when the kanji differ
		self.assertEqual(self.resolve("中村正雄", "なかむらまさお", 2648, "1960-01-01", group=None).reason, "not_serving")
		# a "confirmed" decision overrides
		key = ReviewKey("鈴木俊一", "", 1977, "not_serving")
		r = self.resolve("鈴木俊一", "", 1977, "1960-01-01", {key: Decision(1, "confirmed")}, group=None)
		self.assertEqual((r.person_id, r.confidence), (1977, "sure"))

	def test_decisions_override(self):
		key = ReviewKey("中村正雄", "なかむらまさお", 2648, "kanji_differs")
		day = "1985-01-01"
		r = self.resolve("中村正雄", "なかむらまさお", 2648, day, {key: Decision(1, "reassigned", 500)})
		self.assertEqual((r.person_id, r.confidence, r.reason), (500, "sure", "reviewed"))
		r = self.resolve("中村正雄", "なかむらまさお", 2648, day, {key: Decision(1, "unlinked")})
		self.assertEqual((r.person_id, r.reason), (None, "unlinked"))
		r = self.resolve("中村正雄", "なかむらまさお", 2648, day, {key: Decision(1, "confirmed")})
		self.assertEqual((r.person_id, r.confidence), (2648, "sure"))
		r = self.resolve("中村正雄", "なかむらまさお", 2648, day, {key: Decision(1, "pending")})
		self.assertEqual(r.confidence, "review")


class ReviewRouteTest(unittest.TestCase):
	def setUp(self):
		self.tmp = tempfile.TemporaryDirectory()
		self.persons = Path(self.tmp.name) / "repr_speeches_id_organized"

	def tearDown(self):
		self.tmp.cleanup()

	def test_held_and_unlinked_speeches_are_not_filed(self):
		key = ReviewKey("山田一郎", "やまだいちろう", 7, "out_of_term")
		gone = ReviewKey("鈴木太郎", "", 9, "not_serving")
		resolver = mock.Mock()
		resolver.resolve.side_effect = lambda speaker, yomi, group, d: {
			"山田一郎": resolver_mod.Resolution(7, "name", "review", key),
			"田中次郎": resolver_mod.Resolution(None, "unlinked", "sure", key),
			"佐藤三郎": resolver_mod.Resolution(8, "name"),
			"鈴木太郎": resolver_mod.Resolution(None, "not_serving", "sure", gone),
		}[speaker]
		meta = {"issueID": "B", "date": "2026-10-05"}
		speeches = [speech("B", 1), speech("B", 2), speech("B", 3, speaker="田中次郎"), speech("B", 4, speaker="佐藤三郎"),
			speech("B", 5, speaker="鈴木太郎", group=None)]
		r = Router(resolver, self.persons, TOPICS).route([(meta, speeches)])
		self.assertEqual((r.matched, r.held_speeches, r.unlinked, r.not_serving, r.added), (1, 2, 1, 1, 1))
		self.assertEqual(list(r.dropped), [gone])
		self.assertEqual(r.held[key].issues, {"B": [2, "2026-10-05", "2026-10-05"]})
		self.assertEqual(r.held[key].samples, ["B_001", "B_002"])
		self.assertFalse((self.persons / "7").exists())
		self.assertEqual(r.unmatched_members, [])

	def test_remove_from_person_dir(self):
		meta = {"date": "2026-01-01", "issueID": "B"}
		line = lambda sid: {"speechID": sid, "speechOrder": 1, "meta": meta}
		merge_person_file(self.persons / "7" / "all_speeches.jsonl", {s: line(s) for s in ("a", "b", "c")}, dry_run=False)
		merge_person_file(self.persons / "7" / "Defence.jsonl", {"b": line("b")}, dry_run=False)
		removed, written = remove_from_person_dir(self.persons, 7, {"b", "zz"}, dry_run=False)
		self.assertEqual(removed, 1)
		self.assertEqual(written, ["repr_speeches_id_organized/7/Defence.jsonl", "repr_speeches_id_organized/7/all_speeches.jsonl"])
		with open(self.persons / "7" / "all_speeches.jsonl", encoding="utf-8") as f:
			self.assertEqual([json.loads(l)["speechID"] for l in f], ["a", "c"])
		self.assertEqual((self.persons / "7" / "Defence.jsonl").read_text(), "")
		self.assertEqual(remove_from_person_dir(self.persons, 99, {"a"}, dry_run=False), (0, []))


class StateTest(unittest.TestCase):
	def test_pending_sets_and_unmatched_replacement(self):
		with tempfile.TemporaryDirectory() as tmp:
			s = State(Path(tmp))
			s.add_pending_issues(["B", "A"])
			s.add_pending_issues(["A", "C"])
			s.clear_pending_issues(["A", "B"])
			self.assertEqual(s.pending_issues(), ["C"])
			s.clear_pending_issues(["C"])
			self.assertFalse(s.changed_issues_path.exists())

			e1 = {"speaker": "新人", "speakerYomi": "しんじん", "speakerGroup": "X", "issueID": "I1"}
			e2 = dict(e1, issueID="I2")
			self.assertEqual(s.record_unmatched([e1, e2]), [e1, e2])
			self.assertEqual(s.record_unmatched([e1]), [])
			# re-routing I1 resolved the speaker there
			s.record_unmatched([], replacing_issues=["I1"])
			self.assertEqual(s.unmatched(), [e2])

	def test_lock_is_exclusive(self):
		from speech_update.state import LockHeld
		with tempfile.TemporaryDirectory() as tmp:
			a, b = State(Path(tmp)), State(Path(tmp))
			a.acquire_lock()
			with self.assertRaises(LockHeld):
				b.acquire_lock()
			a.release_lock()
			b.acquire_lock()
			b.release_lock()


class UploadTest(unittest.TestCase):
	def test_issues_first_and_progress_reported(self):
		issues, others = upload_order(["repr_speeches_id_organized/1/all_speeches.jsonl", "issues/X/meta.json", "issues/X/speeches.jsonl"])
		self.assertEqual(issues, ["issues/X/meta.json", "issues/X/speeches.jsonl"])
		self.assertEqual(others, ["repr_speeches_id_organized/1/all_speeches.jsonl"])

		client = mock.Mock()
		done = []
		u = Uploader(Path("/mirror"), "bucket", "kokkai-doc", None, workers=1, client=client)
		n = u.upload(issues + others, on_done=done.extend)
		self.assertEqual(n, 3)
		keys = [c.args[2] for c in client.upload_file.call_args_list]
		self.assertEqual(keys[-1], "kokkai-doc/repr_speeches_id_organized/1/all_speeches.jsonl")
		self.assertEqual(client.upload_file.call_args_list[0].kwargs["ExtraArgs"], {"ContentType": "application/json"})
		self.assertEqual(sorted(done), sorted(issues + others))

	def test_person_files_not_uploaded_if_an_issue_fails(self):
		client = mock.Mock()
		client.upload_file.side_effect = lambda local, bucket, key, ExtraArgs: (_ for _ in ()).throw(OSError("boom")) if key.endswith("meta.json") else None
		done = []
		u = Uploader(Path("/mirror"), "bucket", "kokkai-doc", None, workers=1, client=client)
		with self.assertRaises(RuntimeError):
			u.upload(["issues/X/meta.json", "issues/X/speeches.jsonl", "repr_speeches_id_organized/1/all_speeches.jsonl"], on_done=done.extend)
		self.assertEqual(done, ["issues/X/speeches.jsonl"])


if __name__ == "__main__":
	unittest.main()
