from __future__ import annotations

from typing import Any

from app.services.llm import ModelError, OpenAICompatibleModel


class ChatService:
    def __init__(self, model: OpenAICompatibleModel, frozen_core: dict[str, Any]) -> None:
        self.model = model
        self.frozen_core = frozen_core

    async def respond(self, messages: list[dict[str, Any]]) -> str:
        if self.model.configured:
            try:
                return await self.model.chat(messages, self.frozen_core)
            except ModelError:
                pass

        latest = messages[-1]["content"].strip() if messages else ""
        lower = latest.lower()
        if any(word in lower for word in ("hello", "hey", "hi ")) or lower in {"hi", "hey"}:
            return (
                "Hi — I’m Hoolulu. I can help shape your idea here, or you can switch to "
                "**Build mode** and I’ll turn a prompt into a previewable project. What are we making?"
            )
        if "frozen core" in lower or "core" in lower:
            return (
                "The **Frozen Core** is the factory’s read-only contract. Its SHA-256 digest is "
                "verified every time the API starts, it is exposed through a GET-only endpoint, "
                "and every generated artifact records that digest for traceability."
            )
        return (
            "I can help you turn that into a concrete build. A strong build prompt usually names:\n\n"
            "- **Who it is for**\n"
            "- **The main action** the user should take\n"
            "- **Three or four must-have sections or features**\n"
            "- A preferred **visual direction**\n\n"
            "When you’re ready, switch the composer to **Build mode**. The local factory works "
            "without an AI key; connecting an OpenAI-compatible model makes generation fully custom."
        )
