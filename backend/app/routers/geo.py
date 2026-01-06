from typing import Any

import os
from fastapi import APIRouter
from fastapi.responses import FileResponse

from core.paths import STATIC_DIR

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/senkyokuPolydata", summary="Senkyoku polygon data")
async def senkyoku_polygon_data() -> Any:
	path = os.path.join(STATIC_DIR, "geo/senkyoku_minified.json.gz")
	print("fetching path", path)
	return FileResponse(path=path, media_type="application/json", headers={"Content-Encoding": "gzip"})