from __future__ import annotations

from pathlib import Path

from app.parser import parse_psql_file, read_text_with_fallback


def test_parse_psql_file_has_rows(tmp_path: Path) -> None:
    file_path = tmp_path / "q1.txt"
    file_path.write_text(
        """Tabela principal
nome | gasto_total
-----+------------
Ana Silva | 10
Bruno Lima | 20
(2 rows)
""",
        encoding="utf-8",
    )

    document = parse_psql_file(file_path)
    assert document.tables, "Parser should extract at least one table"
    first_table = document.tables[0]
    assert "nome" in first_table.columns
    assert "gasto_total" in first_table.columns
    assert len(first_table.rows) == 2


def test_read_text_with_fallback_supports_latin1(tmp_path: Path) -> None:
    file_path = tmp_path / "latin1.txt"
    file_path.write_bytes(
        "Tabela principal\ntexto\n-----\nEduca\xe7\xe3o\n".encode("latin-1")
    )

    text = read_text_with_fallback(file_path)
    assert "Educação" in text

