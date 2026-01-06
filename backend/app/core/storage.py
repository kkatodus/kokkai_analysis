from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Protocol, Iterator
import json
import gzip
from core.config import Settings, StorageBackend, get_settings
from fastapi import Depends

PAGE_LINE_SIZE = 10

@dataclass
class Page:
	lines: list[dict]
	page_number: int
	total_pages: int
	total_lines: int

class Storage(Protocol):
	def read_gzipped_json(self, key:str) -> dict: ...
	def read_json(self, key:str) -> dict: ...
	def read_bytes(self, key:str) -> bytes: ...
	def read_directory(self, prefix:str) -> list[str]: ...
	def read_file_paginated(self, key:str, page_number:int) -> Page: ...



@dataclass
class LocalStorage:
	root: Path

	def _path(self, key:str) -> Path:
		return os.path.join(self.root, key)

	def read_directory(self, prefix:str) -> list[str]:
		objects = os.listdir(os.path.join(self.root, prefix))
		return objects

	def read_bytes(self, key:str) -> bytes:
		path = self._path(key)
		if not os.path.exists(path):
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "rb") as f:
			return f.read()

	def read_json(self, key:str) -> dict:
		path = self._path(key)
		if not os.path.exists(path):
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "r", encoding="utf-8") as f:
			return json.load(f)

	def read_jsonl_paginated(self, key:str, page_number:int) -> Page:
		path = self._path(key)
		if not os.path.exists(path):
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "r", encoding="utf-8") as f:
			lines = f.read().splitlines()
			total_pages = len(lines) // PAGE_LINE_SIZE + 1
			total_lines = len(lines)
			return Page(lines=[json.loads(line) for line in lines[page_number*PAGE_LINE_SIZE:(page_number+1)*PAGE_LINE_SIZE]], page_number=page_number, total_pages=total_pages, total_lines=total_lines)


CHUNK_SIZE = 1024 * 1024 # 1MB

@dataclass
class S3Storage:
	bucket_name: str

	def __post_init__(self):
		import boto3 # pylint: disable=import-outside-toplevel
		self._s3 = boto3.resource('s3')
	
	def iter_s3_body(self, body)-> Iterator[bytes]:
		while True:
			chuck = body.read(CHUNK_SIZE)
			if not chuck:
				break
			yield chuck

	def _obj_key(self, key:str) -> str:
		return key.lstrip('/')

	def read_directory(self, prefix:str) -> list[str]:
		bucket = self._s3.Bucket(self.bucket_name)
		objects = bucket.objects.filter(Prefix=prefix)
		return [obj.key[len(prefix):].lstrip('/') for obj in objects] if objects else []


	def read_bytes(self, key:str) -> bytes:
		obj = self._s3.Bucket(self.bucket_name).Object(self._obj_key(key)).get()
		return obj["Body"].read()

	def read_json(self, key: str) -> dict:
		return json.loads(self.read_bytes(key))

	
	def read_jsonl_paginated(self, key: str, page_number: int) -> Page:
		"""
		Stream a large JSONL file from S3 and return one page without downloading the whole object.

		Notes:
		- This implementation is memory-efficient but still O(file_size) per request because it must
		  count total lines to compute total_pages/total_lines.
		- page_number is treated as 0-based (consistent with your LocalStorage slicing).
		"""
		if page_number < 0:
			raise ValueError("page_number must be >= 0")

		obj_key = self._obj_key(key)

		obj = self._s3.Bucket(self.bucket_name).Object(obj_key).get()
		body = obj["Body"]  # botocore.response.StreamingBody

		page_start = page_number * PAGE_LINE_SIZE
		page_end = (page_number + 1) * PAGE_LINE_SIZE

		total_lines = 0
		page_items: list[dict] = []

		# Buffer for chunk boundary handling
		buf = b""

		for chunk in self.iter_s3_body(body):
			buf += chunk
			parts = buf.split(b"\n")
			buf = parts.pop()  # remainder (possibly partial line)

			for raw_line in parts:
				# Skip empty lines
				if not raw_line:
					continue

				line_idx = total_lines
				total_lines += 1

				# Only parse JSON for lines in requested window
				if page_start <= line_idx < page_end:
					try:
						page_items.append(json.loads(raw_line.decode("utf-8")))
					except json.JSONDecodeError as e:
						raise ValueError(f"Invalid JSON on line {line_idx} in s3://{self.bucket_name}/{obj_key}: {e}") from e

		# Handle last line if file doesn't end with '\n'
		if buf.strip():
			line_idx = total_lines
			total_lines += 1
			if page_start <= line_idx < page_end:
				try:
					page_items.append(json.loads(buf.decode("utf-8")))
				except json.JSONDecodeError as e:
					raise ValueError(f"Invalid JSON on last line {line_idx} in s3://{self.bucket_name}/{obj_key}: {e}") from e

		total_pages = (total_lines + PAGE_LINE_SIZE - 1) // PAGE_LINE_SIZE + 1

		return Page(
			lines=page_items,          # NOTE: your Page type says list[str], but LocalStorage returns parsed JSON too
			page_number=page_number,
			total_pages=total_pages,
			total_lines=total_lines,
		)



def get_storage(settings:Settings = Depends(get_settings)) -> Storage:
	if settings.storage_backend == StorageBackend.S3:
		return S3Storage(bucket_name=settings.data_lake_bucket_name)
	elif settings.storage_backend == StorageBackend.LOCAL:
		return LocalStorage(root=settings.local_data_root)
	else:
		raise ValueError(f"Invalid storage backend: {settings.storage_backend}")

	
