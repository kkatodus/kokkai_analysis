from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from core.config import Settings, get_settings
from services.data_loader import DataLoader
from routers.dependencies import get_data_loader

router = APIRouter(prefix="/reprs", tags=["reprs"])


def _filter_reprs_by_district(entries: List[Dict[str, Any]], predicate) -> List[Dict[str, Any]]:
    return [repr_entry for repr_entry in entries if predicate(repr_entry)]


@router.get("/{district_name}", summary="Representatives by district")
async def district_reprs(
    district_name: str,
    settings: Settings = Depends(get_settings),
    loader: DataLoader = Depends(get_data_loader),
) -> Dict[str, Any]:
    raw_district_name = district_name.replace("区", "")
    prefecture = "".join(ch for ch in raw_district_name if not ch.isdigit())

    upper_data = loader.load_first_json(settings.sangiin_dir / "repr_list")
    lower_data = loader.load_first_json(settings.shugiin_dir / "repr_list")

    upper_reprs = []
    for party, reprs in upper_data.get("reprs", {}).items():
        upper_reprs.extend(
            _filter_reprs_by_district(reprs, lambda repr_entry: prefecture in repr_entry.get("district", ""))
        )

    lower_reprs = []
    for party, reprs in lower_data.get("reprs", {}).items():
        lower_reprs.extend(
            _filter_reprs_by_district(reprs, lambda repr_entry: repr_entry.get("district") == raw_district_name)
        )

    return {"upper_reprs": upper_reprs, "lower_reprs": lower_reprs}
