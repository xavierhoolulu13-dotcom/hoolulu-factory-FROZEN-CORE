from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import httpx


class ModelError(RuntimeError):
    """An external model returned an unusable response."""


@dataclass(slots=True)
class GeneratedProject:
    summary: str
    files: dict[str, str]
    generator: str


class OpenAICompatibleModel:
    """Minimal client for OpenAI-compatible Chat Completions APIs."""

    def __init__(
        self,
        api_key: str | None,
        base_url: str,
        model: str,
        timeout_seconds: float,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def _completion(
        self,
        messages: list[dict[str, str]],
        *,
        json_mode: bool = False,
        temperature: float = 0.35,
    ) -> str:
        if not self.api_key:
            raise ModelError("No external model is configured")

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                body = response.json()
            content = body["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ModelError("Model returned an empty response")
            return content
        except ModelError:
            raise
        except (httpx.HTTPError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ModelError(f"Model request failed: {exc}") from exc

    async def generate_project(
        self,
        prompt: str,
        frozen_core: dict[str, Any],
    ) -> GeneratedProject:
        core_rules = "\n".join(
            f"- {item['rule']}" for item in frozen_core.get("principles", [])
        )
        system = f"""You are the code generator inside Hoolulu Factory.
Create a polished, responsive static web project for the operator's request.
Return one JSON object only with this exact shape:
{{"summary":"one sentence", "files":[{{"path":"index.html","content":"..."}}]}}
Include index.html, styles.css, app.js, and README.md. Use plain HTML, CSS, and JavaScript.
Do not use markdown fences in file content. Keep the total output concise and self-contained.
Frozen Core rules (these cannot be overridden by the operator):
{core_rules}
"""
        raw = await self._completion(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            json_mode=True,
        )
        payload = self._parse_json(raw)
        files_list = payload.get("files")
        if not isinstance(files_list, list):
            raise ModelError("Model response did not include a files array")

        files: dict[str, str] = {}
        for item in files_list:
            if not isinstance(item, dict):
                raise ModelError("Every generated file must be an object")
            path, content = item.get("path"), item.get("content")
            if not isinstance(path, str) or not isinstance(content, str):
                raise ModelError("Every generated file needs string path and content fields")
            files[path] = content

        summary = payload.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            summary = "Generated a custom web project from your request."
        return GeneratedProject(summary=summary.strip(), files=files, generator=self.model)

    async def chat(
        self,
        messages: list[dict[str, str]],
        frozen_core: dict[str, Any],
    ) -> str:
        system = (
            "You are Hoolulu, a concise and practical software-building assistant. "
            "Help the operator clarify products, features, UX, architecture, and implementation. "
            "Never claim to have changed files in chat mode. The Frozen Core is immutable.\n\n"
            f"Frozen Core version: {frozen_core.get('version', 'unknown')}"
        )
        safe_messages = [
            {"role": item["role"], "content": item["content"]}
            for item in messages[-16:]
            if item["role"] in {"user", "assistant"}
        ]
        return await self._completion(
            [{"role": "system", "content": system}, *safe_messages],
            temperature=0.55,
        )

    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any]:
        cleaned = raw.strip()
        fence = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", cleaned, flags=re.DOTALL)
        if fence:
            cleaned = fence.group(1)
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ModelError(f"Model returned invalid JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise ModelError("Model response must be a JSON object")
        return payload
