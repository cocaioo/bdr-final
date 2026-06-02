from __future__ import annotations

import csv
from decimal import Decimal
from pathlib import Path

from app.parser import parse_psql_file


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_q1_export_uses_civil_name_as_display_label() -> None:
    deputies = _load_deputy_labels(REPO_ROOT / "dados_padronizados" / "deputados.csv")
    document = parse_psql_file(REPO_ROOT / "Caio" / "q1" / "q1_gastos_deputados.txt")

    rows = document.tables[0].rows
    assert rows

    first_rows = rows[:20]
    for row in first_rows:
        dep_id = str(row["id_deputado"])
        assert row["nome"] == deputies[dep_id]


def test_q1_export_keeps_descending_total_order() -> None:
    document = parse_psql_file(REPO_ROOT / "Caio" / "q1" / "q1_gastos_deputados.txt")
    totals = [Decimal(str(row["gasto_total"])) for row in document.tables[0].rows[:50]]

    assert totals == sorted(totals, reverse=True)


def test_q1_sql_uses_nome_civil_with_nome_fallback() -> None:
    sql = (REPO_ROOT / "Caio" / "consultas" / "q1.sql").read_text(encoding="utf-8")
    normalized = " ".join(sql.split())

    assert "COALESCE(NULLIF(BTRIM(d.nome_civil), ''), d.nome) AS nome" in normalized


def _load_deputy_labels(path: Path) -> dict[str, str]:
    labels: dict[str, str] = {}
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file, delimiter=";")
        for row in reader:
            civil = (row.get("nome_civil") or "").strip()
            parliamentary = (row.get("nome") or "").strip()
            labels[(row.get("id_deputado") or "").strip()] = civil or parliamentary
    return labels
