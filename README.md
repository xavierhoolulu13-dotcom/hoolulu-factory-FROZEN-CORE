# Hoolulu Factory · Frozen Core

A prompt-to-project factory with a ChatGPT-style interface, a safe auto-building backend, and an immutable runtime contract.

## Start — one command

```bash
./hoolulu
```

That is the entire setup. On its first run, the launcher quietly prepares its local environment, installs what it needs, builds the interface, and starts the app at **http://localhost:8000**. Later starts are immediate.

- No API key required
- No database setup
- No frontend/backend juggling
- No generated code is executed on your machine

If Docker is your preference, the equivalent one-command start is:

```bash
docker compose up --build
```

## What is included

### Chat-style frontend

- Familiar conversation sidebar, message stream, prompt composer, and build/chat modes
- Streaming factory status for understand → plan → generate → validate → package
- Persistent conversation history
- In-app source downloads and live project previews
- Responsive desktop and mobile layouts

### Auto-builder backend

The FastAPI backend turns a build prompt into a complete static project, validates it, records its provenance, packages it as a ZIP, and serves a sandboxed preview. The built-in local generator works immediately. An external model is optional, not a prerequisite.

Build artifacts are written under `.factory/runs/`; application history is stored in `.data/factory.db`. Both paths are ignored by Git.

### Read-only Frozen Core

[`core/FROZEN_CORE.json`](core/FROZEN_CORE.json) is the factory's immutable contract. It is protected in several layers:

1. Its SHA-256 digest is checked before the API starts.
2. The backend contains no Core write path and exposes it through `GET /api/core` only.
3. Runtime code receives defensive copies instead of the original object.
4. The file is set read-only by the launcher/container.
5. Automated tests fail closed when the Core does not match its locked digest.
6. Every artifact records the verified Core digest in `factory-manifest.json`.

Verify it manually with:

```bash
python3 scripts/verify_frozen_core.py
```

## Optional model connection

Local mode already builds polished projects. To enable fully custom model-generated files, copy `.env.example` to `.env` and set an OpenAI-compatible endpoint:

```dotenv
FACTORY_LLM_API_KEY=your-key
FACTORY_LLM_BASE_URL=https://api.openai.com/v1
FACTORY_LLM_MODEL=gpt-4o-mini
```

If that provider is unavailable, the factory automatically falls back to the safe local generator instead of failing.

## Architecture

```text
frontend/                  React + TypeScript chat interface
backend/app/               FastAPI, SQLite, SSE, builder pipeline
core/FROZEN_CORE.json      immutable factory contract
core/FROZEN_CORE.sha256    startup integrity digest
.factory/runs/             generated previews and ZIPs (runtime only)
.data/factory.db           conversation/build history (runtime only)
hoolulu                    zero-friction launcher
```

The frontend and API are served as one app in normal use. API documentation remains available at **http://localhost:8000/docs**.

## Safety boundaries

- Generated paths cannot be absolute, traverse directories, or target reserved files.
- File count and per-project size limits come from the Frozen Core.
- Secret-like material is blocked before artifact release.
- Generated source is written and packaged but never executed by the backend.
- Preview assets receive a restrictive Content Security Policy.

## Development checks

```bash
# Backend
.venv/bin/ruff check backend/app backend/tests
PYTHONPATH=backend .venv/bin/pytest backend/tests

# Frontend
npm --prefix frontend run build
```
