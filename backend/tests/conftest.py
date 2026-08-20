from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        database_path=tmp_path / "factory.db",
        workspace_path=tmp_path / "runs",
        frozen_core_path=REPOSITORY_ROOT / "core" / "FROZEN_CORE.json",
        frozen_core_digest_path=REPOSITORY_ROOT / "core" / "FROZEN_CORE.sha256",
        frontend_dist_path=tmp_path / "missing-frontend",
        llm_api_key=None,
    )


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
