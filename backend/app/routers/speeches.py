from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.config import Settings, get_settings
from services.data_loader import DataLoader
from routers.dependencies import get_data_loader

router = APIRouter(prefix="/speeches", tags=["speeches"])


@router.get("", summary="All speech summaries")
async def speech_summary(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    summary_path = settings.speeches_dir / "summary.json"
    return loader.load_json(summary_path)


@router.get("/summary/{party}/{reprName}", summary="Summary for a representative")
async def one_summary(
    party: str,
    reprName: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    summary_path = settings.speeches_dir / "summary.json"
    summaries = loader.load_json(summary_path)
    try:
        return next(
            repr_summary
            for repr_summary in summaries.get("reprs", [])
            if repr_summary.get("name") == reprName and repr_summary.get("party") == party
        )
    except StopIteration as exc:
        raise HTTPException(status_code=404, detail="Representative summary not found") from exc


@router.get(
    "/opinion/{party}/{reprName}/{topic}",
    summary="Opinion for a representative on a topic",
)
async def repr_opinions(
    party: str,
    reprName: str,
    topic: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Any:
    opinion_path = settings.speeches_dir / party / reprName / topic / "opinions.json"
    return loader.load_json(opinion_path)


@router.get("/visualization/{topic}", summary="Topic visualization data")
async def topic_visualization(
    topic: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    base = settings.visualization_dir
    visualization_1d = loader.load_json(base / f"{topic}_1d.json")
    visualization_2d = loader.load_json(base / f"{topic}_2d.json")
    return {"1d": visualization_1d, "2d": visualization_2d}


@router.get("/static", summary="Available static topics")
async def static_availabilities(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    return loader.load_json(settings.visualization_dir / "static" / "available.json")


@router.get("/diachronic", summary="Available diachronic topics")
async def diachronic_availabilities(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    return loader.load_json(settings.visualization_dir / "diachronic" / "available.json")


@router.get("/diachronic/{topic}/{axis}", summary="Diachronic visualization data")
async def diachronic_data(
    topic: str,
    axis: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    base = settings.visualization_dir / "diachronic" / topic / axis
    data_1d = loader.load_json(base / "diachronic.json")
    data_2d = loader.load_json(base / "diachronic_2d.json")
    return {"1d": data_1d, "2d": data_2d}


@router.get("/static/{topic}/{axis}", summary="Static visualization data")
async def static_data(
    topic: str,
    axis: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    base = settings.visualization_dir / "static" / topic / axis
    data_1d = loader.load_json(base / "gen_1d.json")
    data_2d = loader.load_json(base / "gen_2d.json")
    return {"1d": data_1d, "2d": data_2d}
