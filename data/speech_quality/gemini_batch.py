"""Gemini Batch API over REST (ai.google.dev/gemini-api/docs/batch-mode): upload a JSONL
of requests, create the job, poll it, download the results. Jobs finish within 24 h
or expire after 48 h; results are kept for 6 weeks.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Iterator, Optional

import requests

BASE = "https://generativelanguage.googleapis.com"
DONE_STATES = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED",
	"BATCH_STATE_SUCCEEDED", "BATCH_STATE_FAILED", "BATCH_STATE_CANCELLED", "BATCH_STATE_EXPIRED"}


class GeminiBatch:
	def __init__(self, key: Optional[str] = None, session: Optional[requests.Session] = None):
		self.key = key or os.environ["GEMINI_API_KEY"]
		self.s = session or requests.Session()

	def _req(self, method: str, url: str, **kw) -> requests.Response:
		headers = {"x-goog-api-key": self.key, **kw.pop("headers", {})}
		for attempt in range(5):
			r = self.s.request(method, url, headers=headers, timeout=kw.pop("timeout", 600), **kw)
			if r.status_code in (429, 500, 502, 503, 504):
				time.sleep(min(60, 5 * 2 ** attempt))
				continue
			if not r.ok:
				raise RuntimeError(f"{method} {url.split('?')[0]}: {r.status_code} {r.text[:500]}")
			return r
		raise RuntimeError(f"{method} {url.split('?')[0]}: gave up ({r.status_code} {r.text[:300]})")

	def upload(self, path: Path, display_name: str) -> str:
		"""Resumable upload of a JSONL file; returns its name (files/…)."""
		data = path.read_bytes()
		start = self._req("POST", f"{BASE}/upload/v1beta/files", headers={
			"X-Goog-Upload-Protocol": "resumable",
			"X-Goog-Upload-Command": "start",
			"X-Goog-Upload-Header-Content-Length": str(len(data)),
			"X-Goog-Upload-Header-Content-Type": "application/jsonl",
			"Content-Type": "application/json",
		}, json={"file": {"display_name": display_name}})
		url = start.headers["x-goog-upload-url"]
		r = self._req("POST", url, headers={
			"Content-Length": str(len(data)), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize",
		}, data=data)
		return r.json()["file"]["name"]

	def create(self, model: str, file_name: str, display_name: str) -> str:
		r = self._req("POST", f"{BASE}/v1beta/models/{model}:batchGenerateContent", json={
			"batch": {"display_name": display_name, "input_config": {"file_name": file_name}},
		})
		return r.json()["name"]

	def get(self, name: str) -> dict:
		return self._req("GET", f"{BASE}/v1beta/{name}", timeout=60).json()

	@staticmethod
	def state(job: dict) -> str:
		return job.get("metadata", {}).get("state") or job.get("state") or "UNKNOWN"

	@staticmethod
	def result_file(job: dict) -> Optional[str]:
		"""The responses file, wherever this API version puts it."""
		for holder in (job.get("response"), job.get("dest"), job.get("metadata", {}).get("output"),
				job.get("metadata", {}).get("dest"), job.get("output")):
			if isinstance(holder, dict):
				for k in ("responsesFile", "fileName", "responses_file", "file_name"):
					if holder.get(k):
						return holder[k]
		return None

	def download(self, file_name: str) -> Iterator[dict]:
		r = self._req("GET", f"{BASE}/download/v1beta/{file_name}:download?alt=media", timeout=900)
		for line in r.text.splitlines():
			if line.strip():
				yield json.loads(line)

	def delete_file(self, file_name: str) -> None:
		try:
			self._req("DELETE", f"{BASE}/v1beta/{file_name}", timeout=60)
		except RuntimeError:
			pass
