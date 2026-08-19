from __future__ import annotations

import hashlib
import hmac
import json
from copy import deepcopy
from pathlib import Path
from typing import Any


class FrozenCoreError(RuntimeError):
    """Raised when the Frozen Core cannot be trusted."""


class FrozenCore:
    """Loads and verifies the immutable factory contract.

    Runtime callers only receive defensive copies. The class intentionally has no
    write method, and startup fails closed if the digest does not match.
    """

    def __init__(self, core_path: Path, digest_path: Path) -> None:
        self._path = core_path
        self._digest_path = digest_path
        self._raw = self._read_verified_bytes()
        try:
            self._document: dict[str, Any] = json.loads(self._raw)
        except json.JSONDecodeError as exc:
            raise FrozenCoreError(f"Frozen Core is not valid JSON: {exc}") from exc

        if self._document.get("status") != "frozen":
            raise FrozenCoreError("Frozen Core must declare status=frozen")

    def _read_verified_bytes(self) -> bytes:
        try:
            raw = self._path.read_bytes()
            expected = self._digest_path.read_text(encoding="utf-8").split()[0].strip()
        except (OSError, IndexError) as exc:
            raise FrozenCoreError(f"Frozen Core files are unavailable: {exc}") from exc

        actual = hashlib.sha256(raw).hexdigest()
        if not hmac.compare_digest(actual, expected):
            raise FrozenCoreError(
                "Frozen Core integrity check failed. Restore core/FROZEN_CORE.json "
                "instead of updating its digest."
            )
        return raw

    @property
    def digest(self) -> str:
        return hashlib.sha256(self._raw).hexdigest()

    @property
    def document(self) -> dict[str, Any]:
        return deepcopy(self._document)

    @property
    def builder_contract(self) -> dict[str, Any]:
        return deepcopy(self._document["builder_contract"])
