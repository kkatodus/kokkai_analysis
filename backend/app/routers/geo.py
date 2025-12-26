from typing import Any

from fastapi import APIRouter, Depends

from core.config import Settings, get_settings
from services.data_loader import DataLoader
from routers.dependencies import get_data_loader

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/senkyokuPolydata", summary="Senkyoku polygon data")
async def senkyoku_polygon_data(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    files = list(loader.list_json_files(settings.geo_dir))
    return loader.load_json(files[0])
