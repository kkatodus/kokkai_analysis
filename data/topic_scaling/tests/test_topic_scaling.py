"""Unit tests for topic_scaling (run from data/: ../.venv-topic-scaling/bin/python -m pytest topic_scaling/tests -q)."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np
import pytest

from topic_scaling import config as tsconfig
from topic_scaling.members import short_party
from topic_scaling.select import Pair, candidate_sentences, sanitize, select_pair, words_hash
from topic_scaling.state import State
from topic_scaling.summarize import build_requests, strip_preamble
from topic_scaling.suggest.volume import rolling12, sparkline, suggest_window


def make_topic(**kw) -> tsconfig.Topic:
	base = dict(topic_id=4, name_jp="原発", name_en="NuclearPower", slug="nuclear", search_words=["原発", "再稼働"],
		window_from=date(2011, 3, 11), window_to=None, enabled=True, min_opinions=3, skip_reason=None)
	base.update(kw)
	return tsconfig.Topic(**base)


# --- config ---

def test_load_topics_requires_slug_and_window(tmp_path: Path):
	cfg = [
		{"topic_id": 1, "topic_name": "防衛", "topic_name_en": "Defence", "slug": "defence", "search_words": ["防衛"],
			"window": {"from": "2000-01-01", "to": None}},
		{"topic_id": 2, "topic_name": "少子化", "topic_name_en": "Birth", "slug": "aging", "search_words": ["少子化"]},
		{"topic_id": 3, "topic_name": "X", "topic_name_en": "X", "search_words": ["x"], "window": {"from": "2000-01-01"}},
		{"topic_id": 4, "topic_name": "Y", "topic_name_en": "Y", "slug": "y", "search_words": ["y"],
			"window": {"from": "2000-01-01", "to": "2010-12-31"}, "scaling": {"enabled": False, "min_opinions": 5}},
	]
	p = tmp_path / "cfg.json"
	p.write_text(json.dumps(cfg), encoding="utf-8")
	topics = tsconfig.load_topics(p)
	assert topics[0].scalable and topics[0].window_from == date(2000, 1, 1)
	assert topics[1].skip_reason == "no window"
	assert topics[2].skip_reason == "no slug"
	assert topics[3].skip_reason == "scaling disabled" and topics[3].min_opinions == 5 and topics[3].window_to == date(2010, 12, 31)


def test_in_window_boundaries():
	t = make_topic(window_from=date(2011, 3, 11), window_to=date(2012, 1, 1))
	assert t.in_window("2011-03-11")
	assert t.in_window("2012-01-01")
	assert not t.in_window("2011-03-10")
	assert not t.in_window("2012-01-02")
	assert not t.in_window("")
	assert not t.in_window("garbage")
	assert make_topic(window_to=None).in_window("2099-01-01")


def test_load_axes_needs_slug_and_examples(tmp_path: Path):
	t = make_topic()
	d = tmp_path / t.name_jp
	(d / "examples").mkdir(parents=True)
	(d / f"{t.name_jp}_axis.json").write_text(json.dumps([{"topic": "再稼働", "pro": "p", "con": "c"}]), encoding="utf-8")
	with pytest.raises(tsconfig.AxisError, match="no slug"):
		tsconfig.load_axes(tmp_path, t)
	(d / f"{t.name_jp}_axis.json").write_text(json.dumps([{"topic": "再稼働", "pro": "p", "con": "c", "slug": "restart"}]), encoding="utf-8")
	with pytest.raises(tsconfig.AxisError, match="missing reference"):
		tsconfig.load_axes(tmp_path, t)
	(d / "examples" / "再稼働_example_speeches.json").write_text(
		json.dumps({"pro": {"opinions": ["賛成"]}, "con": {"opinions": ["反対"]}}), encoding="utf-8")
	subs = tsconfig.load_axes(tmp_path, t)
	assert subs[0].key == "nuclear/restart" and subs[0].examples() == {"pro": ["賛成"], "con": ["反対"]}


# --- select ---

def test_candidate_sentences_and_sanitize():
	assert candidate_sentences("原発は必要だ。天気がいい。再稼働に反対。", ["原発", "再稼働"]) == ["原発は必要だ", "再稼働に反対"]
	assert sanitize("○山田太郎君　原発は必要だと山田太郎は考える", "山田太郎") == "原発は必要だとは考える"
	assert sanitize("○田中国務大臣　再稼働します", None) == "再稼働します"


def _write_topic_file(persons_dir: Path, pid: str, topic_en: str, speeches):
	d = persons_dir / pid
	d.mkdir(parents=True, exist_ok=True)
	with open(d / f"{topic_en}.jsonl", "w", encoding="utf-8") as f:
		for s in speeches:
			f.write(json.dumps(s, ensure_ascii=False) + "\n")


class FakeClassifier:
	name = "fake"

	def __init__(self, keep_if: str = "賛成"):
		self.keep_if = keep_if
		self.calls = 0

	def opinions(self, sentences):
		self.calls += 1
		return [self.keep_if in s for s in sentences]


def test_select_pair_window_gate_hash_and_cache(tmp_path: Path):
	persons = tmp_path / "persons"
	state = State(tmp_path / "state")
	t = make_topic()
	speeches = [
		{"speechID": "a", "speaker": "山田太郎", "speech": "原発に賛成。原発に反対。", "meta": {"date": "2010-01-01"}},  # before window
		{"speechID": "b", "speaker": "山田太郎", "speech": "再稼働に賛成。天気。", "meta": {"date": "2012-05-05"}},
		{"speechID": "c", "speaker": "山田太郎", "speech": "原発は賛成だ。原発は嫌い。", "meta": {"date": "2013-05-05"}},
	]
	_write_topic_file(persons, "10", "NuclearPower", speeches)
	clf = FakeClassifier()
	pair = select_pair(t, "10", persons / "10" / "NuclearPower.jsonl", state, clf, estimate=False)
	assert pair.n_speeches == 2 and pair.n_opinions == 2 and pair.last_speech == "2013-05-05"
	assert pair.opinions == ["再稼働に賛成", "原発は賛成だ"]
	h1 = pair.opinion_hash
	# cached: second call does not classify again, same hash
	pair2 = select_pair(t, "10", persons / "10" / "NuclearPower.jsonl", state, clf, estimate=False)
	assert clf.calls == 1 and pair2.opinion_hash == h1
	# a new in-window speech changes the hash; a changed search-word set invalidates the cache
	speeches.append({"speechID": "d", "speaker": "山田太郎", "speech": "原発に賛成。", "meta": {"date": "2014-01-01"}})
	_write_topic_file(persons, "10", "NuclearPower", speeches)
	pair3 = select_pair(t, "10", persons / "10" / "NuclearPower.jsonl", state, clf, estimate=False)
	assert pair3.opinion_hash != h1 and clf.calls == 2
	t2 = make_topic(search_words=["原発"])
	select_pair(t2, "10", persons / "10" / "NuclearPower.jsonl", state, clf, estimate=False)
	assert clf.calls == 3
	# estimate mode counts search-word sentences without the classifier
	est = select_pair(t, "10", persons / "10" / "NuclearPower.jsonl", state, None, estimate=True)
	assert est.n_opinions == 4
	# out-of-window only → None
	_write_topic_file(persons, "11", "NuclearPower", speeches[:1])
	assert select_pair(t, "11", persons / "11" / "NuclearPower.jsonl", state, clf, estimate=False) is None


def test_words_hash_order_independent():
	assert words_hash(["a", "b"]) == words_hash(["b", "a"]) != words_hash(["a"])


# --- summarize ---

def test_build_requests_shuffles_per_run_and_is_deterministic():
	t = make_topic()
	pair = Pair("10", "NuclearPower", "山田", 3, 5, "h", "2020-01-01", "2019-01-01", opinions=[f"意見{i}" for i in range(5)])
	reqs = build_requests(pair, t, 3, 42)
	assert [r.key for r in reqs] == ["10:NuclearPower:0", "10:NuclearPower:1", "10:NuclearPower:2"]
	bodies = [r.prompt.split("\n\n")[-1] for r in reqs]
	assert len(set(bodies)) > 1 and all(sorted(b.split("\n")) == sorted(bodies[0].split("\n")) for b in bodies)
	assert bodies == [r.prompt.split("\n\n")[-1] for r in build_requests(pair, t, 3, 42)]
	assert "原発" in reqs[0].prompt and reqs[0].tokens_est("gemini-3.5-flash-lite") > 0
	assert reqs[0].tokens_est("claude-opus-5-5") > reqs[0].tokens_est("gemini-3.5-flash-lite")
	br = reqs[0].request()
	assert br.key == "10:NuclearPower:0" and br.user == reqs[0].prompt and br.json_schema is None


def test_strip_preamble():
	assert strip_preamble("ご提示いただいた議事録から\n１．賛成\n・理由\n\n以下に要約します") == "１．賛成\n・理由"


# --- project ---

def test_projection_sign_and_current_flag(tmp_path: Path, monkeypatch):
	from topic_scaling import project as prj
	cfg = tsconfig.load_config()
	state = State(tmp_path / "state")
	t = make_topic()
	pro, con = np.array([1.0, 0.0]), np.array([-1.0, 0.0])
	vecs = {"1": np.array([0.8, 0.1]), "2": np.array([-0.5, 0.3]), "3": np.array([0.0, 1.0])}
	monkeypatch.setattr(prj, "person_vector", lambda cfg, state, topic, pid, emb: (vecs[pid], {}))
	monkeypatch.setattr(prj, "reference_vectors", lambda cfg, state, sub, emb: (pro, con))
	monkeypatch.setattr(prj, "umap_2d", lambda M, k, seed: np.zeros((len(M), 2)))
	sub = tsconfig.SubTopic(topic=t, slug="restart", name_jp="再稼働", pro="p", con="c", examples_path=tmp_path / "x.json")
	pairs = [{"person_id": "1", "n_opinions": 4}, {"person_id": "2", "n_opinions": 5}, {"person_id": "3", "n_opinions": 6}]
	metas = {1: {"name": "A", "party": "自民"}, 2: {"name": "B", "party": "共産"}, 3: {"name": "C", "party": "自民"}}
	block = prj.project_topic(cfg, state, t, [sub], pairs, metas, current_ids={1, 3})
	assert block["n_scaled"] == 3 and block["n_current"] == 2
	one_d = {p["person_id"]: p for p in block["sub_topics"][0]["1d"]["data"]}
	assert one_d[1]["x"] == pytest.approx(0.8) and one_d[2]["x"] == pytest.approx(-0.5) and one_d[3]["x"] == 0
	assert one_d[1]["current"] and not one_d[2]["current"]
	assert [p["idx"] for p in block["sub_topics"][0]["1d"]["data"]] == [0, 1, 2]
	two_d = block["sub_topics"][0]["2d"]["data"]
	assert [p["ref_point"] for p in two_d[:2]] == ["against", "for"] and len(two_d) == 5
	assert len(block["sub_topics"][0]["2d_current"]["data"]) == 4
	assert one_d[1]["color"] == "black" and one_d[2]["color"] == "red"


# --- members ---

def test_short_party():
	assert short_party("自由民主党") == "自民"
	assert short_party("立憲") == "立憲"
	assert short_party("れいわ新選組") == "れ新"
	assert short_party(None) == "無所属"
	assert short_party("NHKから国民を守る党") == "N党"


# --- suggest ---

def test_volume_suggestions():
	series = {f"{y}-{m:02d}": (0 if y < 2011 else 50) for y in range(2005, 2015) for m in range(1, 13)}
	t = make_topic(window_from=date(2000, 1, 1))
	line = suggest_window(t, series)
	assert "rises 2011" in line and "consider from 2011" in line
	t2 = make_topic(window_from=date(2011, 3, 11))
	assert "✓" in suggest_window(t2, series)
	closed = {f"{y}-{m:02d}": (50 if y < 2010 else 1) for y in range(2005, 2015) for m in range(1, 13)}
	assert "consider closing" in suggest_window(t, closed)
	assert len(sparkline(series)) <= 25 and rolling12(series)[-1][1] == 50


def test_agenda_items_parsing():
	from topic_scaling.suggest.agendas import PROCEDURAL, agenda_items
	text = ("会議録情報 令和八年十月五日\n　　本日の会議に付した案件\n○特別委員長互選\n○理事選任の件\n"
		"○防災庁設置法案（閣法第一三号）（衆議院送付）\n　　　　─────────────\n　　　〔小川克巳君委員長席に着く〕")
	items = agenda_items(text)
	assert items == ["特別委員長互選", "理事選任の件", "防災庁設置法案（閣法第一三号）（衆議院送付）"]
	assert [i for i in items if not PROCEDURAL.search(i)] == ["防災庁設置法案（閣法第一三号）（衆議院送付）"]
	assert agenda_items("no agenda here") == []
