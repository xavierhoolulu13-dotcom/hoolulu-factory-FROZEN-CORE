from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from app.core_guard import FrozenCore
from app.database import Repository
from app.services.builder import BuildValidationError, FactoryBuilder
from app.services.llm import OpenAICompatibleModel

ROOT = Path(__file__).resolve().parents[2]


def make_builder(tmp_path: Path) -> tuple[FactoryBuilder, Repository]:
    repository = Repository(tmp_path / "factory.db")
    repository.initialize()
    core = FrozenCore(
        ROOT / "core" / "FROZEN_CORE.json",
        ROOT / "core" / "FROZEN_CORE.sha256",
    )
    model = OpenAICompatibleModel(None, "https://example.invalid/v1", "test", 1)
    return (
        FactoryBuilder(repository, tmp_path / "runs", core.document, core.digest, model),
        repository,
    )


def test_builder_rejects_path_traversal(tmp_path: Path) -> None:
    builder, _ = make_builder(tmp_path)
    with pytest.raises(BuildValidationError, match="Unsafe output path"):
        builder.validate_files({"index.html": "<html></html>", "../core.json": "nope"})


def test_builder_rejects_environment_file(tmp_path: Path) -> None:
    builder, _ = make_builder(tmp_path)
    with pytest.raises(BuildValidationError, match="Environment files"):
        builder.validate_files({"index.html": "<html></html>", ".env.local": "KEY=value"})


@pytest.mark.asyncio
async def test_local_builder_creates_preview_and_archive(tmp_path: Path) -> None:
    builder, repository = make_builder(tmp_path)
    conversation = repository.create_conversation()
    build = repository.create_build(conversation["id"], "Build a coffee shop landing page")
    progress: list[str] = []

    async def record(stage: str, _detail: str) -> None:
        progress.append(stage)

    result = await builder.run(build["id"], build["prompt"], record)

    assert result.preview_path.joinpath("index.html").is_file()
    assert result.artifact_path.is_file()
    assert progress == ["understand", "plan", "generate", "validate", "package", "completed"]
    with zipfile.ZipFile(result.artifact_path) as archive:
        assert "index.html" in archive.namelist()
        assert "factory-manifest.json" in archive.namelist()
