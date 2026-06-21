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

    q6 = next(question for question in payload["questions"] if question["id"] == "q6")
    assert {"anos", "escolaridade"}.issubset(q6["supported_filters"])


def test_q6_accepts_escolaridade_filter() -> None:
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    response = client.get("/api/questions/q6?escolaridade=Mestrado&page_size=200")

    assert response.status_code == 200
    payload = response.json()
    assert payload["table_spec"]["total"] > 0
    assert {
        row["escolaridade"] for row in payload["table_spec"]["rows"]
    } == {"Mestrado"}


def test_q12_deputy_filter_populates_main_table_and_keeps_complements() -> None:
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    response_all = client.get("/api/questions/q12?page_size=5")
    assert response_all.status_code == 200
    payload_all = response_all.json()
    assert payload_all["table_spec"]["total"] > 0

    response_filtered = client.get("/api/questions/q12?deputados=220593&page_size=5")
    assert response_filtered.status_code == 200
    payload_filtered = response_filtered.json()
    assert payload_filtered["table_spec"]["total"] > 0
    assert len(payload_filtered["table_spec"]["rows"]) > 0
    assert {
        str(row["id_deputado"]) for row in payload_filtered["table_spec"]["rows"]
    } == {"220593"}
    assert payload_filtered["complement_tables"]
    assert all(table["total"] > 0 for table in payload_filtered["complement_tables"])
