from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


class Repository:
    """Small SQLite repository for conversations, messages, and build records."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    @contextmanager
    def _connection(self):
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connection() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode = WAL;

                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                    content TEXT NOT NULL,
                    mode TEXT NOT NULL CHECK (mode IN ('build', 'chat')),
                    meta_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS builds (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
                    stage TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    summary TEXT,
                    artifact_path TEXT,
                    preview_path TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                    ON messages(conversation_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_builds_conversation
                    ON builds(conversation_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_conversations_updated
                    ON conversations(updated_at DESC);
                """
            )

    def create_conversation(self, title: str = "New build") -> dict[str, Any]:
        conversation_id = str(uuid4())
        now = utc_now()
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conversation_id, title.strip(), now, now),
            )
        return self.get_conversation(conversation_id)

    def list_conversations(self) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT id, title, created_at, updated_at FROM conversations "
                "ORDER BY updated_at DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
        return dict(row) if row else None

    def conversation_detail(self, conversation_id: str) -> dict[str, Any] | None:
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return None
        conversation["messages"] = self.list_messages(conversation_id)
        conversation["builds"] = self.list_builds(conversation_id)
        return conversation

    def delete_conversation(self, conversation_id: str) -> bool:
        with self._connection() as connection:
            cursor = connection.execute(
                "DELETE FROM conversations WHERE id = ?", (conversation_id,)
            )
        return cursor.rowcount > 0

    def set_title_from_prompt(self, conversation_id: str, prompt: str) -> None:
        title = " ".join(prompt.strip().split())
        for prefix in ("please build ", "build me ", "create me ", "create ", "build ", "make "):
            if title.lower().startswith(prefix):
                title = title[len(prefix) :]
                break
        title = title[:52].rstrip(" .,:;-") or "New build"
        if len(prompt.strip()) > len(title):
            title += "…"
        now = utc_now()
        with self._connection() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            if row and row["count"] <= 1:
                connection.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                    (title, now, conversation_id),
                )
            else:
                connection.execute(
                    "UPDATE conversations SET updated_at = ? WHERE id = ?",
                    (now, conversation_id),
                )

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        mode: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        message_id = str(uuid4())
        now = utc_now()
        with self._connection() as connection:
            connection.execute(
                """
                INSERT INTO messages
                    (id, conversation_id, role, content, mode, meta_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message_id,
                    conversation_id,
                    role,
                    content,
                    mode,
                    json.dumps(meta or {}),
                    now,
                ),
            )
            connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
        return self.get_message(message_id)

    def get_message(self, message_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        return self._message_from_row(row) if row else None

    def list_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC",
                (conversation_id,),
            ).fetchall()
        return [self._message_from_row(row) for row in rows]

    @staticmethod
    def _message_from_row(row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        item["meta"] = json.loads(item.pop("meta_json") or "{}")
        return item

    def create_build(self, conversation_id: str, prompt: str) -> dict[str, Any]:
        build_id = str(uuid4())
        now = utc_now()
        with self._connection() as connection:
            connection.execute(
                """
                INSERT INTO builds
                    (id, conversation_id, status, stage, prompt, created_at, updated_at)
                VALUES (?, ?, 'queued', 'queued', ?, ?, ?)
                """,
                (build_id, conversation_id, prompt, now, now),
            )
        return self.get_build(build_id)

    def update_build(self, build_id: str, **updates: Any) -> dict[str, Any]:
        allowed = {
            "status",
            "stage",
            "summary",
            "artifact_path",
            "preview_path",
            "error",
        }
        values = {key: value for key, value in updates.items() if key in allowed}
        if not values:
            return self.get_build(build_id)
        values["updated_at"] = utc_now()
        assignments = ", ".join(f"{key} = ?" for key in values)
        with self._connection() as connection:
            connection.execute(
                f"UPDATE builds SET {assignments} WHERE id = ?",  # noqa: S608 - fixed allowlist
                (*values.values(), build_id),
            )
        return self.get_build(build_id)

    def get_build(self, build_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute("SELECT * FROM builds WHERE id = ?", (build_id,)).fetchone()
        return dict(row) if row else None

    def list_builds(self, conversation_id: str) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM builds WHERE conversation_id = ? ORDER BY created_at DESC",
                (conversation_id,),
            ).fetchall()
        return [dict(row) for row in rows]
