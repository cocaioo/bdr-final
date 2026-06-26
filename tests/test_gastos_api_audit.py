import pandas as pd

from dashboard.scripts.audit_gastos_api import (
    add_reconciliation_key,
    compare_frames,
    diagnose_local_base,
    normalize_comparison_row,
)


def _row(source, value=100.0, number="NF 1"):
    return normalize_comparison_row(
        fonte_dado=source,
        origem_local="local.csv" if source == "local" else "",
        origem_api="api" if source == "api" else "",
        data_coleta_api="2026-06-13T00:00:00+00:00" if source == "api" else "",
        id_deputado="123",
        ano="2026",
        mes="1",
        descricao="Manutenção de escritório",
        fornecedor="Fornecedor XPTO Ltda.",
        cnpj_cpf="12.345.678/0001-90",
        valor_documento=value,
        valor_glosa=0,
        valor_liquido=value,
        data_documento="2026-01-10T00:00:00",
        numero_documento=number,
        tipo_documento="Nota Fiscal",
        cod_documento="999",
        url_documento="https://example.test/doc.pdf",
    )


def test_reconciliation_key_normalizes_values():
    row = _row("local")
    frame = add_reconciliation_key(pd.DataFrame([row]))

    key = frame.iloc[0]["chave_reconciliacao"]

    assert "MANUTENCAO DE ESCRITORIO" in key
    assert "CNPJ_12345678000190" in key
    assert "10000" in key
    assert "2026-01-10" in key


def test_compare_frames_preserves_duplicate_differences():
    local = pd.DataFrame([_row("local"), _row("local", number="NF 1")])
    api = pd.DataFrame([_row("api")])

    comparison, only_local, only_api, summary = compare_frames(local, api)

    assert summary["registros_presentes_local_e_api"] == 1
    assert summary["registros_somente_local"] == 1
    assert summary["registros_somente_api"] == 0
    assert len(only_local) == 1
    assert only_api.empty
    assert comparison["qtd_somente_local"].sum() == 1


def test_diagnose_local_base_reports_required_scope():
    df = pd.DataFrame(
        [
            {
                "ano_dados": "2026",
                "id_deputado": "123",
                "valor_liquido": "10.50",
                "fornecedor": "A",
                "descricao_despesa": "Categoria",
            },
            {
                "ano_dados": "2026",
                "id_deputado": "456",
                "valor_liquido": "0.00",
                "fornecedor": "",
                "descricao_despesa": "Categoria",
            },
        ]
    )
    df["valor_liquido_num"] = [10.5, 0.0]

    diagnosis = diagnose_local_base(df)

    assert diagnosis["total_linhas_local"] == 2
    assert diagnosis["anos_local"] == ["2026"]
    assert diagnosis["qtd_deputados_local"] == 2
    assert diagnosis["valor_total_local"] == 10.5
    assert diagnosis["campos_ausentes_ou_vazios"]["valor_liquido_zero"] == 1
    assert diagnosis["id_gasto"]["existe_na_base_local"] is False
