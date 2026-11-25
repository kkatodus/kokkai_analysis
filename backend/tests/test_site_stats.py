"""GET /speeches/quality/site_stats (specs/dashboard-loading §8). Run from backend/: python -m pytest tests -q"""
import asyncio
import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from core.storage import LocalStorage  # noqa: E402
from routers.speeches import quality_site_stats  # noqa: E402


def test_returns_file(tmp_path: Path):
	d = tmp_path / "kokkai-doc" / "speech_quality"
	d.mkdir(parents=True)
	body = {"version": 1, "corpus": {"speeches": 3, "meetings": 1, "from": "2000-01-20"}, "top_speakers_current": []}
	(d / "site_stats.json").write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
	assert asyncio.run(quality_site_stats(LocalStorage(tmp_path))) == body


def test_missing_file_is_404(tmp_path: Path):
	with pytest.raises(HTTPException) as e:
		asyncio.run(quality_site_stats(LocalStorage(tmp_path)))
	assert e.value.status_code == 404
