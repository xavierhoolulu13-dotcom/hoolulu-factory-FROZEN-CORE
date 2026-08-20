from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str = Field(default="New build", min_length=1, max_length=80)


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class Message(BaseModel):
    id: str
    conversation_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    mode: Literal["build", "chat"]
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class Build(BaseModel):
    id: str
    conversation_id: str
    status: Literal["queued", "running", "completed", "failed"]
    stage: str
    prompt: str
    summary: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str
    download_url: str | None = None
    preview_url: str | None = None


class ConversationDetail(ConversationSummary):
    messages: list[Message] = Field(default_factory=list)
    builds: list[Build] = Field(default_factory=list)


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=12_000)
    mode: Literal["build", "chat"] = "build"


class CoreResponse(BaseModel):
    digest: str
    read_only: bool = True
    document: dict[str, Any]
