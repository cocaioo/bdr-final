from __future__ import annotations

from fastapi.testclient import TestClient
import app.main as main_module
from app.service import DashboardService


def test_api_meta_contract_contains_groups_and_question_metadata() -> None:
    # Reset service to the real DashboardService to avoid contamination from other tests
    main_module.service = DashboardService()
    
    client = TestClient(main_module.app)
    response = client.get("/api/meta")
    assert response.status_code == 200
    
    payload = response.json()
    assert "groups" in payload
    assert isinstance(payload["groups"], list)
    assert len(payload["groups"]) > 0
    
    # Assert that all expected groups are present
    group_ids = {group["id"] for group in payload["groups"]}
    assert {"gastos", "perfil", "producao", "partidos"}.issubset(group_ids)
    
    # Verify that questions have group_id and tags
    assert "questions" in payload
    assert isinstance(payload["questions"], list)
    for question in payload["questions"]:
        assert "group_id" in question
        assert question["group_id"] is not None
        assert "tags" in question
        assert isinstance(question["tags"], list)
