from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.config import Settings, get_settings

router = APIRouter(prefix="/speeches", tags=["speeches"])


@router.get("", summary="All speech summaries")
async def speech_summary(
    settings: Settings = Depends(get_settings),
) -> Any:
    return {"status": "ok"}

