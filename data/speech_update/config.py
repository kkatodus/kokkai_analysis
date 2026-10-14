"""Paths and settings. Every value can be overridden with an environment variable."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"


@dataclass(frozen=True)
class Config:
	mirror_root: Path          # s3_mirror/kokkai-doc
	state_dir: Path            # s3_mirror/.speech-update
	env_file: Path             # data/.env
	topics_file: Path          # data/resource/experiment_config.json
	bucket: str
	s3_prefix: str             # key prefix that mirror_root maps to
	aws_profile: str
	lookback_days: int
	min_request_interval: float
	min_issue_count: int       # refuse to run against a half-synced mirror
	db_speeches: bool          # upsert into Postgres `speeches` (off until the §4.10 repair)

	@property
	def issues_dir(self) -> Path:
		return self.mirror_root / "issues"

	@property
	def persons_dir(self) -> Path:
		return self.mirror_root / "repr_speeches_id_organized"


def load_config() -> Config:
	env = os.environ.get
	mirror_root = Path(env("SPEECH_UPDATE_MIRROR", REPO_ROOT / "s3_mirror" / "kokkai-doc"))
	return Config(
		mirror_root=mirror_root,
		state_dir=Path(env("SPEECH_UPDATE_STATE_DIR", mirror_root.parent / ".speech-update")),
		env_file=Path(env("SPEECH_UPDATE_ENV_FILE", DATA_DIR / ".env")),
		topics_file=Path(env("SPEECH_UPDATE_TOPICS_FILE", DATA_DIR / "resource" / "experiment_config.json")),
		bucket=env("SPEECH_UPDATE_BUCKET", "kokkai-doc-bucket-dev"),
		s3_prefix=env("SPEECH_UPDATE_S3_PREFIX", "kokkai-doc"),
		aws_profile=env("SPEECH_UPDATE_AWS_PROFILE", "kokkai-speech-update"),
		lookback_days=int(env("SPEECH_UPDATE_LOOKBACK_DAYS", "60")),
		min_request_interval=float(env("SPEECH_UPDATE_MIN_INTERVAL", "3")),
		min_issue_count=int(env("SPEECH_UPDATE_MIN_ISSUES", "75000")),
		db_speeches=env("SPEECH_UPDATE_DB_SPEECHES", "0") == "1",
	)
