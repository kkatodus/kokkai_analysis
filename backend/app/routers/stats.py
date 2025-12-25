from typing import Any

from fastapi import APIRouter, Depends

from ..core.config import Settings, get_settings
from ..services.data_loader import DataLoader
from .dependencies import get_data_loader

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/city2poscsv", summary="City to position CSV")
async def city_to_position_csv(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    csv_path = settings.stats_dir / "position" / "japan_city_position.csv"
    csv_path = loader._ensure_within_base(csv_path)
    if not csv_path.exists():
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CSV not found")
    return csv_path.read_text(encoding="utf-8")


@router.get("/city2posjson", summary="City to position JSON")
async def city_to_position_json(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    json_path = settings.stats_dir / "position" / "japan_city_position.json"
    return loader.load_json(json_path)


@router.get("/city_population_over_years", summary="City population over years")
async def city_population_over_years(
    settings: Settings = Depends(get_settings), loader: DataLoader = Depends(get_data_loader)
) -> Any:
    population_path = settings.stats_dir / "population" / "city_population_array.json"
    return loader.load_json(population_path)
