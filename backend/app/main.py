from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api
from app.config import Settings, get_settings
from app.core_guard import FrozenCore
from app.database import Repository
from app.services.builder import FactoryBuilder
from app.services.chat import ChatService
from app.services.llm import OpenAICompatibleModel


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        repository = Repository(runtime_settings.database_path)
        repository.initialize()
        runtime_settings.workspace_path.mkdir(parents=True, exist_ok=True)

        frozen_core = FrozenCore(
            runtime_settings.frozen_core_path,
            runtime_settings.frozen_core_digest_path,
        )
        model = OpenAICompatibleModel(
            runtime_settings.llm_api_key,
            runtime_settings.llm_base_url,
            runtime_settings.llm_model,
            runtime_settings.llm_timeout_seconds,
        )
        factory = FactoryBuilder(
            repository,
            runtime_settings.workspace_path,
            frozen_core.document,
            frozen_core.digest,
            model,
        )

        application.state.settings = runtime_settings
        application.state.repository = repository
        application.state.frozen_core = frozen_core
        application.state.model = model
        application.state.factory = factory
        application.state.chat_service = ChatService(model, frozen_core.document)
        yield

    app = FastAPI(
        title="Hoolulu Factory API",
        version="0.1.0",
        description="A read-only Frozen Core with a safe, prompt-driven project factory.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=runtime_settings.allowed_origins,
        allow_origin_regex=r"https://[a-zA-Z0-9-]+\.e2b\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api)

    if runtime_settings.frontend_dist_path.is_dir():
        app.mount(
            "/",
            StaticFiles(directory=runtime_settings.frontend_dist_path, html=True),
            name="frontend",
        )

    return app


app = create_app()
