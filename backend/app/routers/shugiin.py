from typing import Any

from fastapi import APIRouter, Depends

from ..core.config import Settings, get_settings
from ..services.data_loader import DataLoader
from .dependencies import get_data_loader

router = APIRouter(prefix="/shugiin", tags=["shugiin"])


@router.get("/commitee", summary="Committee names and members")
async def commitee(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    commitee_dir = settings.shugiin_dir / "commitee"
    return loader.load_first_json(commitee_dir)


@router.get("/repr", summary="Representatives")
async def representatives(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    repr_dir = settings.shugiin_dir / "repr_list"
    return loader.load_first_json(repr_dir)
