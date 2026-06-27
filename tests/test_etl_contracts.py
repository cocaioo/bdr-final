from __future__ import annotations

from pathlib import Path

import pandas as pd

from src import cleaning as C
from src.loaders import extract_table_frame, standardize_table_frame
from src.mappings import TABLES
from src.party_catalog import active_party_ideology_rows, load_party_catalog


IDEOLOGY_COLUMNS = [
    "sigla_partido",
    "ideologia",
    "ideologia_score",
    "ideologia_faixa",
    "campo_ideologico",
    "fonte_ideologia",
    "ano_base_ideologia",
    "tipo_match_ideologia",
    "observacao_ideologia",
]


def test_party_catalog_marks_historical_without_loading_as_active(tmp_path: Path) -> None:
    """Legacy format: old 3-column catalog still works."""
    catalog = tmp_path / "partidos.csv"
    catalog.write_text(
        "\n".join(
            [
                "sigla_partido;status;campo_ideologico",
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
    assert active_rows == [
        {
            "sigla_partido": "PT",
            "ideologia": "esquerda",
            "ideologia_score": None,
            "ideologia_faixa": None,
            "campo_ideologico": "esquerda",
            "fonte_ideologia": None,
            "ano_base_ideologia": None,
            "tipo_match_ideologia": None,
            "observacao_ideologia": None,
        }
    ]


def test_party_catalog_uses_entra_universo_analitico(tmp_path: Path) -> None:
    """New format: loads parties by entra_universo_analitico, not just status."""
    catalog = tmp_path / "partidos.csv"
    catalog.write_text(
        "\n".join(
            [
                "sigla_partido;status;campo_ideologico;entra_universo_analitico",
                "PT;ativo;esquerda;sim",
                "PATRIOTA;historico_mapeavel_PRD;direita;sim",
                "ARENA;historico;;nao",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    rows = active_party_ideology_rows(catalog)

    assert len(rows) == 2
    siglas = {r["sigla_partido"] for r in rows}
    assert "PT" in siglas
    assert "PATRIOTA" in siglas
    assert "ARENA" not in siglas
    assert all(list(row) == IDEOLOGY_COLUMNS for row in rows)


def test_current_party_catalog_preserves_complete_ideology_methodology() -> None:
    rows = active_party_ideology_rows()

    assert len(rows) == 25
    assert {row["sigla_partido"] for row in rows}.isdisjoint({"ARENA", "S.PART."})

    for row in rows:
        assert all(column in row for column in IDEOLOGY_COLUMNS)
        assert row["ideologia"] == row["campo_ideologico"]
        for required in [
            "sigla_partido",
            "ideologia_score",
            "ideologia_faixa",
            "campo_ideologico",
            "fonte_ideologia",
        ]:
            assert row[required], f"{row['sigla_partido']} lacks {required}"

    by_party = {row["sigla_partido"]: row for row in rows}
    assert by_party["MISSAO"]["ideologia_score"] == "7.750"
    assert by_party["MISSAO"]["ideologia_faixa"] == "Direita"
    assert by_party["MISSAO"]["campo_ideologico"] == "direita"
    assert by_party["MISSAO"]["fonte_ideologia"] == "classificacao_complementar_documentada"
    assert by_party["PATRIOTA"]["ideologia_faixa"] == "Extrema direita"
    assert by_party["PROS"]["ideologia_score"] == "7.445"
    assert by_party["PSC"]["ideologia_score"] == "8.410"
    assert by_party["PTB"]["ideologia_score"] == "7.720"


def test_partidos_ideologia_mapping_standardizes_complete_columns(tmp_path: Path) -> None:
    config = TABLES["partidos_ideologia"]
    frame = pd.DataFrame(config["generated_rows"])

    out = standardize_table_frame(config, frame, tmp_path, tmp_path / "logs")

    assert out.columns.tolist() == IDEOLOGY_COLUMNS
    assert len(out) == 25
    assert out["ideologia"].tolist() == out["campo_ideologico"].tolist()
    assert out.loc[out["sigla_partido"] == "MISSAO", "ideologia_score"].iloc[0] == "7.750"


def test_init_sql_declares_complete_partidos_ideologia_schema() -> None:
    init_sql = Path("Banco/init.sql").read_text(encoding="utf-8")

    for fragment in [
        "sigla_partido             TEXT PRIMARY KEY",
        "ideologia                 TEXT",
        "ideologia_score           NUMERIC(5,3)",
        "ideologia_faixa           TEXT",
        "campo_ideologico          TEXT",
        "fonte_ideologia           TEXT",
        "ano_base_ideologia        TEXT",
        "tipo_match_ideologia      TEXT",
        "observacao_ideologia      TEXT",
        "chk_partidos_ideologia_score",
        "chk_partidos_campo_ideologico",
        "chk_partidos_ideologia_legado",
    ]:
        assert fragment in init_sql


def test_q9_q10_q11_sqls_use_complete_ideology_columns() -> None:
    for sql_path in [
        Path("JF/partidos-ideologia-votacao/q9/q9.sql"),
        Path("JF/partidos-ideologia-votacao/q10/q10.sql"),
        Path("JF/partidos-ideologia-votacao/q11/q11.sql"),
    ]:
        sql_text = sql_path.read_text(encoding="utf-8")
        assert "ideologia_score" in sql_text
        assert "ideologia_faixa" in sql_text
        assert "campo_ideologico" in sql_text

    q10_sql = Path("JF/partidos-ideologia-votacao/q10/q10.sql").read_text(encoding="utf-8")
    assert "LIKE '%' || vv.sigla_partido || '%'" not in q10_sql
    assert "vv.sigla_partido <> 'S.PART.'" in q10_sql


def test_q9_q10_q11_artifacts_preserve_complete_ideology_columns() -> None:
    artifacts = [
        Path("JF/partidos-ideologia-votacao/q9/q9_vies_deputado.txt"),
        # q9_vies_deputado_detalhe.csv is intentionally excluded: it is a large
        # audit-only artifact generated locally by the export pipeline and is
        # listed in .gitignore, so it is never present in CI.
        Path("JF/partidos-ideologia-votacao/q10/q10_alinhamento_partidos.txt"),
        Path("JF/partidos-ideologia-votacao/q11/q11_ranking_partidos.txt"),
    ]

    for artifact in artifacts:
        text = artifact.read_text(encoding="utf-8", errors="replace")
        assert "ideologia_faixa" in text
        assert "ideologia_score" in text

    q9_text = artifacts[0].read_text(encoding="utf-8", errors="replace")
    assert "Extrema esquerda" in q9_text
    assert "Extrema direita" in q9_text


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
