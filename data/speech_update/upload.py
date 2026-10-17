"""Upload stage: push changed mirror files to S3. Never deletes anything.

Issue files go first, so a per-person file never points at an issue the API
can't serve yet.
"""
from __future__ import annotations

import logging
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Iterable, List, Optional, Tuple

log = logging.getLogger(__name__)


def upload_order(rel_paths: Iterable[str]) -> Tuple[List[str], List[str]]:
	paths = sorted(rel_paths)
	issues = [p for p in paths if p.startswith("issues/")]
	return issues, [p for p in paths if not p.startswith("issues/")]


def content_type(rel_path: str) -> str:
	# matches what `aws s3 cp/sync` set on the existing objects
	return mimetypes.guess_type(rel_path)[0] or "binary/octet-stream"


class Uploader:
	def __init__(self, mirror_root: Path, bucket: str, s3_prefix: str, aws_profile: Optional[str], workers: int = 8, client=None):
		self.mirror_root = mirror_root
		self.bucket = bucket
		self.s3_prefix = s3_prefix.strip("/")
		self.workers = workers
		if client is None:
			import boto3
			from botocore.config import Config as BotoConfig
			client = boto3.Session(profile_name=aws_profile or None).client(
				"s3", config=BotoConfig(max_pool_connections=max(10, workers * 2)),
			)
		self.client = client

	def key_for(self, rel_path: str) -> str:
		return f"{self.s3_prefix}/{rel_path}" if self.s3_prefix else rel_path

	def upload(self, rel_paths: Iterable[str], on_done: Callable[[List[str]], None]) -> int:
		"""Upload issues, then everything else. `on_done` gets each finished batch so
		progress survives a crash. Raises if any file fails (after the rest finish)."""
		uploaded = 0
		for batch in upload_order(rel_paths):
			if not batch:
				continue
			done, failed = self._upload_batch(batch)
			on_done(done)
			uploaded += len(done)
			if failed:
				raise RuntimeError(f"{len(failed)} upload(s) failed, e.g. {failed[0][0]}: {failed[0][1]}")
		return uploaded

	def _upload_batch(self, rel_paths: List[str]) -> Tuple[List[str], List[Tuple[str, Exception]]]:
		done: List[str] = []
		failed: List[Tuple[str, Exception]] = []
		with ThreadPoolExecutor(max_workers=self.workers) as pool:
			futures = {pool.submit(self._upload_one, p): p for p in rel_paths}
			for fut in as_completed(futures):
				p = futures[fut]
				try:
					fut.result()
					done.append(p)
				except Exception as e:  # noqa: BLE001 - reported together below
					log.error("upload failed: %s: %s", p, e)
					failed.append((p, e))
				if len(done) % 500 == 0 and done:
					log.info("uploaded %d/%d", len(done), len(rel_paths))
		return done, failed

	def _upload_one(self, rel_path: str) -> None:
		local = self.mirror_root / rel_path
		self.client.upload_file(
			str(local), self.bucket, self.key_for(rel_path),
			ExtraArgs={"ContentType": content_type(rel_path)},
		)
