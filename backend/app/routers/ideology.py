from typing import Any

from fastapi import APIRouter, Depends
from core.storage import get_storage, Storage
from fastapi.responses import Response

router = APIRouter(prefix="/ideology", tags=["ideology"])


@router.get("/", summary="Ideology data")
async def ideology_data(storage: Storage = Depends(get_storage)) -> Any:
	ideology_bytes = storage.read_bytes("kokkai-doc/ideology/ideology.json.gz")
	return Response(content=ideology_bytes, 
		media_type="application/octet-stream", 
		headers={"Content-Encoding": "gzip", "Content-Length": str(len(ideology_bytes))})


@router.get("/person", summary="One politician's per-topic stance summaries (specs/stance-summaries-panel §5)")
async def ideology_person(person_id: int, storage: Storage = Depends(get_storage)) -> Any:
	try:
		return storage.read_json(f"kokkai-doc/ideology/persons/{person_id}.json")
	except Exception as e:
		print(f"[INFO: ideology_person] no stance file for person {person_id}: {e}")
		return {"version": 1, "person_id": person_id, "topics": []}
