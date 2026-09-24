#!/usr/bin/env bash
# One-time factory setup for the cloud workspace. Runs automatically
# when the codespace is created. After this, just run ./hoolulu.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Setting up the Hoolulu Factory (one-time)..."
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install --quiet --disable-pip-version-check -r backend/requirements.txt
npm --prefix frontend ci --no-audit --no-fund --silent
npm --prefix frontend run build --silent
echo "Done. Run ./hoolulu to start the factory."
