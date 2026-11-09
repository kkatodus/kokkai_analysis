"""Unit tests. Run from data/:  python -m unittest discover -s member_update/tests -t ."""
from __future__ import annotations

import gzip
import json
import tempfile
import unittest
from pathlib import Path

from member_update.match import MatchResult, MemberMatcher, link_key
from member_update.people import InvalidPerson, append_table_row, csv_field, table_row, validate
from member_update.snapshot import diff, latest_snapshot, render
from member_update.sources import parse_sangiin_page, parse_shugiin_page, parse_terms, sangiin_redirect

SHUGIIN_HTML = """<TABLE><TR VALIGN = top>
<TD class="sh1td1"><TT><center><B>氏名</B></center></TT></TD><TD><B>ふりがな</B></TD><TD><B>会派</B></TD><TD><B>選挙区</B></TD><TD><B>当選回数</B></TD></TR>
<TR VALIGN = top><TD class="sh1td5"><TT class="sh1tt1"><a
href='../../../../itdb_giinprof.nsf/html/profile/001.html'>逢沢　　一郎君</a>
</TT></TD>
<TD class="sh1td6"><TT class="sh1tt1">あいさわ
　いちろう
</TT></TD>
<TD class="sh1td7"><TT class="sh1tt1"><CENTER>自民
</CENTER></TT></TD>
<TD class="sh1td5"><TT class="sh1tt1">岡山1
</TT></TD>
<TD class="sh1td8"><TT class="sh1tt1"><CENTER>14
</CENTER></TT></TD>
</TR>
<TR VALIGN = top><TD><a href='../../../../itdb_giinprof.nsf/html/profile/300.html'>畑野　君枝君</a></TD>
<TD>はたの　きみえ</TD><TD>共産</TD><TD>（比）南関東</TD><TD>2（参1）</TD></TR>
</TABLE>"""

SHUGIIN_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm"

SANGIIN_HTML = """<table class="list" summary="議員一覧（50音順）">
<tr><th>&nbsp;</th><th>議員氏名</th><th>読み方</th><th>会派</th><th>選挙区</th><th>任期満了</th><th>&nbsp;</th></tr>
<tr><th rowspan="14"><b>あ</b></th>
<td><a href="../profile/7007006.htm" class="Graylink">青木　　　愛</a></td>
<td>あおき　あい</td><td>立憲</td><td>比例</td><td>令和10年7月25日</td><td>&nbsp;
</td></tr>
<tr><td><a href="../profile/7019003.htm" class="Graylink">石垣　のりこ<BR>[小川　のり子]</a></td>
<td>いしがき　のりこ</td><td>立憲</td><td>宮城</td><td>令和13年7月28日</td><td>&nbsp;</td></tr>
</table>"""

SANGIIN_URL = "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/222/giin.htm"


def row(name, yomi, kaiha="自民", district="東京1", pid=None):
	return {"name": name, "kaiha": kaiha, "district": district, "yomikata": yomi,
		"number_of_terms_lower": 1, "number_of_terms_upper": 0, "link": None, "period": None, "person_id": pid}


class ParseTests(unittest.TestCase):
	def test_shugiin_rows_match_existing_snapshot_format(self):
		rows = parse_shugiin_page(SHUGIIN_HTML, SHUGIIN_URL)
		self.assertEqual(rows[0], {
			"name": "逢沢  一郎", "kaiha": "自民", "district": "岡山1", "yomikata": "あいさわ  いちろう",
			"number_of_terms_lower": 14, "number_of_terms_upper": 0,
			"link": "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/001.html",
			"period": None, "person_id": None,
		})
		# only the trailing 君 goes (the old cleaner turned 畑野君枝 into 畑野枝)
		self.assertEqual(rows[1]["name"], "畑野 君枝")
		self.assertEqual((rows[1]["number_of_terms_lower"], rows[1]["number_of_terms_upper"]), (2, 1))

	def test_sangiin_rows_keep_maiden_name_and_absolute_link(self):
		rows = parse_sangiin_page(SANGIIN_HTML, SANGIIN_URL)
		self.assertEqual([r["name"] for r in rows], ["青木   愛", "石垣 のりこ [小川 のり子]"])
		self.assertEqual(rows[0]["link"], "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/profile/7007006.htm")
		self.assertEqual(rows[0]["period"], "令和10年7月25日")
		self.assertIsNone(rows[0]["number_of_terms_upper"])

	def test_sangiin_redirect(self):
		html = '<SCRIPT>location.replace("/japanese/joho1/kousei/giin/222/giin.htm")</SCRIPT>'
		self.assertEqual(sangiin_redirect(html, "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/current/giin.htm"), SANGIIN_URL)

	def test_parse_terms(self):
		self.assertEqual(parse_terms("14　　 　\n"), (14, 0))
		self.assertEqual(parse_terms("1（参2）"), (1, 2))
		self.assertEqual(parse_terms(""), (None, 0))


class MatchTests(unittest.TestCase):
	PERSONS = [
		(1, "逢沢一郎", "あいさわいちろう"),
		(2, "上野蛍", "うえのほたる"),
		(3, "鬼木誠", "おにきまこと"), (4, "鬼木誠", "おにきまこと"),
		(5, "宮澤洋一", "みやざわよういち"),
		(6, "佐藤一", "さとうはじめ"), (7, "佐藤肇", "さとうはじめ"),
	]

	def match(self, rows, previous=(), links=None, house="shugiin"):
		result = MatchResult()
		MemberMatcher(self.PERSONS, links).match_house(house, rows, list(previous), result)
		return result

	def test_name_reading_and_old_forms(self):
		rows = [row("逢沢  一郎", "あいさわ  いちろう"), row("上野 ほたる [上野 蛍]", "うえの ほたる"), row("宮沢 洋一", "みやざわ よういち")]
		result = self.match(rows)
		self.assertEqual([r["person_id"] for r in rows], [1, 2, 5])
		self.assertEqual([pid for _, _, pid, _ in result.by_reading], [2])

	def test_same_name_carried_from_previous_snapshot(self):
		rows = [row("鬼木   誠", "おにき まこと")]
		result = self.match(rows)
		self.assertIsNone(rows[0]["person_id"])
		self.assertEqual((result.unresolved[0].reason, result.unresolved[0].candidates), ("ambiguous", [3, 4]))
		rows = [row("鬼木   誠", "おにき まこと")]
		self.match(rows, previous=[row("鬼木 誠", "おにき まこと", pid=4)])
		self.assertEqual(rows[0]["person_id"], 4)

	def test_link_wins_and_unknown_is_queued(self):
		rows = [row("佐藤 はじめ", "さとう はじめ"), row("新人 太郎", "しんじん たろう")]
		result = self.match(rows, links={link_key("shugiin", "佐藤 はじめ"): 7})
		self.assertEqual(rows[0]["person_id"], 7)
		self.assertIsNone(rows[1]["person_id"])
		self.assertEqual(result.unresolved[0].reason, "not_in_person")

	def test_ambiguous_reading_is_not_guessed(self):
		rows = [row("佐藤 はじめ", "さとう はじめ")]
		result = self.match(rows)
		self.assertIsNone(rows[0]["person_id"])
		self.assertEqual(result.unresolved[0].candidates, [6, 7])

	def test_aliases_count_as_names(self):
		persons = self.PERSONS + [
			(8, "金子恵美", "かねこめぐみ"), (9, "金子恵美（えみ）", "かねこえみ"),
			(9, "金子恵美", None), (10, "山本譲司", "やまもとじょうじ"), (10, "山本ジョージ", "やまもとじょーじ"),
		]
		rows = [row("金子 恵美", "かねこ えみ"), row("山本ジョージ", "やまもと  じょーじ")]
		result = MatchResult()
		MemberMatcher(persons).match_house("shugiin", rows, [], result)
		self.assertEqual([r["person_id"] for r in rows], [9, 10])
		self.assertEqual(dict(result.by_method), {"name": 2})


class SnapshotTests(unittest.TestCase):
	def test_diff_pairs_by_person_id(self):
		old = [row("畑野  枝", "はたの きみえ", "共産", pid=9), row("渡辺 孝一", "わたなべ こういち", pid=8), row("泉 健太", "いずみ けんた", "中道", pid=7)]
		new = [row("畑野 君枝", "はたの きみえ", "共産", pid=9), row("泉 健太", "いずみ けんた", "志士", pid=7), row("新人 太郎", "しんじん たろう")]
		d = diff(old, new)
		self.assertEqual([r["name"] for r in d["joined"]], ["新人 太郎"])
		self.assertEqual([r["name"] for r in d["left"]], ["渡辺 孝一"])
		self.assertEqual(dict(d["changed"]), {
			"畑野 君枝": {"name": ("畑野  枝", "畑野 君枝")},
			"泉 健太": {"kaiha": ("中道", "志士")},
		})

	def test_latest_snapshot_and_render(self):
		with tempfile.TemporaryDirectory() as tmp:
			d = Path(tmp)
			for name in ("shugiin_20260315.json", "shugiin_20261101.json", "sangiin_20270101.json", "shugiin_notes.json"):
				(d / name).write_text("{}")
			self.assertEqual(latest_snapshot(d, "shugiin").name, "shugiin_20261101.json")
		self.assertEqual(render([{"name": "青木 愛"}]), '{\n    "reprs": [\n        {\n            "name": "青木 愛"\n        }\n    ]\n}')


class PeopleTests(unittest.TestCase):
	ELECTION = {"year": "2026年", "month": "2月", "day": "8日", "election_name": "第51回衆議院議員総選挙",
		"district": "東京1区", "party": "自由民主党", "result": "当選", "election_freq": "（1回目）"}

	def test_validate(self):
		raw = validate({"name_kanji": "新人　太郎", "name_kana": "しんじん たろう", "election_data": [dict(self.ELECTION, extra=1)], "_note": "x"})
		self.assertEqual(raw["name_kanji"], "新人太郎")
		self.assertEqual(raw["name_kana"], "しんじんたろう")
		self.assertEqual(list(raw["election_data"][0]), ["year", "month", "day", "election_name", "district", "party", "result", "election_freq"])
		with self.assertRaises(InvalidPerson):
			validate({"name_kanji": "新人太郎", "name_kana": "しんじんたろう", "election_data": []})
		with self.assertRaises(InvalidPerson):
			validate({"name_kanji": "新人太郎", "name_kana": "シンジン", "election_data": [self.ELECTION]})
		with self.assertRaises(InvalidPerson):
			validate({"name_kanji": "新人太郎", "name_kana": "しんじんたろう", "election_data": [dict(self.ELECTION, month="2")]})

	def test_table_row_quoting_matches_file(self):
		self.assertEqual(table_row(5868, "木村義雄", "きむらよしお", "b05"), "5868,木村義雄,きむらよしお,b05\r\n")
		self.assertEqual(table_row(2, "左藤恵", "さとうめぐむ", "81e"), '2,左藤恵,さとうめぐむ,"81e"\r\n')
		self.assertEqual(csv_field('a,"b'), '"a,""b"')

	def test_append_table_row_updates_gz_and_backs_up(self):
		with tempfile.TemporaryDirectory() as tmp:
			csv = Path(tmp) / "table.csv"
			csv.write_bytes(b'"person_id","name_kanji","name_kana","election_signature"\r\n1,a,b,c\r\n')
			append_table_row(csv, "2,d,e,f\r\n", Path(tmp) / "backups")
			text = csv.read_bytes()
			self.assertTrue(text.endswith(b"1,a,b,c\r\n2,d,e,f\r\n"))
			self.assertEqual(gzip.decompress((Path(tmp) / "table.csv.gz").read_bytes()), text)
			self.assertEqual(len(list((Path(tmp) / "backups").iterdir())), 1)


if __name__ == "__main__":
	unittest.main()
