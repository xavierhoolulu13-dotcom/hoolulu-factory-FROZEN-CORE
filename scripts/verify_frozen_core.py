#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "core" / "FROZEN_CORE.json"
DIGEST = ROOT / "core" / "FROZEN_CORE.sha256"


def main() -> int:
    expected = DIGEST.read_text(encoding="utf-8").split()[0]
    raw = CORE.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected:
        print("ERROR: Frozen Core digest mismatch.")
        print(f"expected: {expected}")
        print(f"actual:   {actual}")
        print("Restore the Core; do not regenerate its digest.")
        return 1
    document = json.loads(raw)
    if document.get("status") != "frozen":
        print("ERROR: Frozen Core does not declare frozen status.")
        return 1
    print(f"Frozen Core verified: {actual}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
