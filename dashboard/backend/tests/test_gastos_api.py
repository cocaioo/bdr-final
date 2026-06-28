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
        responses_dir=root / "scratch" / "query-staging",
        sql_dir=root,
        repo_root=root,
    )


def _client(root: Path) -> TestClient:
    main_module.service = _build_minimal_service(root)
    return TestClient(main_module.app)


def _write_gastos_artifacts(root: Path) -> None:
    base = root / "Caio" / "gastos-fornecedores" / "analytics"
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
            },
            {
                "fornecedor_normalizado": "TAM",
                "fornecedor_exemplo": "TAM",
                "variacoes_nome": "TAM",
                "valor_total": 80,
                "qtd_despesas": 1,
                "ticket_medio": 80,
                "qtd_deputados": 1,
                "deputados": "2",
                "qtd_partidos": 1,
                "partidos": "PL",
                "qtd_categorias": 1,
                "categorias": "PASSAGEM AEREA",
                "qtd_ufs": 1,
                "ufs": "RJ",
                "pct_total": 26.67,
            },
            {
                "fornecedor_normalizado": "VRG LINHAS AEREAS",
                "fornecedor_exemplo": "GOL LINHAS AEREAS",
                "variacoes_nome": "VRG LINHAS AEREAS | GOL TRANSPORTES AEREOS | VARIG",
                "valor_total": 20,
                "qtd_despesas": 1,
                "ticket_medio": 20,
                "qtd_deputados": 1,
                "deputados": "2",
                "qtd_partidos": 1,
                "partidos": "PL",
                "qtd_categorias": 1,
                "categorias": "PASSAGEM AEREA",
                "qtd_ufs": 1,
                "ufs": "RJ",
                "pct_total": 6.66,
            },
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

    fornecedores = client.get("/api/gastos/fornecedores?fornecedor=cia&partido=PT&uf=SP&deputado=1")
    assert fornecedores.status_code == 200
    assert fornecedores.json()["items"][0]["fornecedor"] == "CIA AEREA"

    contexto = client.get("/api/gastos/contexto")
    assert contexto.status_code == 200
    assert contexto.json()["partidos"][0]["sigla_partido"] == "PT"
    assert contexto.json()["ufs"][0]["sigla_uf"] == "SP"


def test_gastos_fornecedores_filters_all_supplier_name_fields(tmp_path: Path) -> None:
    _write_gastos_artifacts(tmp_path)
    client = _client(tmp_path)

    normalized = client.get("/api/gastos/fornecedores?fornecedor=tam")
    assert normalized.status_code == 200
    assert [item["fornecedor"] for item in normalized.json()["items"]] == ["TAM"]

    example = client.get("/api/gastos/fornecedores?fornecedor=gol")
    assert example.status_code == 200
    assert [item["fornecedor"] for item in example.json()["items"]] == ["VRG LINHAS AEREAS"]

    variation = client.get("/api/gastos/fornecedores?fornecedor=varig")
    assert variation.status_code == 200
    assert [item["fornecedor"] for item in variation.json()["items"]] == ["VRG LINHAS AEREAS"]

