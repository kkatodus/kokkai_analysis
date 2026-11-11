"""GET /ideology/person (specs/stance-summaries-panel §5). Run from backend/: python -m pytest tests -q"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from core.storage import LocalStorage  # noqa: E402
from routers.ideology import ideology_person  # noqa: E402


def test_returns_file(tmp_path: Path):
	d = tmp_path / "kokkai-doc" / "ideology" / "persons"
	d.mkdir(parents=True)
	body = {"version": 1, "person_id": 268, "topics": [{"topic_en": "Defence", "summaries": ["１．a"]}]}
	(d / "268.json").write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
	assert asyncio.run(ideology_person(268, LocalStorage(tmp_path))) == body


def test_missing_file_is_empty_not_500(tmp_path: Path):
	assert asyncio.run(ideology_person(5, LocalStorage(tmp_path))) == {"version": 1, "person_id": 5, "topics": []}
