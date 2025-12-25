from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Defaults are set relative to the repository root so the backend works
    out of the box when running locally alongside the existing Node API
    data directories.
    """

    root_dir: Path = Path(__file__).resolve().parents[2]
    data_root: Path = root_dir / "api"
    sangiin_dir: Path = data_root / "data_sangiin"
    shugiin_dir: Path = data_root / "data_shugiin"
    speeches_dir: Path = data_root / "data_repr_speeches"
    stats_dir: Path = data_root / "data_stats"
    geo_dir: Path = data_root / "data_geo"
    reprs_dir: Path = data_root / "data_repr_speeches"
    policy_dir: Path = data_root / "data_visual"
    donors_dir: Path = data_root / "data_visual"
    visualization_dir: Path = data_root / "data_visual"

    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_publishable_key: str | None = Field(default=None, alias="STRIPE_PUBLISHABLE_KEY")
    frontend_url: str = Field(default="https://kokkaidoc.com", alias="FRONTEND_URL")
    manifesto_dir: Path = data_root / "data_manifesto" / "2025UpperHouseElection"

    cors_allow_origins: List[str] = [
        "http://localhost:3000",
        "https://www.kokkaidoc.com",
        "https://kokkaidoc.com",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
