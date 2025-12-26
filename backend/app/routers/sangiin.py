from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.config import Settings, get_settings
from services.data_loader import DataLoader
from routers.dependencies import get_data_loader

router = APIRouter(prefix="/sangiin", tags=["sangiin"])


@router.get("/meeting_names", summary="List available meeting names")
async def meeting_names(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Dict[str, Any]:
    meeting_dir = settings.sangiin_dir / "voting_results"
    meetings = []
    for file_path in loader.list_json_files(meeting_dir):
        data = loader.load_json(file_path)
        meetings.append({"meeting_name": file_path.stem, "period": data.get("period")})
    return {"meetings": meetings}


@router.get("/commitee", summary="Committee names and members")
async def commitee(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    commitee_dir = settings.sangiin_dir / "commitee"
    return loader.load_first_json(commitee_dir)


@router.get("/repr", summary="Representatives")
async def representatives(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    repr_dir = settings.sangiin_dir / "repr_list"
    return loader.load_first_json(repr_dir)


@router.get("/sangiin_meeting_votes/{meeting_name}", summary="Voting results for a meeting")
async def sangiin_meeting_votes(
    meeting_name: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Any:
    meeting_dir = settings.sangiin_dir / "voting_results"
    return loader.load_json_from_subpath(meeting_dir, meeting_name)


@router.get(
    "/sangiin_party_opinions/{meeting_name}/{topic_name}",
    summary="Party opinions for a given topic",
)
async def sangiin_party_opinions(
    meeting_name: str,
    topic_name: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Any:
    opinions_dir = settings.sangiin_dir / "party_opinions"
    data = loader.load_json_from_subpath(opinions_dir, meeting_name)
    try:
        return data[topic_name]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Topic not found") from exc
