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


def _write_temas_artifact(root: Path) -> None:
    base = root / "JF" / "producao-legislativa-temas" / "analytics"
    _write_csv(
        base / "deputado_temas_nuvem.csv",
        [
            {"id_deputado": "220715", "tema": "Saude", "qtd_proposicoes": 946},
            {"id_deputado": "220715", "tema": "Administracao Publica", "qtd_proposicoes": 1036},
            {"id_deputado": "220715", "tema": "Educacao", "qtd_proposicoes": 225},
            {"id_deputado": "74084", "tema": "Direitos Humanos e Minorias", "qtd_proposicoes": 232},
        ],
    )


def test_temas_nuvem_filters_and_sorts_by_deputy(tmp_path: Path) -> None:
    _write_temas_artifact(tmp_path)
    client = _client(tmp_path)

    response = client.get("/api/deputados/220715/temas-nuvem")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id_deputado"] == "220715"
    temas = payload["temas"]
    assert [item["tema"] for item in temas] == [
        "Administracao Publica",
        "Saude",
        "Educacao",
    ]
    assert temas[0]["qtd_proposicoes"] == 1036


def test_temas_nuvem_unknown_deputy_returns_empty_list(tmp_path: Path) -> None:
    _write_temas_artifact(tmp_path)
    client = _client(tmp_path)

    response = client.get("/api/deputados/999999999/temas-nuvem")
    assert response.status_code == 200
    assert response.json() == {"id_deputado": "999999999", "temas": []}


def test_temas_nuvem_missing_artifact_returns_404(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get("/api/deputados/220715/temas-nuvem")
    assert response.status_code == 404
