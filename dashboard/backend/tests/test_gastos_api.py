from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.main as main_module
from app.service import DashboardService


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def _build_minimal_service(root: Path) -> DashboardService:
    registry_path = root / "registry.json"
    registry_path.write_text(json.dumps({"legend": {}, "questions": []}), encoding="utf-8")
    return DashboardService(
        registry_path=registry_path,
        responses_dir=root / "respostas",
        sql_dir=root,
        repo_root=root,
    )


def _client(root: Path) -> TestClient:
    main_module.service = _build_minimal_service(root)
    return TestClient(main_module.app)


def _write_gastos_artifacts(root: Path) -> None:
    base = root / "artifacts" / "gastos"
    _write_csv(
        base / "gastos_resumo.csv",
        [
            {
                "escopo": "Todos",
                "ano_dados": "Todos",
                "valor_total": 300,
                "qtd_despesas": 3,
                "ticket_medio": 100,
                "qtd_deputados": 2,
                "qtd_fornecedores": 2,
                "categoria_maior_valor": "PASSAGENS",
            }
        ],
    )
    _write_csv(
        base / "gastos_por_categoria.csv",
        [
            {
                "categoria": "PASSAGENS",
                "valor_total": 200,
                "qtd_despesas": 2,
                "ticket_medio": 100,
                "qtd_deputados": 2,
                "qtd_fornecedores": 1,
                "pct_total": 66.67,
            }
        ],
    )
    _write_csv(
        base / "gastos_por_deputado.csv",
        [
            {
                "ano_dados": "Todos",
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "valor_total": 200,
                "qtd_despesas": 2,
                "ticket_medio": 100,
                "qtd_deputados": 1,
                "qtd_fornecedores": 1,
                "pct_total": 66.67,
                "categoria_principal": "PASSAGENS",
            },
            {
                "ano_dados": "2024",
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "valor_total": 150,
                "qtd_despesas": 1,
                "ticket_medio": 150,
                "qtd_deputados": 1,
                "qtd_fornecedores": 1,
                "pct_total": 100,
                "categoria_principal": "PASSAGENS",
            },
        ],
    )
    _write_csv(
        base / "gastos_por_fornecedor.csv",
        [
            {
                "fornecedor_normalizado": "CIA AEREA",
                "fornecedor_exemplo": "CIA AEREA LTDA",
                "variacoes_nome": "CIA AEREA LTDA",
                "valor_total": 200,
                "qtd_despesas": 2,
                "ticket_medio": 100,
                "qtd_deputados": 1,
                "deputados": "1",
                "qtd_partidos": 1,
                "partidos": "PT",
                "qtd_categorias": 1,
                "categorias": "PASSAGENS",
                "qtd_ufs": 1,
                "ufs": "SP",
                "pct_total": 66.67,
            }
        ],
    )
    _write_csv(
        base / "gastos_por_partido.csv",
        [
            {
                "sigla_partido": "PT",
                "valor_total": 200,
                "qtd_despesas": 2,
                "ticket_medio": 100,
                "qtd_deputados": 1,
                "qtd_fornecedores": 1,
                "valor_medio_por_deputado": 200,
                "pct_total": 66.67,
            }
        ],
    )
    _write_csv(
        base / "gastos_por_uf.csv",
        [
            {
                "sigla_uf": "SP",
                "regiao": "Sudeste",
                "valor_total": 200,
                "qtd_despesas": 2,
                "ticket_medio": 100,
                "qtd_deputados": 1,
                "qtd_fornecedores": 1,
                "valor_medio_por_deputado": 200,
                "pct_total": 66.67,
            }
        ],
    )
    _write_csv(
        base / "gastos_atipicos_ranking_deputados.csv",
        [
            {
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "total_despesas": 2,
                "qtd_despesas_atipicas": 1,
                "valor_atipico": 150,
                "score_atipicidade_medio": 0.7,
                "score_atipicidade_max": 1.2,
                "pct_despesas_atipicas": 50,
            }
        ],
    )
    _write_csv(
        base / "gastos_atipicos_detalhado.csv",
        [
            {
                "ano_dados": 2024,
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "descricao_despesa": "PASSAGENS",
                "fornecedor": "CIA AEREA LTDA",
                "fornecedor_normalizado": "CIA AEREA",
                "valor_documento": 150,
                "valor_glosa": 0,
                "valor_liquido": 150,
                "gasto_atipico": "True",
                "score_atipicidade": 1.2,
                "nota_linguagem": "Despesa fora do padrao estatistico.",
            },
            {
                "ano_dados": 2024,
                "id_deputado": 2,
                "nome_parlamentar": "Bruno Lima",
                "sigla_partido": "PL",
                "sigla_uf": "RJ",
                "descricao_despesa": "COMBUSTIVEIS",
                "fornecedor": "POSTO CENTRAL",
                "fornecedor_normalizado": "POSTO CENTRAL",
                "valor_documento": 10,
                "valor_glosa": 0,
                "valor_liquido": 10,
                "gasto_atipico": "False",
                "score_atipicidade": 0.1,
                "nota_linguagem": "Despesa fora do padrao estatistico.",
            },
        ],
    )
    _write_csv(
        base / "gastos_atipicos_explicacoes.csv",
        [
            {
                "id_gasto": 101,
                "motivo_principal": "valor_acima_percentil_99",
                "motivos_json": json.dumps(
                    [
                        {
                            "tipo": "valor_acima_percentil_99",
                            "peso": 0.9,
                            "descricao": "Valor acima do percentil 99 da categoria.",
                        },
                        {
                            "tipo": "ticket_acima_padrao_deputado",
                            "peso": 0.7,
                            "descricao": "Valor acima do padrao do deputado.",
                        },
                    ],
                    ensure_ascii=False,
                ),
                "qtd_motivos": 2,
                "maior_peso_motivo": 0.9,
            }
        ],
    )


def test_gastos_resumo_contract(tmp_path: Path) -> None:
    _write_gastos_artifacts(tmp_path)
    response = _client(tmp_path).get("/api/gastos/resumo")

    assert response.status_code == 200
    assert response.json() == {
        "valor_total": 300,
        "qtd_despesas": 3,
        "ticket_medio": 100,
        "qtd_deputados": 2,
        "qtd_fornecedores": 2,
    }


def test_gastos_collection_endpoints_return_json_contracts(tmp_path: Path) -> None:
    _write_gastos_artifacts(tmp_path)
    client = _client(tmp_path)

    categorias = client.get("/api/gastos/categorias")
    assert categorias.status_code == 200
    assert categorias.json()["items"][0]["categoria"] == "PASSAGENS"

    deputados = client.get("/api/gastos/deputados?ano=2024&partido=PT&uf=SP&busca=Ana")
    assert deputados.status_code == 200
    assert deputados.json()["items"][0]["valor_total"] == 150

    fornecedores = client.get("/api/gastos/fornecedores?categoria=passagens&partido=PT&uf=SP&deputado=1")
    assert fornecedores.status_code == 200
    assert fornecedores.json()["items"][0]["fornecedor"] == "CIA AEREA"

    contexto = client.get("/api/gastos/contexto")
    assert contexto.status_code == 200
    assert contexto.json()["partidos"][0]["sigla_partido"] == "PT"
    assert contexto.json()["ufs"][0]["sigla_uf"] == "SP"

    anomalias = client.get("/api/gastos/anomalias?partido=PT")
    assert anomalias.status_code == 200
    assert anomalias.json()["ranking"][0]["nome_parlamentar"] == "Ana Silva"


def test_gastos_anomaly_details_requires_filter_and_streams_page(tmp_path: Path) -> None:
    _write_gastos_artifacts(tmp_path)
    client = _client(tmp_path)

    missing_filter = client.get("/api/gastos/anomalias/detalhes")
    assert missing_filter.status_code == 400

    response = client.get("/api/gastos/anomalias/detalhes?partido=PT&page=1&page_size=10")
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total"] == 1
    assert payload["items"][0]["nome_parlamentar"] == "Ana Silva"
    assert payload["items"][0]["id_gasto"] == 101
    assert payload["items"][0]["motivo_principal"] == "valor_acima_percentil_99"
    assert payload["items"][0]["qtd_motivos"] == 2
    assert payload["items"][0]["motivos"][0]["tipo"] == "valor_acima_percentil_99"
    assert payload["metadata"]["explanations_source"] == "gastos_atipicos_explicacoes.csv"
