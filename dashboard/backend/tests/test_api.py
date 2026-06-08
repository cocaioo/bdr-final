from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.filter_engine import FilterState
from app.main import app
from app.service import DashboardService


TABLE_TEXT_Q1 = """Tabela principal
ano_dados | eixo_maior | sigla_partido | sigla_uf | id_deputado | nome | valor_total
----------+------------+---------------+----------+-------------+-----------+------------
2024      | Social     | PT            | SP       | 1           | Ana Silva | 10
2023      | Economia   | PL            | RJ       | 2           | Bruno Lima | 20
(2 rows)
"""

TABLE_TEXT_Q2 = """Tabela principal
ano_dados | eixo_maior | sigla_partido | sigla_uf | id_deputado | nome | valor_total
----------+------------+---------------+----------+-------------+-----------+------------
2023      | Social     | PL            | MG       | 3           | Cid Nascimento | 30
(1 rows)
"""

TABLE_TEXT_Q3 = """Tabela principal
ano_dados | eixo_maior | sigla_partido | sigla_uf | id_deputado | nome | valor_total
----------+------------+---------------+----------+-------------+-----------+------------
2025      | Saude      | MDB           | BA       | 4           | Dora Mendes | 40
(1 rows)
"""


def _write_response_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_sql_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("SELECT 1;\n", encoding="utf-8")


def _write_party_catalog(root: Path, rows: list[tuple[str, str, str]]) -> None:
    catalog_dir = root / "catalogos"
    catalog_dir.mkdir(parents=True, exist_ok=True)
    lines = ["sigla_partido;status;ideologia"]
    lines.extend(";".join(row) for row in rows)
    (catalog_dir / "partidos.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _build_registry(root: Path) -> Path:
    registry = {
        "legend": {},
        "questions": [
            {
                "id": "q1",
                "title": "Legacy response",
                "description": "Question that still uses the legacy respostas/ folder.",
                "response_files": ["legacy_q1.txt"],
                "sql_file": "q1.sql",
                "chart_type": "bar_horizontal",
                "supported_filters": ["anos", "eixos", "partidos", "ufs", "deputados"],
                "expected_columns": ["id_deputado", "nome", "valor_total"],
                "main_table_contains": "Tabela principal",
                "summary_table_contains": "",
                "explanation": "Teste de fallback legado.",
                "chart": {"x_field": "nome", "y_fields": ["valor_total"]},
            },
            {
                "id": "q2",
                "title": "New response path",
                "description": "Question that already points to a member/question path.",
                "response_files": ["Caio/q2/q2_new.txt"],
                "sql_file": "q2.sql",
                "chart_type": "bar_horizontal",
                "supported_filters": ["anos"],
                "expected_columns": ["id_deputado", "nome", "valor_total"],
                "main_table_contains": "Tabela principal",
                "summary_table_contains": "",
                "explanation": "Teste de path novo.",
                "chart": {"x_field": "nome", "y_fields": ["valor_total"]},
            },
            {
                "id": "q3",
                "title": "Member fallback",
                "description": "Question that still uses a legacy filename but lives under Caio/q3.",
                "response_files": ["q3_member_fallback.txt"],
                "sql_file": "q3.sql",
                "chart_type": "bar_horizontal",
                "supported_filters": ["deputados"],
                "expected_columns": ["id_deputado", "nome", "valor_total"],
                "main_table_contains": "Tabela principal",
                "summary_table_contains": "",
                "explanation": "Teste de fallback por nome do arquivo na arvore do repo.",
                "chart": {"x_field": "nome", "y_fields": ["valor_total"]},
            },
        ],
    }
    registry_path = root / "question_registry.json"
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    return registry_path


def _build_service(root: Path) -> DashboardService:
    responses_dir = root / "respostas"
    sql_dir = root / "sql"

    _write_response_file(responses_dir / "legacy_q1.txt", TABLE_TEXT_Q1)
    _write_response_file(root / "Caio" / "q2" / "q2_new.txt", TABLE_TEXT_Q2)
    _write_response_file(root / "Caio" / "q3" / "q3_member_fallback.txt", TABLE_TEXT_Q3)
    _write_sql_file(sql_dir / "q1.sql")
    _write_sql_file(sql_dir / "q2.sql")
    _write_sql_file(sql_dir / "q3.sql")

    return DashboardService(
        registry_path=_build_registry(root),
        responses_dir=responses_dir,
        sql_dir=sql_dir,
        repo_root=root,
    )


def _client_for(service: DashboardService) -> TestClient:
    import app.main as main_module

    main_module.service = service
    return TestClient(main_module.app)


def test_meta_endpoint_collects_filters_from_new_and_legacy_paths(tmp_path: Path) -> None:
    client = _client_for(_build_service(tmp_path))

    response = client.get("/api/meta")
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["questions"]) == 3
    assert {item["value"] for item in payload["available_filters"]["anos"]} == {
        "2023",
        "2024",
        "2025",
    }
    assert {item["value"] for item in payload["available_filters"]["eixos"]} == {
        "Social",
        "Economia",
        "Saude",
    }
    assert {item["value"] for item in payload["available_filters"]["partidos"]} == {
        "PT",
        "PL",
        "MDB",
    }
    assert {item["value"] for item in payload["available_filters"]["ufs"]} == {
        "SP",
        "RJ",
        "MG",
        "BA",
    }
    assert {item["value"] for item in payload["available_filters"]["deputados"]} == {
        "Ana Silva",
        "Bruno Lima",
        "Cid Nascimento",
        "Dora Mendes",
    }


def test_meta_endpoint_uses_active_party_catalog_when_available(tmp_path: Path) -> None:
    _write_party_catalog(
        tmp_path,
        [
            ("PT", "ativo", "esquerda"),
            ("PL", "ativo", "direita"),
            ("ARENA", "historico", "direita"),
        ],
    )
    client = _client_for(_build_service(tmp_path))

    response = client.get("/api/meta")
    assert response.status_code == 200

    parties = response.json()["available_filters"]["partidos"]
    assert [item["value"] for item in parties] == ["PL", "PT"]
    assert {item["status"] for item in parties} == {"ativo"}


def test_question_endpoint_applies_filters_sorting_and_pagination(tmp_path: Path) -> None:
    client = _client_for(_build_service(tmp_path))

    filtered = client.get(
        "/api/questions/q1?anos=2024&eixos=Social&partidos=PT&ufs=SP&deputados=1&page=1&page_size=10"
    )
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["table_spec"]["total"] == 1
    assert filtered_payload["table_spec"]["rows"][0]["nome"] == "Ana Silva"

    sorted_first_page = client.get("/api/questions/q1?sort_by=valor_total&sort_dir=desc&page=1&page_size=1")
    sorted_second_page = client.get("/api/questions/q1?sort_by=valor_total&sort_dir=desc&page=2&page_size=1")
    assert sorted_first_page.status_code == 200
    assert sorted_second_page.status_code == 200
    assert sorted_first_page.json()["table_spec"]["rows"][0]["nome"] == "Bruno Lima"
    assert sorted_second_page.json()["table_spec"]["rows"][0]["nome"] == "Ana Silva"


def test_question_endpoint_normalizes_party_filter_aliases(tmp_path: Path) -> None:
    service = _build_service(tmp_path)
    _write_response_file(
        tmp_path / "respostas" / "legacy_q1.txt",
        """Tabela principal
ano_dados | eixo_maior | sigla_partido | sigla_uf | id_deputado | nome | valor_total
----------+------------+---------------+----------+-------------+-----------+------------
2024      | Social     | REPUBLICANOS  | SP       | 1           | Ana Silva | 10
(1 rows)
""",
    )
    service._version_cache = None
    client = _client_for(service)

    response = client.get("/api/questions/q1?partidos=republic&page_size=10")
    assert response.status_code == 200
    payload = response.json()
    assert payload["table_spec"]["total"] == 1
    assert payload["table_spec"]["rows"][0]["sigla_partido"] == "REPUBLICANOS"


def test_question_endpoint_uses_new_paths_and_member_fallback(tmp_path: Path) -> None:
    client = _client_for(_build_service(tmp_path))

    new_path_response = client.get("/api/questions/q2?page=1&page_size=10")
    assert new_path_response.status_code == 200
    assert new_path_response.json()["table_spec"]["rows"][0]["nome"] == "Cid Nascimento"

    member_fallback_response = client.get("/api/questions/q3?page=1&page_size=10")
    assert member_fallback_response.status_code == 200
    assert member_fallback_response.json()["table_spec"]["rows"][0]["nome"] == "Dora Mendes"


def test_question_endpoint_ignores_unsupported_filters(tmp_path: Path) -> None:
    client = _client_for(_build_service(tmp_path))

    response = client.get("/api/questions/q2?partidos=PT&ufs=SP&deputados=1&anos=2023&page_size=10")
    assert response.status_code == 200
    payload = response.json()
    assert payload["table_spec"]["total"] == 1
    assert payload["table_spec"]["rows"][0]["sigla_partido"] == "PL"
    assert payload["table_spec"]["rows"][0]["sigla_uf"] == "MG"


def test_missing_response_file_returns_clear_error(tmp_path: Path) -> None:
    root = tmp_path
    sql_dir = root / "sql"
    sql_dir.mkdir(parents=True, exist_ok=True)
    _write_sql_file(sql_dir / "q1.sql")
    registry = {
        "legend": {},
        "questions": [
            {
                "id": "q1",
                "title": "Missing",
                "description": "Missing response file.",
                "response_files": ["missing_q1.txt"],
                "sql_file": "q1.sql",
                "chart_type": "bar_horizontal",
                "supported_filters": [],
                "expected_columns": [],
                "main_table_contains": "Tabela principal",
                "summary_table_contains": "",
                "explanation": "Teste de erro.",
                "chart": {"x_field": "nome", "y_fields": ["valor_total"]},
            }
        ],
    }
    registry_path = root / "question_registry.json"
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")

    client = _client_for(
        DashboardService(
            registry_path=registry_path,
            responses_dir=root / "respostas",
            sql_dir=sql_dir,
            repo_root=root,
        )
    )

    response = client.get("/api/questions/q1")
    assert response.status_code == 404
    assert "missing_q1.txt" in response.json()["detail"]


def test_question_endpoint_applies_escolaridade_filter(tmp_path: Path) -> None:
    root = tmp_path
    responses_dir = root / "respostas"
    sql_dir = root / "sql"
    
    main_content = """Tabela principal
escolaridade | qtd_deputados
-------------+--------------
 Superior    | 1
 Mestrado    | 1
(2 rows)
"""
    comp_content = """Tabela complementar
escolaridade | id_deputado | nome
-------------+-------------+-----
 Superior    | 1           | Ana Silva
 Mestrado    | 2           | Bruno Lima
(2 rows)
"""
    _write_response_file(root / "Caio" / "q4" / "q4_escolaridade.txt", main_content)
    _write_response_file(root / "Caio" / "q4" / "q4_escolaridade_complementar.txt", comp_content)
    _write_sql_file(sql_dir / "q4.sql")
    
    registry = {
        "legend": {},
        "questions": [
            {
                "id": "q4",
                "title": "Escolaridade",
                "description": "Escolaridade da 57 legislatura",
                "response_files": ["Caio/q4/q4_escolaridade.txt", "Caio/q4/q4_escolaridade_complementar.txt"],
                "sql_file": "q4.sql",
                "chart_type": "bar_vertical",
                "supported_filters": ["deputados", "escolaridade"],
                "expected_columns": ["escolaridade", "qtd_deputados"],
                "main_table_contains": "",
                "summary_table_contains": "",
                "explanation": "Teste de Q4Adapter",
                "chart": {"x_field": "escolaridade", "y_fields": ["qtd_deputados"]},
            }
        ]
    }
    registry_path = root / "question_registry.json"
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    
    from app.adapters.questions import Q4Adapter
    import app.adapters.factory as factory_module
    factory_module.ADAPTERS_BY_ID["q4"] = Q4Adapter
    
    service = DashboardService(
        registry_path=registry_path,
        responses_dir=responses_dir,
        sql_dir=sql_dir,
        repo_root=root,
    )
    client = _client_for(service)
    
    response = client.get("/api/questions/q4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["table_spec"]["total"] == 2
    assert len(payload["complement_tables"][0]["rows"]) == 2
    assert payload["summary_cards"][0]["value"] == "2"
    
    filtered = client.get("/api/questions/q4?escolaridade=Mestrado")
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["table_spec"]["total"] == 2
    assert len(filtered_payload["complement_tables"][0]["rows"]) == 1
    assert filtered_payload["complement_tables"][0]["rows"][0]["nome"] == "Bruno Lima"
    assert filtered_payload["summary_cards"][0]["value"] == "1"


def test_q4_charts_and_party_filtering(tmp_path: Path) -> None:
    root = tmp_path
    responses_dir = root / "respostas"
    sql_dir = root / "sql"
    
    # 1. Mock q1_gastos_deputados.txt to contain party mappings for our test deputies
    q1_content = """Tabela principal
 id_deputado | nome | sigla_uf | sigla_partido | gasto_total
-------------+------+----------+---------------+-------------
 1           | Ana Silva  | SP       | PT            | 10
 2           | Bruno Lima | RJ       | PL            | 20
(2 rows)
"""
    _write_response_file(responses_dir / "q1_gastos_deputados.txt", q1_content)
    
    main_content = """Tabela principal
escolaridade | qtd_deputados
-------------+--------------
 Superior    | 1
 Mestrado    | 1
(2 rows)
"""
    comp_content = """Tabela complementar
escolaridade | id_deputado | nome
-------------+-------------+-----
 Superior    | 1           | Ana Silva
 Mestrado    | 2           | Bruno Lima
(2 rows)
"""
    _write_response_file(root / "Caio" / "q4" / "q4_escolaridade.txt", main_content)
    _write_response_file(root / "Caio" / "q4" / "q4_escolaridade_complementar.txt", comp_content)
    _write_sql_file(sql_dir / "q4.sql")
    
    registry = {
        "legend": {},
        "questions": [
            {
                "id": "q4",
                "title": "Escolaridade",
                "description": "Escolaridade da 57 legislatura",
                "response_files": ["Caio/q4/q4_escolaridade.txt", "Caio/q4/q4_escolaridade_complementar.txt"],
                "sql_file": "q4.sql",
                "chart_type": "bar_vertical",
                "supported_filters": ["partidos", "escolaridade"],
                "expected_columns": ["escolaridade", "qtd_deputados"],
                "main_table_contains": "",
                "summary_table_contains": "",
                "explanation": "Teste de Q4Adapter",
                "chart": {"x_field": "escolaridade", "y_fields": ["qtd_deputados"]},
            }
        ]
    }
    registry_path = root / "question_registry.json"
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    
    from app.adapters.questions import Q4Adapter
    import app.adapters.factory as factory_module
    factory_module.ADAPTERS_BY_ID["q4"] = Q4Adapter
    
    service = DashboardService(
        registry_path=registry_path,
        responses_dir=responses_dir,
        sql_dir=sql_dir,
        repo_root=root,
    )
    client = _client_for(service)
    
    # Check default request (no filters)
    response = client.get("/api/questions/q4")
    assert response.status_code == 200
    payload = response.json()
    
    # Gráfico 1 (geral) - categories/series
    chart = payload["chart_spec"]
    assert chart["title"] == "Distribuição Geral de Escolaridade"
    assert len(chart["categories"]) == 2  # Superior, Mestrado
    
    # Gráfico 2 (por partido)
    second_chart = chart["options"]["second_chart"]
    assert second_chart["title"] == "Distribuição de Escolaridade por Partido"
    # both parties should be visible since there are no filters
    assert set(second_chart["categories"]) == {"PL", "PT"}
    
    # Now check request with partidos=PT filter
    response_pt = client.get("/api/questions/q4?partidos=PT")
    assert response_pt.status_code == 200
    payload_pt = response_pt.json()
    
    # Gráfico 1 (geral) MUST remain unfiltered (Design A)
    chart_pt = payload_pt["chart_spec"]
    assert len(chart_pt["categories"]) == 2  # both levels still present
    
    # Gráfico 2 (por partido) MUST still exhibit all parties (Opção 1)
    second_chart_pt = chart_pt["options"]["second_chart"]
    assert set(second_chart_pt["categories"]) == {"PL", "PT"}
    
    # Tabela principal MUST be filtered by party (Only Ana Silva who is PT has Superior)
    table_rows_pt = payload_pt["table_spec"]["rows"]
    assert len(table_rows_pt) == 1
    assert table_rows_pt[0]["escolaridade"] == "Superior"


