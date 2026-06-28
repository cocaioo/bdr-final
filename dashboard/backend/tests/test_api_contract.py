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


def test_q7_defaults_to_global_and_year_filter_returns_annual_scope() -> None:
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    response_global = client.get("/api/questions/q7?page_size=5")
    assert response_global.status_code == 200
    payload_global = response_global.json()
    assert payload_global["table_spec"]["total"] > 0
    assert {
        row["escopo"] for row in payload_global["table_spec"]["rows"]
    } == {"global"}
    assert all(row["ano_dados"] is None for row in payload_global["table_spec"]["rows"])
    assert payload_global["table_spec"]["rows"][0]["periodo_label"] == "Global"

    response_2023 = client.get("/api/questions/q7?ano=2023&page_size=5")
    assert response_2023.status_code == 200
    payload_2023 = response_2023.json()
    assert payload_2023["table_spec"]["total"] > 0
    assert {
        row["escopo"] for row in payload_2023["table_spec"]["rows"]
    } == {"anual"}
    assert {
        row["ano_dados"] for row in payload_2023["table_spec"]["rows"]
    } == {2023}

    response_2026 = client.get("/api/questions/q7?ano_dados=2026&page_size=5")
    assert response_2026.status_code == 200
    payload_2026 = response_2026.json()
    assert payload_2026["table_spec"]["total"] > 0
    assert all(row["ano_parcial"] is True for row in payload_2026["table_spec"]["rows"])


def test_q7_nome_filter_preserves_real_position_and_uses_name_only() -> None:
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    response = client.get("/api/questions/q7?nome=abilio&page_size=5")
    assert response.status_code == 200
    payload = response.json()
    assert payload["table_spec"]["total"] == 1

    row = payload["table_spec"]["rows"][0]
    assert row["nome_parlamentar"] == "Abilio Brunini"
    assert row["posicao"] == 167
    assert row["deputado"] == "Abilio Brunini"
    assert row["partido"] == "PL"
    assert row["estado"] == "MT"

    response_party = client.get("/api/questions/q7?nome=republicanos&page_size=5")
    assert response_party.status_code == 200
    assert response_party.json()["table_spec"]["total"] == 0


def test_q7_nome_combined_with_estado_and_partido() -> None:
    """Search by name works together with state and party filters."""
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    # nome + estado
    r1 = client.get("/api/questions/q7?nome=amom&estado=AM")
    assert r1.status_code == 200
    p1 = r1.json()
    assert p1["table_spec"]["total"] == 1
    assert p1["table_spec"]["rows"][0]["nome_parlamentar"] == "Amom Mandel"

    # nome + partido
    r2 = client.get("/api/questions/q7?nome=amom&partido=REPUBLICANOS")
    assert r2.status_code == 200
    assert r2.json()["table_spec"]["total"] == 1

    # nome + wrong estado -> 0 results
    r3 = client.get("/api/questions/q7?nome=amom&estado=SP")
    assert r3.status_code == 200
    assert r3.json()["table_spec"]["total"] == 0

    # nome + ano
    r4 = client.get("/api/questions/q7?ano=2023&nome=amom")
    assert r4.status_code == 200
    assert r4.json()["table_spec"]["total"] == 1


def test_q7_eligibility_excludes_low_spending_deputies() -> None:
    """Deputies with gasto_total < 10000 must not appear in ranking."""
    main_module.service = DashboardService()
    client = TestClient(main_module.app)

    # Fetch all pages to check every deputy in the ranking
    all_rows: list = []
    page = 1
    while True:
        r = client.get(f"/api/questions/q7?page={page}&page_size=200")
        assert r.status_code == 200
        rows = r.json()["table_spec"]["rows"]
        all_rows.extend(rows)
        if len(rows) < 200:
            break
        page += 1

    assert len(all_rows) > 0
    for row in all_rows:
        assert float(row["gasto_total"]) >= 10000, (
            f'{row["nome_parlamentar"]} has gasto_total={row["gasto_total"]} < 10000'
        )
    for row in all_rows:
        assert row["elegivel_ranking"] is True, (
            f'{row["nome_parlamentar"]} is not elegivel_ranking'
        )
