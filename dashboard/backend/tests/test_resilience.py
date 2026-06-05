from __future__ import annotations

from app.adapters.base import AdapterContext
from app.adapters.factory import build_adapter
from app.filter_engine import FilterState
from app.parser import ParsedDocument, ParsedTable
from app.registry import QuestionDefinition


def test_missing_expected_columns_emits_warning() -> None:
    definition = QuestionDefinition(
        id="q1",
        title="Teste",
        description="Teste",
        response_files=[],
        sql_file="q1.sql",
        chart_type="bar_horizontal",
        supported_filters=["deputados"],
        expected_columns=["id_deputado", "nome", "gasto_total"],
        main_table_contains="",
        summary_table_contains="",
        explanation="Teste",
        chart={"x_field": "nome", "y_fields": ["gasto_total"]},
    )
    documents = [
        ParsedDocument(
            title="Q Teste",
            tables=[
                ParsedTable(
                    title="Tabela principal",
                    columns=["nome"],
                    rows=[{"nome": "Deputado A"}],
                )
            ],
        )
    ]
    adapter = build_adapter(
        AdapterContext(
            question=definition,
            documents=documents,
            sql_text="SELECT 1;",
            sql_path="sql/questoes-queries/q1.sql",
            dataset_version="test-version",
        )
    )
    payload = adapter.build_payload(
        FilterState(
            anos=[],
            eixos=[],
            partidos=[],
            ufs=[],
            deputados=[],
            escolaridade=[],
            search=None,
            sort_by=None,
            sort_dir="desc",
            page=1,
            page_size=20,
        )
    )
    assert payload.warnings
    assert payload.warnings[0].code == "missing_expected_columns"
    assert payload.table_spec.rows[0]["nome"] == "Deputado A"

