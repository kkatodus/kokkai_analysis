from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Protocol
import json
from core.config import Settings, StorageBackend, get_settings
from fastapi import Depends

class Storage(Protocol):
	def read_json(self, key:str) -> dict: ...
	def read_bytes(self, key:str) -> bytes: ...


@dataclass
class LocalStorage:
	root: Path

	def _path(self, key:str) -> Path:
		return (self.root/key).resolve()

	

	def read_directory(self, prefix:str) -> list[str]:
		print("reading directory", os.path.join(self.root, prefix))
		objects = os.listdir(os.path.join(self.root, prefix))
		return objects

	def read_bytes(self, key:str) -> bytes:
		path = self._path(key)
		if not path.exists():
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "rb") as f:
			return f.read()

	def read_json(self, key:str) -> dict:
		path = self._path(key)
		if not path.exists():
			raise FileNotFoundError(f"File not found: {path}")
		with open(path, "r", encoding="utf-8") as f:
			return json.load(f)


@dataclass
class S3Storage:
	bucket_name: str

	def __post_init__(self):
		import boto3 # pylint: disable=import-outside-toplevel
		self._s3 = boto3.resource('s3')

	def _obj_key(self, key:str) -> str:
		return key.lstrip('/')

	def read_directory(self, prefix:str) -> list[str]:
		print("reading s3 directory", prefix)
		bucket = self._s3.Bucket(self.bucket_name)
		objects = bucket.objects.filter(Prefix=prefix)
		return [obj.key for obj in objects] if objects else []


	def read_bytes(self, key:str) -> bytes:
		print("reading s3 bytes", key)
		obj = self._s3.Bucket(self.bucket_name).Object(self._obj_key(key)).get()
		return obj["Body"].read()

	def read_json(self, key: str) -> dict:
		print("reading s3 json", key)
		return json.loads(self.read_bytes(key))



def get_storage(settings:Settings = Depends(get_settings)) -> Storage:
	if settings.storage_backend == StorageBackend.S3:
		return S3Storage(bucket_name=settings.data_lake_bucket_name)
	elif settings.storage_backend == StorageBackend.LOCAL:
		return LocalStorage(root=settings.local_data_root)
	else:
		raise ValueError(f"Invalid storage backend: {settings.storage_backend}")

	
