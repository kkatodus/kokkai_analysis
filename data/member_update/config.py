"""Paths and settings. Every value can be overridden with an environment variable.

S3 settings default to the speech updater's (same bucket, prefix and profile).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"


@dataclass(frozen=True)
class Config:
	mirror_root: Path          # s3_mirror/kokkai-doc
	state_dir: Path            # s3_mirror/.member-update
	env_file: Path             # data/.env
	bucket: str
	s3_prefix: str
	aws_profile: str
	min_request_interval: float
	min_members: dict          # house → fewest rows a list may have before we distrust it

	@property
	def members_dir(self) -> Path:
		return self.mirror_root / "parliamentMembers"

	@property
	def history_dir(self) -> Path:
		return self.mirror_root / "electionHistory"

	@property
	def table_csv(self) -> Path:
		return self.mirror_root / "politicians" / "table.csv"


def load_config() -> Config:
	env = os.environ.get
	mirror_root = Path(env("MEMBER_UPDATE_MIRROR", env("SPEECH_UPDATE_MIRROR", REPO_ROOT / "s3_mirror" / "kokkai-doc")))
	return Config(
		mirror_root=mirror_root,
		state_dir=Path(env("MEMBER_UPDATE_STATE_DIR", mirror_root.parent / ".member-update")),
		env_file=Path(env("MEMBER_UPDATE_ENV_FILE", DATA_DIR / ".env")),
		bucket=env("MEMBER_UPDATE_BUCKET", env("SPEECH_UPDATE_BUCKET", "kokkai-doc-bucket-dev")),
		s3_prefix=env("MEMBER_UPDATE_S3_PREFIX", env("SPEECH_UPDATE_S3_PREFIX", "kokkai-doc")),
		aws_profile=env("MEMBER_UPDATE_AWS_PROFILE", env("SPEECH_UPDATE_AWS_PROFILE", "kokkai-speech-update")),
		min_request_interval=float(env("MEMBER_UPDATE_MIN_INTERVAL", "2")),
		# seats: 衆 465, 参 248. Below these the page is mid-change (e.g. dissolution) or broken.
		min_members={
			"shugiin": int(env("MEMBER_UPDATE_MIN_SHUGIIN", "430")),
			"sangiin": int(env("MEMBER_UPDATE_MIN_SANGIIN", "225")),
		},
	)
