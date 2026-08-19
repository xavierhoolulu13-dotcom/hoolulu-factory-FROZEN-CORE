from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any


def encode_sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


def text_chunks(text: str, words_per_chunk: int = 7) -> Iterable[str]:
    """Yield natural-looking chunks without losing whitespace."""

    words = text.split(" ")
    for index in range(0, len(words), words_per_chunk):
        chunk = " ".join(words[index : index + words_per_chunk])
        if index + words_per_chunk < len(words):
            chunk += " "
        yield chunk
