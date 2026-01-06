
from typing import Any

from fastapi import APIRouter, Depends
from core.storage import get_storage, Storage
from fastapi.responses import Response

router = APIRouter(prefix="/electionHistory", tags=["electionHistory"])


@router.get("/", summary="Election history data")
async def election_history_data(person_id: str, storage: Storage = Depends(get_storage)) -> Any:
	election_history_bytes = storage.read_bytes(f"kokkai-doc/electionHistory/{person_id}.jsonl")
	return Response(content=election_history_bytes, 
		media_type="application/json", 
		headers={"Content-Length": str(len(election_history_bytes))})