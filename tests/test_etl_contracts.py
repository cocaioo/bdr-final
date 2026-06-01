from __future__ import annotations

from pathlib import Path

import pandas as pd

from src import cleaning as C
from src.loaders import extract_table_frame, standardize_table_frame
from src.party_catalog import active_party_ideology_rows, load_party_catalog


def test_party_catalog_marks_historical_without_loading_as_active(tmp_path: Path) -> None:
    catalog = tmp_path / "partidos.csv"
    catalog.write_text(
        "\n".join(
            [
                "sigla_partido;status;ideologia",
                "PT;ativo;esquerda",
                "ARENA;historico;direita",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    entries = load_party_catalog(catalog)
    active_rows = active_party_ideology_rows(catalog)

    assert {entry.sigla_partido: entry.status for entry in entries} == {
        "PT": "ativo",
        "ARENA": "historico",
    }
    assert active_rows == [{"sigla_partido": "PT", "ideologia": "esquerda"}]


def test_extract_table_frame_records_sources_years_and_raw_rows(tmp_path: Path) -> None:
    year_dir = tmp_path / "2024"
    year_dir.mkdir()
    (year_dir / "Ano-2024.csv").write_text("id;valor\n1;10\n2;20\n", encoding="utf-8")

    frame, stats = extract_table_frame(
        {
            "table": "teste",
            "file_pattern": "Ano-*.csv",
            "year_from_file": True,
        },
        tmp_path,
    )

    assert frame is not None
    assert frame["__ano_dados"].tolist() == ["2024", "2024"]
    assert stats["rows_raw"] == 2
    assert stats["years"] == "2024"
    assert "Ano-2024.csv" in stats["source_files"]


def test_standardize_table_frame_preserves_normalization_validation_and_dedupe(tmp_path: Path) -> None:
    config = {
        "table": "teste_gastos",
        "pk": ["id"],
        "required": ["id", "sigla_partido", "valor_liquido"],
        "skip_identity": [],
        "columns": {
            "id": ("id", C.clean_int),
            "sgPartido": ("sigla_partido", C.clean_party),
            "vlrLiquido": ("valor_liquido", C.clean_money),
        },
    }
    frame = pd.DataFrame(
        [
            {"id": "1", "sgPartido": "republic", "vlrLiquido": "1.234,56"},
            {"id": "1", "sgPartido": "PL", "vlrLiquido": "99,00"},
            {"id": "2", "sgPartido": "", "vlrLiquido": "50,00"},
        ]
    )

    out = standardize_table_frame(config, frame, tmp_path, tmp_path / "logs")

    assert out.to_dict("records") == [
        {"id": "1", "sigla_partido": "REPUBLICANOS", "valor_liquido": "1234.56"}
    ]
