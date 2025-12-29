from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
import json
from core.config import Settings, StorageBackend

class Storage(Protocol):
	def read_json(self, key:str) -> dict: ...
	def read_bytes(self, key:str) -> bytes: ...


@dataclass
class LocalStorage:
	root: Path

	def _path(self, key:str) -> Path:
		return (self.root/key).resolve()

	def read_json(self, key:str) -> dict:
		path = self._path(key)
		if not path.exists():
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "r", encoding="utf-8") as f:
			return json.load(f)

	def read_bytes(self, key:str) -> bytes:
		path = self._path(key)
		if not path.exists():
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "rb") as f:
			return f.read()


@dataclass
class S3Storage:
	bucket_name: str
	prefix: str

	def __post_init__(self):
		import boto3 # pylint: disable=import-outside-toplevel
		self._s3 = boto3.client("s3")

	def _obj_key(self, key:str) -> str:
		if self.prefix:
			return f"{self.prefix.rstrip('/')}/{key.lstrip('/')}"
		return key.lstrip('/')


	def read_bytes(self, key:str) -> bytes:
		obj = self._s3.get_object(Bucket=self.bucket_name, Key=self._obj_key(key))
		return obj["Body"].read()

	def read_json(self, key: str) -> dict:
		return json.loads(self.read_bytes(key))



def get_storage(settings:Settings) -> Storage:
	if settings.storage_backend == StorageBackend.S3:
		return S3Storage(bucket_name=settings.s3_bucket_name, prefix=settings.s3_prefix)
	elif settings.storage_backend == StorageBackend.LOCAL:
		return LocalStorage(root=settings.local_data_root)
	else:
		raise ValueError(f"Invalid storage backend: {settings.storage_backend}")

	
