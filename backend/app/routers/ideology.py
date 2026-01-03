from typing import Any

from fastapi import APIRouter, Depends
from core.storage import get_storage, Storage
from core.config import get_settings
from core.config import Settings
from fastapi.responses import Response

router = APIRouter(prefix="/ideology", tags=["ideology"])


@router.get("/", summary="Ideology data")
async def ideology_data(storage: Storage = Depends(get_storage)) -> Any:
	ideology_bytes = storage.read_bytes("kokkai-doc/ideology/ideology.json.gz")


	return Response(content=ideology_bytes, 
		media_type="application/octet-stream", 
		headers={"Content-Encoding": "gzip", "Content-Length": str(len(ideology_bytes))})