from __future__ import annotations

from pathlib import Path

import pytest

from app.core_guard import FrozenCore, FrozenCoreError

ROOT = Path(__file__).resolve().parents[2]


def test_frozen_core_verifies() -> None:
    core = FrozenCore(
        ROOT / "core" / "FROZEN_CORE.json",
        ROOT / "core" / "FROZEN_CORE.sha256",
    )
    assert core.document["status"] == "frozen"
    assert len(core.digest) == 64


def test_frozen_core_fails_closed_after_mutation(tmp_path: Path) -> None:
    core_path = tmp_path / "FROZEN_CORE.json"
    digest_path = tmp_path / "FROZEN_CORE.sha256"
    original = (ROOT / "core" / "FROZEN_CORE.json").read_text(encoding="utf-8")
    core_path.write_text(original + "\n", encoding="utf-8")
    digest_path.write_text(
        (ROOT / "core" / "FROZEN_CORE.sha256").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    with pytest.raises(FrozenCoreError, match="integrity check failed"):
        FrozenCore(core_path, digest_path)
