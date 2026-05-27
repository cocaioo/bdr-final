from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
GLOBAL_RANKING_QUESTIONS = ("q5", "q7", "q12", "q13")


def test_meta_endpoint_returns_questions() -> None:
    response = client.get("/api/meta")
    assert response.status_code == 200
    payload = response.json()
    assert "dataset_version" in payload
    assert "questions" in payload
    assert len(payload["questions"]) == 13
    assert "GLOBAL" not in {
        item["value"] for item in payload["available_filters"]["anos"]
    }


def test_question_endpoint_returns_payload() -> None:
    response = client.get("/api/questions/q1?page=1&page_size=20")
    assert response.status_code == 200
    payload = response.json()
    assert payload["question_id"] == "q1"
    assert "summary_cards" in payload
    assert "chart_spec" in payload
    assert "table_spec" in payload
    assert isinstance(payload["table_spec"]["rows"], list)


def test_q8_payload_uses_global_approved_total() -> None:
    response = client.get("/api/questions/q8?page=1&page_size=10")
    assert response.status_code == 200
    payload = response.json()

    first_row = payload["table_spec"]["rows"][0]
    assert first_row["nome"] == "Laura Carneiro"
    assert first_row["proposicoes_aprovadas"] == 10
    assert first_row["pct_aprovadas"] == 2.54
    assert payload["query_panel"]["explanation"].endswith(
        "no total global de proposicoes aprovadas."
    )

    summary_cards = {card["label"]: card["value"] for card in payload["summary_cards"]}
    assert summary_cards["Proposicoes aprovadas global"] == "394"


def test_q10_summary_cards_scale_alignment_percentages() -> None:
    response = client.get("/api/questions/q10?page=1&page_size=10")
    assert response.status_code == 200
    payload = response.json()

    summary_cards = {card["id"]: card for card in payload["summary_cards"]}
    assert summary_cards["media_alinhamento"]["value"] == "92,07"
    assert summary_cards["media_alinhamento"]["unit"] == "%"
    assert summary_cards["menor_alinhamento"]["value"] == "79,11"
    assert summary_cards["maior_alinhamento"]["value"] == "100"


def test_question_not_found_returns_404() -> None:
    response = client.get("/api/questions/q99")
    assert response.status_code == 404


def test_global_ranking_tables_are_returned_for_selected_questions() -> None:
    for question_id in GLOBAL_RANKING_QUESTIONS:
        response = client.get(f"/api/questions/{question_id}?page_size=10")
        assert response.status_code == 200
        payload = response.json()

        global_tables = _global_ranking_tables(payload)
        assert global_tables, f"{question_id} nao retornou Ranking global"


def test_global_ranking_ignores_year_filter() -> None:
    response = client.get("/api/questions/q7?anos=2024&page_size=10")
    assert response.status_code == 200
    payload = response.json()

    global_tables = _global_ranking_tables(payload)
    assert global_tables
    assert any(row.get("ano_dados") == "GLOBAL" for row in global_tables[0]["rows"])


def test_global_ranking_supports_sort_for_qtd_lancamentos_in_q5_and_q12() -> None:
    for question_id in ("q5", "q12"):
        response = client.get(f"/api/questions/{question_id}?page_size=20&sort_by=qtd_lancamentos&sort_dir=desc")
        assert response.status_code == 200
        table = _global_ranking_tables(response.json())[0]

        assert table["rows"]
        assert all(
            "|" not in str(row.get("fornecedor", ""))
            for row in table["rows"]
        )
        assert all(
            isinstance(row.get("qtd_lancamentos"), (int, float))
            for row in table["rows"]
            if row.get("qtd_lancamentos") is not None
        )


def test_partido_uf_filters_work_for_global_rankings_q7_q12_q13() -> None:
    for question_id in ("q7", "q12", "q13"):
        base_response = client.get(f"/api/questions/{question_id}?page_size=100")
        assert base_response.status_code == 200
        base_table = _global_ranking_tables(base_response.json())[0]

        sample_row = next(
            (
                row
                for row in base_table["rows"]
                if row.get("sigla_partido") and row.get("sigla_uf")
            ),
            None,
        )
        assert sample_row is not None

        partido = str(sample_row["sigla_partido"])
        uf = str(sample_row["sigla_uf"])

        partido_response = client.get(
            f"/api/questions/{question_id}?partidos={partido}&page_size=50"
        )
        assert partido_response.status_code == 200
        partido_table = _global_ranking_tables(partido_response.json())[0]
        assert partido_table["total"] > 0
        assert all(row.get("sigla_partido") == partido for row in partido_table["rows"])

        uf_response = client.get(f"/api/questions/{question_id}?ufs={uf}&page_size=50")
        assert uf_response.status_code == 200
        uf_table = _global_ranking_tables(uf_response.json())[0]
        assert uf_table["total"] > 0
        assert all(row.get("sigla_uf") == uf for row in uf_table["rows"])


def test_global_ranking_respects_pagination_controls() -> None:
    first_page = client.get("/api/questions/q7?page=1&page_size=5")
    second_page = client.get("/api/questions/q7?page=2&page_size=5")
    assert first_page.status_code == 200
    assert second_page.status_code == 200

    table_page_1 = _global_ranking_tables(first_page.json())[0]
    table_page_2 = _global_ranking_tables(second_page.json())[0]

    assert table_page_1["rows"]
    assert table_page_2["rows"]
    assert table_page_1["rows"][0] != table_page_2["rows"][0]


def _global_ranking_tables(payload: dict) -> list[dict]:
    return [
        table
        for table in payload["complement_tables"]
        if "ranking global" in table["title"].lower()
    ]

