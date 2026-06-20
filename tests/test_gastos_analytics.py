import pandas as pd

from dashboard.scripts.generate_gastos_analytics import (
    build_category,
    build_supplier,
    normalize_supplier,
)


def test_normalize_supplier_removes_common_variations():
    values = [
        "Posto Central Ltda.",
        "POSTO CENTRAL LTDA",
        "POSTO CENTRAL",
    ]

    assert {normalize_supplier(value) for value in values} == {"POSTO CENTRAL"}


def test_normalize_supplier_prefers_cnpj_when_present():
    assert normalize_supplier("Fornecedor XPTO 12.345.678/0001-90 LTDA") == "CNPJ_12345678000190"


def test_supplier_aggregation_uses_normalized_name():
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


def test_category_metrics_are_standardized():
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


