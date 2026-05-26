from __future__ import annotations

from pathlib import Path

from app.config import RESPONSES_DIR
from app.parser import parse_psql_file


def test_parse_q1_file_has_rows() -> None:
    file_path = RESPONSES_DIR / "q1_gastos_deputados.txt"
    document = parse_psql_file(file_path)
    assert document.tables, "Parser should extract at least one table from Q1"
    first_table = document.tables[0]
    assert "nome" in first_table.columns
    assert "gasto_total" in first_table.columns
    assert len(first_table.rows) > 0


def test_parse_q10_has_summary_and_main_table() -> None:
    file_path = RESPONSES_DIR / "q10_alinhamento_interno_partidos.txt"
    document = parse_psql_file(file_path)
    titles = [table.title.lower() for table in document.tables]
    assert any("resumo executivo" in title for title in titles)
    assert any("tabela principal" in title for title in titles)

