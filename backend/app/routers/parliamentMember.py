from typing import Any

from fastapi import APIRouter, Depends
from core.storage import get_storage, Storage
from fastapi.responses import Response
router = APIRouter(prefix="/parliamentMember", tags=["parliamentMember"])


@router.get("/", summary="Parliament member data")
async def parliament_member_data(storage: Storage = Depends(get_storage)) -> Any:
	base_directory = "kokkai-doc/parliamentMembers/"
	object_keys = storage.read_directory(base_directory)
	paths = {}
	for object_key in object_keys:
		if object_key.endswith(".json"):
			if 'shugiin' in object_key:
				paths['shugiin'] = object_key.split('/')[-1]
			elif 'sangiin' in object_key:
				paths['sangiin'] = object_key.split('/')[-1]

	return {
		'shugiin': storage.read_json(base_directory + paths['shugiin']),
		'sangiin': storage.read_json(base_directory + paths['sangiin']),
	}


@router.get("/all", summary="All parliament member data")
async def all_parliament_member_data(storage: Storage = Depends(get_storage)) -> Any:
	path = "kokkai-doc/politicians/table.csv.gz"
	bytes = storage.read_bytes(path)
	return Response(content=bytes, 
		media_type="application/octet-stream", 
		headers={"Content-Encoding": "gzip", "Content-Length": str(len(bytes))})