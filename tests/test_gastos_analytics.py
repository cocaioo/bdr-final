from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from dashboard.scripts.generate_gastos_analytics import (
    build_category,
    build_deputy,
    build_supplier,
    generate,
    normalize_supplier,
    read_gastos,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
GASTOS_CSV = REPO_ROOT / "dados_padronizados" / "gastos.csv"


def _write_input_csv(path: Path, rows: list[dict[str, object]]) -> None:
    pd.DataFrame(rows).to_csv(path, sep=";", index=False, encoding="utf-8")


def _positive_gastos_df() -> pd.DataFrame:
    frame = read_gastos(GASTOS_CSV)
    return frame[frame["valor_liquido"] > 0].copy()


@pytest.fixture(scope="module")
def generated_real_artifacts(tmp_path_factory: pytest.TempPathFactory) -> dict[str, pd.DataFrame]:
    output_dir = tmp_path_factory.mktemp("gastos-analytics-real")
    generate(GASTOS_CSV, output_dir)
    return {
        "summary": pd.read_csv(output_dir / "gastos_resumo.csv", sep=";"),
        "category": pd.read_csv(output_dir / "gastos_por_categoria.csv", sep=";"),
        "deputy": pd.read_csv(output_dir / "gastos_por_deputado.csv", sep=";"),
        "supplier": pd.read_csv(output_dir / "gastos_por_fornecedor.csv", sep=";"),
        "positive": _positive_gastos_df(),
    }


def test_normalize_supplier_removes_common_variations() -> None:
    values = [
        "Posto Central Ltda.",
        "POSTO CENTRAL LTDA",
        "POSTO CENTRAL",
    ]

    assert {normalize_supplier(value) for value in values} == {"POSTO CENTRAL"}


def test_normalize_supplier_prefers_cnpj_when_present() -> None:
    assert normalize_supplier("Fornecedor XPTO 12.345.678/0001-90 LTDA") == "CNPJ_12345678000190"


def test_supplier_aggregation_uses_normalized_name() -> None:
    df = pd.DataFrame(
        [
            {
                "id_deputado": 1,
                "descricao_despesa": "COMBUSTIVEIS",
                "fornecedor": "Posto Central Ltda.",
                "fornecedor_normalizado": normalize_supplier("Posto Central Ltda."),
                "sigla_partido": "PT",
                "sigla_uf": "CE",
                "valor_liquido": 100.0,
            },
            {
                "id_deputado": 2,
                "descricao_despesa": "COMBUSTIVEIS",
                "fornecedor": "POSTO CENTRAL",
                "fornecedor_normalizado": normalize_supplier("POSTO CENTRAL"),
                "sigla_partido": "PL",
                "sigla_uf": "CE",
                "valor_liquido": 200.0,
            },
        ]
    )

    suppliers = build_supplier(df)

    assert len(suppliers) == 1
    assert suppliers.iloc[0]["fornecedor_normalizado"] == "POSTO CENTRAL"
    assert suppliers.iloc[0]["valor_total"] == 300.0
    assert suppliers.iloc[0]["qtd_deputados"] == 2


def test_category_metrics_are_standardized() -> None:
    df = pd.DataFrame(
        [
            {
                "id_deputado": 1,
                "descricao_despesa": "PASSAGENS",
                "fornecedor_normalizado": "CIA AEREA",
                "valor_liquido": 100.0,
            },
            {
                "id_deputado": 2,
                "descricao_despesa": "PASSAGENS",
                "fornecedor_normalizado": "CIA AEREA",
                "valor_liquido": 300.0,
            },
        ]
    )

    categories = build_category(df)

    assert categories.iloc[0]["categoria"] == "PASSAGENS"
    assert categories.iloc[0]["valor_total"] == 400.0
    assert categories.iloc[0]["qtd_despesas"] == 2
    assert categories.iloc[0]["ticket_medio"] == 200.0
    assert categories.iloc[0]["qtd_deputados"] == 2
    assert categories.iloc[0]["qtd_fornecedores"] == 1


def test_generate_excludes_non_positive_rows_from_base_analytics(tmp_path: Path) -> None:
    input_path = tmp_path / "gastos.csv"
    output_dir = tmp_path / "out"
    _write_input_csv(
        input_path,
        [
            {
                "ano_dados": 2026,
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_uf": "SP",
                "sigla_partido": "PT",
                "valor_documento": 100.0,
                "valor_glosa": 0.0,
                "valor_liquido": 100.0,
                "descricao_despesa": "PASSAGENS",
                "fornecedor": "CIA AEREA",
            },
            {
                "ano_dados": 2026,
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_uf": "SP",
                "sigla_partido": "PT",
                "valor_documento": 20.0,
                "valor_glosa": 20.0,
                "valor_liquido": 0.0,
                "descricao_despesa": "PASSAGENS",
                "fornecedor": "CIA AEREA",
            },
            {
                "ano_dados": 2026,
                "id_deputado": 2,
                "nome_parlamentar": "Bruno Lima",
                "sigla_uf": "RJ",
                "sigla_partido": "PL",
                "valor_documento": 30.0,
                "valor_glosa": 0.0,
                "valor_liquido": -30.0,
                "descricao_despesa": "COMBUSTIVEL",
                "fornecedor": "POSTO CENTRAL",
            },
        ],
    )

    generate(input_path, output_dir)

    summary = pd.read_csv(output_dir / "gastos_resumo.csv", sep=";")
    categories = pd.read_csv(output_dir / "gastos_por_categoria.csv", sep=";")
    deputies = pd.read_csv(output_dir / "gastos_por_deputado.csv", sep=";")
    suppliers = pd.read_csv(output_dir / "gastos_por_fornecedor.csv", sep=";")

    total_row = summary.loc[summary["ano_dados"] == "Todos"].iloc[0]
    assert float(total_row["valor_total"]) == 100.0
    assert int(total_row["qtd_despesas"]) == 1
    assert float(categories["valor_total"].sum()) == 100.0
    assert float(deputies["valor_total"].sum()) == 200.0
    assert float(suppliers["valor_total"].sum()) == 100.0
    assert set(deputies["id_deputado"]) == {1}


def test_build_deputy_keeps_one_row_per_deputy_per_scope() -> None:
    df = pd.DataFrame(
        [
            {
                "ano_dados": 2024,
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "descricao_despesa": "PASSAGENS",
                "fornecedor_normalizado": "CIA AEREA",
                "valor_liquido": 100.0,
            },
            {
                "ano_dados": 2024,
                "id_deputado": 1,
                "nome_parlamentar": "Ana S.",
                "sigla_partido": "PSB",
                "sigla_uf": "RJ",
                "descricao_despesa": "PASSAGENS",
                "fornecedor_normalizado": "HOTEL",
                "valor_liquido": 250.0,
            },
            {
                "ano_dados": 2025,
                "id_deputado": 1,
                "nome_parlamentar": "Ana Silva",
                "sigla_partido": "PT",
                "sigla_uf": "SP",
                "descricao_despesa": "COMBUSTIVEL",
                "fornecedor_normalizado": "POSTO",
                "valor_liquido": 80.0,
            },
        ]
    )

    deputies = build_deputy(df)

    global_rows = deputies[deputies["ano_dados"] == "Todos"]
    yearly_rows = deputies[deputies["ano_dados"] != "Todos"]

    assert len(global_rows) == 1
    assert len(yearly_rows) == 2
    assert list(global_rows["sigla_partido"]) == ["PSB"]
    assert list(global_rows["sigla_uf"]) == ["RJ"]
    assert list(global_rows["nome_parlamentar"]) == ["Ana Silva"]
    assert not deputies.duplicated(subset=["ano_dados", "id_deputado"]).any()


def test_generated_summary_matches_positive_universe_by_year(
    generated_real_artifacts: dict[str, pd.DataFrame],
) -> None:
    summary = generated_real_artifacts["summary"]
    positive = generated_real_artifacts["positive"]

    summary_year = summary[summary["escopo"] == "Ano"].copy()
    summary_year["ano_dados"] = summary_year["ano_dados"].astype(int)
    actual = summary_year.set_index("ano_dados")[["valor_total", "qtd_despesas"]].sort_index()

    expected = (
        positive.groupby("ano_dados")
        .agg(valor_total=("valor_liquido", "sum"), qtd_despesas=("valor_liquido", "size"))
        .round({"valor_total": 2})
        .sort_index()
    )
    actual.index = actual.index.astype("int64")
    expected.index = expected.index.astype("int64")

    pd.testing.assert_frame_equal(actual, expected, check_exact=False, atol=0.01)


def test_generated_category_matches_positive_universe_equivalent_q13_rule(
    generated_real_artifacts: dict[str, pd.DataFrame],
) -> None:
    categories = generated_real_artifacts["category"].set_index("categoria").sort_index()
    positive = generated_real_artifacts["positive"]

    expected = (
        positive.groupby("descricao_despesa")
        .agg(
            valor_total=("valor_liquido", "sum"),
            qtd_despesas=("valor_liquido", "size"),
            qtd_deputados=("id_deputado", "nunique"),
            qtd_fornecedores=("fornecedor_normalizado", "nunique"),
        )
        .round({"valor_total": 2})
        .sort_index()
    )
    expected.index = expected.index.rename("categoria")

    actual = categories[["valor_total", "qtd_despesas", "qtd_deputados", "qtd_fornecedores"]]
    pd.testing.assert_frame_equal(actual, expected, check_exact=False, atol=0.01)


def test_generated_supplier_matches_positive_universe_equivalent_q5_rule(
    generated_real_artifacts: dict[str, pd.DataFrame],
) -> None:
    suppliers = generated_real_artifacts["supplier"].set_index("fornecedor_normalizado").sort_index()
    positive = generated_real_artifacts["positive"]

    expected = (
        positive.groupby("fornecedor_normalizado")
        .agg(
            valor_total=("valor_liquido", "sum"),
            qtd_despesas=("valor_liquido", "size"),
            qtd_deputados=("id_deputado", "nunique"),
        )
        .round({"valor_total": 2})
        .sort_index()
    )

    actual = suppliers[["valor_total", "qtd_despesas", "qtd_deputados"]]
    pd.testing.assert_frame_equal(actual, expected, check_exact=False, atol=0.01)


def test_generated_deputy_is_unique_and_consistent(
    generated_real_artifacts: dict[str, pd.DataFrame],
) -> None:
    deputies = generated_real_artifacts["deputy"].copy()

    assert not deputies[deputies["ano_dados"] == "Todos"].duplicated(subset=["id_deputado"]).any()
    assert not deputies[deputies["ano_dados"] != "Todos"].duplicated(subset=["ano_dados", "id_deputado"]).any()

    ratios = (deputies["valor_total"] / deputies["qtd_despesas"]).round(2)
    assert ratios.equals(deputies["ticket_medio"].round(2))

    totals = deputies.groupby("ano_dados")["pct_total"].sum().round(2)
    assert totals["Todos"] == pytest.approx(100.0, abs=0.05)
    for year, pct in totals.drop(labels="Todos").items():
        assert pct == pytest.approx(100.0, abs=0.1), year
