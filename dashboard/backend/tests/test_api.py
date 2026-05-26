from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_meta_endpoint_returns_questions() -> None:
    response = client.get("/api/meta")
    assert response.status_code == 200
    payload = response.json()
    assert "dataset_version" in payload
    assert "questions" in payload
    assert len(payload["questions"]) == 13


def test_question_endpoint_returns_payload() -> None:
    response = client.get("/api/questions/q1?page=1&page_size=20")
    assert response.status_code == 200
    payload = response.json()
    assert payload["question_id"] == "q1"
    assert "summary_cards" in payload
    assert "chart_spec" in payload
    assert "table_spec" in payload
    assert isinstance(payload["table_spec"]["rows"], list)


def test_question_not_found_returns_404() -> None:
    response = client.get("/api/questions/q99")
    assert response.status_code == 404

