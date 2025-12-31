from functools import lru_cache
from pathlib import Path

from typing import List, Optional
from enum import Enum
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Environment(str, Enum):
    LOCAL = "local"
    STAGING = "staging"
    PROD = "prod"
    DEV = "dev"

class StorageBackend(str, Enum):
    S3 = "s3"
    LOCAL = "local"

class Settings(BaseSettings):
    """Application configuration loaded from environment variables.

    Defaults are set relative to the repository root so the backend works
    out of the box when running locally alongside the existing Node API
    data directories.
    """
    env:Environment = Field(default=Environment.LOCAL, alias="ENVIRONMENT")
    storage_backend: StorageBackend = Field(default=StorageBackend.LOCAL, alias="STORAGE_BACKEND")

    # local storage root for development
    if env == Environment.LOCAL:
        local_data_root: Optional[Path] = Field(default=Path(__file__).resolve().parents[3] / "s3_mirror", alias="LOCAL_DATA_ROOT")
    else:
        local_data_root: Optional[Path] = Field(default=None, alias="LOCAL_DATA_ROOT")

    # s3 bucket stuff
    data_lake_bucket_name: Optional[str] = Field(default=None, alias="DATA_LAKE_BUCKET_NAME")
    data_lake_bucket_name_object_uri: Optional[str] = Field(default=None, alias="DATA_LAKE_BUCKET_NAME_OBJECT_URI")

    # CORS
    cors_allow_origins: List[str] = Field(default_factory=list, alias="CORS_ALLOW_ORIGINS")

    # Domain verification
    # Comma-separated or JSON list is supported by pydantic; prefer JSON in env for lists.
    allowed_hosts: List[str] = Field(default_factory=list, alias="ALLOWED_HOSTS")
    
    # api key
    api_key: str = Field(..., alias="API_KEY")
    api_key_header_name: str = Field(default="X-API-KEY", alias="API_KEY_HEADER_NAME")

    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_publishable_key: str | None = Field(default=None, alias="STRIPE_PUBLISHABLE_KEY")
    frontend_url: str = Field(default="https://kokkaidoc.com", alias="FRONTEND_URL")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    def __str__(self) -> str:
        return f"\nenv={self.env}\nstorage_backend={self.storage_backend}\nlocal_data_root={self.local_data_root}\ndata_lake_bucket_name={self.data_lake_bucket_name}\ndata_lake_bucket_name_object_uri={self.data_lake_bucket_name_object_uri}\ncors_allow_origins={self.cors_allow_origins}\napi_key={self.api_key}\napi_key_header_name={self.api_key_header_name}\nstripe_secret_key={self.stripe_secret_key}\nstripe_publishable_key={self.stripe_publishable_key}\nfrontend_url={self.frontend_url}"



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.env == Environment.LOCAL:
        print(f"Loaded settings: {settings}")

    return settings
