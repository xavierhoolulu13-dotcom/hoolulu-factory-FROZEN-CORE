from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse

from app.schemas import (
    Build,
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    CoreResponse,
    MessageCreate,
)
from app.sse import encode_sse, text_chunks

logger = logging.getLogger(__name__)
api = APIRouter(prefix="/api")


def _services(request: Request):
    return request.app.state.repository, request.app.state.factory


def _public_build(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if not record:
        return None
    item = {
        key: record.get(key)
        for key in (
            "id",
            "conversation_id",
            "status",
            "stage",
            "prompt",
            "summary",
            "error",
            "created_at",
            "updated_at",
        )
    }
    if record.get("status") == "completed":
        item["download_url"] = f"/api/builds/{record['id']}/download"
        item["preview_url"] = f"/api/builds/{record['id']}/preview/"
    else:
        item["download_url"] = None
        item["preview_url"] = None
    return item


def _public_detail(detail: dict[str, Any]) -> dict[str, Any]:
    return {
        **detail,
        "builds": [_public_build(build) for build in detail.get("builds", [])],
    }


@api.get("/health")
def health(request: Request) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": request.app.state.settings.app_name,
        "core": request.app.state.frozen_core.digest[:12],
        "model_connected": request.app.state.model.configured,
    }


@api.get("/core", response_model=CoreResponse)
def get_core(request: Request) -> dict[str, Any]:
    frozen_core = request.app.state.frozen_core
    return {
        "digest": frozen_core.digest,
        "read_only": True,
        "document": frozen_core.document,
    }


@api.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(request: Request):
    repository, _ = _services(request)
    return repository.list_conversations()


@api.post(
    "/conversations",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(payload: ConversationCreate, request: Request):
    repository, _ = _services(request)
    return repository.create_conversation(payload.title)


@api.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: str, request: Request):
    repository, _ = _services(request)
    detail = repository.conversation_detail(conversation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _public_detail(detail)


@api.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, request: Request):
    repository, factory = _services(request)
    detail = repository.conversation_detail(conversation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Conversation not found")
    repository.delete_conversation(conversation_id)

    workspace = factory.workspace.resolve()
    for build in detail["builds"]:
        build_root = (workspace / build["id"]).resolve()
        if build_root.is_relative_to(workspace):
            shutil.rmtree(build_root, ignore_errors=True)
    return None


@api.post("/conversations/{conversation_id}/messages")
async def create_message(conversation_id: str, payload: MessageCreate, request: Request):
    repository, factory = _services(request)
    if not repository.get_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    prompt = payload.content.strip()
    user_message = repository.add_message(
        conversation_id, "user", prompt, payload.mode
    )
    repository.set_title_from_prompt(conversation_id, prompt)

    async def stream():
        yield encode_sse("accepted", {"message": user_message})

        if payload.mode == "chat":
            messages = repository.list_messages(conversation_id)
            response_text = await request.app.state.chat_service.respond(messages)
            for chunk in text_chunks(response_text):
                yield encode_sse("token", {"content": chunk})
                await asyncio.sleep(0)
            assistant = repository.add_message(
                conversation_id, "assistant", response_text, "chat"
            )
            yield encode_sse(
                "done",
                {
                    "message": assistant,
                    "conversation": repository.get_conversation(conversation_id),
                    "build": None,
                },
            )
            return

        build = repository.create_build(conversation_id, prompt)
        yield encode_sse("build", {"build": _public_build(build)})
        progress_queue: asyncio.Queue[dict[str, str] | None] = asyncio.Queue()
        outcome: dict[str, Any] = {}

        async def on_progress(stage: str, detail: str) -> None:
            await progress_queue.put({"stage": stage, "detail": detail})

        async def worker() -> None:
            try:
                outcome["result"] = await factory.run(
                    build["id"], prompt, on_progress
                )
            except Exception as exc:  # failure must become a durable build state
                logger.exception("Build %s failed", build["id"])
                outcome["error"] = exc
                repository.update_build(
                    build["id"],
                    status="failed",
                    stage="failed",
                    error="The generated project did not pass the factory pipeline.",
                )
                await progress_queue.put(
                    {
                        "stage": "failed",
                        "detail": "The build stopped before an artifact was released",
                    }
                )
            finally:
                await progress_queue.put(None)

        task = asyncio.create_task(worker())
        while True:
            progress = await progress_queue.get()
            if progress is None:
                break
            yield encode_sse("stage", progress)
        await task

        final_build = repository.get_build(build["id"])
        if "error" in outcome:
            response_text = (
                "I couldn’t release this build because its generated output failed the Frozen "
                "Core validation checks. Try simplifying the request, and I’ll run it again."
            )
            event_name = "build_error"
        else:
            result = outcome["result"]
            file_list = ", ".join(f"`{name}`" for name in result.files)
            response_text = (
                f"Done — {result.summary}\n\n"
                f"The factory validated and packaged {len(result.files)} files: {file_list}. "
                "Use the artifact card to open the live preview or download the source."
            )
            event_name = "artifact"
            yield encode_sse(
                event_name,
                {
                    "build": _public_build(final_build),
                    "files": result.files,
                    "generator": result.generator,
                },
            )

        for chunk in text_chunks(response_text):
            yield encode_sse("token", {"content": chunk})
            await asyncio.sleep(0)

        assistant = repository.add_message(
            conversation_id,
            "assistant",
            response_text,
            "build",
            {"build_id": build["id"]},
        )
        if event_name == "build_error":
            yield encode_sse(
                event_name,
                {"build": _public_build(final_build), "message": response_text},
            )
        yield encode_sse(
            "done",
            {
                "message": assistant,
                "conversation": repository.get_conversation(conversation_id),
                "build": _public_build(final_build),
            },
        )

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@api.get("/builds/{build_id}", response_model=Build)
def get_build(build_id: str, request: Request):
    repository, _ = _services(request)
    build = repository.get_build(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return _public_build(build)


def _verified_build_path(request: Request, build: dict[str, Any], field: str) -> Path:
    value = build.get(field)
    if build.get("status") != "completed" or not value:
        raise HTTPException(status_code=409, detail="Build artifact is not ready")
    workspace = request.app.state.factory.workspace.resolve()
    path = Path(value).resolve()
    if not path.is_relative_to(workspace):
        raise HTTPException(status_code=403, detail="Invalid artifact path")
    return path


@api.get("/builds/{build_id}/download")
def download_build(build_id: str, request: Request):
    repository, _ = _services(request)
    build = repository.get_build(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    artifact = _verified_build_path(request, build, "artifact_path")
    if not artifact.is_file():
        raise HTTPException(status_code=404, detail="Artifact file is missing")
    return FileResponse(
        artifact,
        filename=artifact.name,
        media_type="application/zip",
    )


@api.get("/builds/{build_id}/preview/")
@api.get("/builds/{build_id}/preview/{asset_path:path}")
def preview_build(build_id: str, request: Request, asset_path: str = ""):
    repository, _ = _services(request)
    build = repository.get_build(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    preview_root = _verified_build_path(request, build, "preview_path")
    requested = asset_path or "index.html"
    target = (preview_root / requested).resolve()
    if not target.is_relative_to(preview_root) or any(
        part.startswith(".") for part in Path(requested).parts
    ):
        raise HTTPException(status_code=403, detail="Invalid preview path")
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Preview asset not found")

    response = FileResponse(target)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'none'; "
        "frame-ancestors 'self'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
