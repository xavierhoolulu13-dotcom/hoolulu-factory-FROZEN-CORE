from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings, all optionally configurable with FACTORY_* variables."""

    model_config = SettingsConfigDict(
        env_prefix="FACTORY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Hoolulu Factory"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    database_path: Path = REPOSITORY_ROOT / ".data" / "factory.db"
    workspace_path: Path = REPOSITORY_ROOT / ".factory" / "runs"
    frozen_core_path: Path = REPOSITORY_ROOT / "core" / "FROZEN_CORE.json"
    frozen_core_digest_path: Path = REPOSITORY_ROOT / "core" / "FROZEN_CORE.sha256"
    frontend_dist_path: Path = REPOSITORY_ROOT / "frontend" / "dist"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    llm_api_key: str | None = Field(default=None, repr=False)
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 90.0

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
