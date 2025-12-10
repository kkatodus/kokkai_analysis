from functools import lru_cache

from fastapi import Depends

from ..core.config import Settings, get_settings
from ..services.data_loader import DataLoader


@lru_cache(maxsize=1)
def _loader(settings: Settings) -> DataLoader:
    return DataLoader(settings.root_dir)


def get_data_loader(settings: Settings = Depends(get_settings)) -> DataLoader:
    return _loader(settings)
