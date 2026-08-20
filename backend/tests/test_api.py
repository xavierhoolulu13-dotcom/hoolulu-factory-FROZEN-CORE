from __future__ import annotations

from fastapi.testclient import TestClient


def test_core_is_get_only(client: TestClient) -> None:
    response = client.get("/api/core")
    assert response.status_code == 200
    assert response.json()["read_only"] is True
    assert client.post("/api/core", json={}).status_code == 405


def test_factory_build_flow(client: TestClient) -> None:
    created = client.post("/api/conversations", json={})
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    with client.stream(
        "POST",
        f"/api/conversations/{conversation_id}/messages",
        json={"content": "Build a launch page for a surf club", "mode": "build"},
    ) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: stage" in body
    assert "event: artifact" in body
    assert "event: done" in body

    detail = client.get(f"/api/conversations/{conversation_id}").json()
    assert len(detail["messages"]) == 2
    assert detail["builds"][0]["status"] == "completed"

    build = detail["builds"][0]
    preview = client.get(build["preview_url"])
    assert preview.status_code == 200
    assert "<html" in preview.text.lower()
    archive = client.get(build["download_url"])
    assert archive.status_code == 200
    assert archive.headers["content-type"] == "application/zip"
