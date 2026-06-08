from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

from pathlib import Path

from ..config import REPO_ROOT
from ..filter_engine import FilterEngine, FilterState
from ..models import (
    ChartSpec,
    EmptyState,
    QueryPanel,
    QuestionPayload,
    SummaryCard,
    TableColumn,
    TableSpec,
    WarningItem,
)
from ..parser import ParsedDocument, ParsedTable
from ..registry import QuestionDefinition


@dataclass(slots=True)
class AdapterContext:
    question: QuestionDefinition
    documents: list[ParsedDocument]
    sql_text: str
    sql_path: str
    dataset_version: str
    repo_root: Path = REPO_ROOT


class QuestionAdapter:
    def __init__(self, context: AdapterContext) -> None:
        self.context = context
        self.warnings: list[WarningItem] = []
        self.summary_table, self.main_table, self.complement_tables = self._select_tables()
        self._validate_expected_columns()

    def build_payload(self, state: FilterState) -> QuestionPayload:
        main_rows = self.main_table.rows if self.main_table else []
        filtered_rows = FilterEngine.apply_filters(
            main_rows,
            state,
            self.context.question.supported_filters,
        )
        sorted_rows = FilterEngine.apply_sort(filtered_rows, state.sort_by, state.sort_dir)
        paged_rows = FilterEngine.apply_pagination(sorted_rows, state.page, state.page_size)

        summary_cards = self._build_summary_cards()
        chart_spec = self.build_chart_spec(filtered_rows)
        table_spec = self._build_table_spec(
            title=self.main_table.title if self.main_table else "Tabela principal",
            columns=self.main_table.columns if self.main_table else [],
            rows=paged_rows,
            total=len(sorted_rows),
            state=state,
        )
        complement_specs = self._build_complements(state)

        has_data = table_spec.total > 0 or any(spec.total > 0 for spec in complement_specs)
        empty = EmptyState(
            is_empty=not has_data,
            message="Sem dados para os filtros selecionados." if not has_data else "",
        )
        payload = QuestionPayload(
            question_id=self.context.question.id,
            title=self.context.question.title,
            description=self.context.question.description,
            filters_supported=self.context.question.supported_filters,
            filters_applied={
                "anos": state.anos,
                "eixos": state.eixos,
                "partidos": state.partidos,
                "ufs": state.ufs,
                "deputados": state.deputados,
                "search": state.search,
                "sort_by": state.sort_by,
                "sort_dir": state.sort_dir,
                "page": state.page,
                "page_size": state.page_size,
            },
            summary_cards=summary_cards,
            chart_spec=chart_spec,
            table_spec=table_spec,
            complement_tables=complement_specs,
            query_panel=QueryPanel(
                sql_path=self.context.sql_path,
                sql_text=self.context.sql_text,
                explanation=self.context.question.explanation,
            ),
            warnings=self.warnings,
            empty_state=empty,
            dataset_version=self.context.dataset_version,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
        return payload

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        chart_type = self.context.question.chart_type
        chart_cfg = self.context.question.chart
        x_field = chart_cfg.get("x_field")
        y_fields = chart_cfg.get("y_fields", [])

        if chart_type in {"bar_horizontal", "bar_vertical", "stacked_bar", "composite"}:
            return self._build_bar_like_chart(rows, chart_type, x_field, y_fields)
        if chart_type == "scatter":
            return self._build_scatter_chart(rows, x_field, y_fields)
        if chart_type == "radar":
            return self._build_radar_chart(rows)
        if chart_type == "sankey":
            return self._build_sankey_chart(rows)
        if chart_type == "treemap":
            return self._build_treemap_chart(rows, x_field, y_fields)
        if chart_type == "heatmap_wordcloud":
            return self._build_heatmap_wordcloud_chart(rows)
        return ChartSpec(
            type="table",
            title="Sem visualizacao configurada",
            description="Nao foi definido um grafico para esta pergunta.",
        )

    def _build_summary_cards(self) -> list[SummaryCard]:
        table = self.summary_table
        if table and table.rows:
            first_row = table.rows[0]
            cards: list[SummaryCard] = []
            for key, value in first_row.items():
                cards.append(
                    SummaryCard(
                        id=key,
                        label=_humanize_label(key),
                        value=_format_summary_card_value(key, value),
                        unit=_infer_unit(key),
                    )
                )
            return cards

        total_rows = len(self.main_table.rows) if self.main_table else 0
        return [
            SummaryCard(
                id="total_registros",
                label="Total de registros",
                value=str(total_rows),
                unit="contagem",
            )
        ]

    def _build_table_spec(
        self,
        title: str,
        columns: list[str],
        rows: list[dict[str, Any]],
        total: int,
        state: FilterState,
    ) -> TableSpec:
        col_specs = [
            TableColumn(key=column, label=_humanize_label(column), numeric=_is_numeric_column(rows, column))
            for column in columns
        ]
        if not col_specs and rows:
            for column in rows[0].keys():
                col_specs.append(
                    TableColumn(
                        key=column,
                        label=_humanize_label(column),
                        numeric=_is_numeric_column(rows, column),
                    )
                )

        return TableSpec(
            title=title,
            columns=col_specs,
            rows=rows,
            total=total,
            page=state.page,
            page_size=state.page_size,
            sort_by=state.sort_by,
            sort_dir=state.sort_dir,
        )

    def _build_complements(self, state: FilterState) -> list[TableSpec]:
        specs: list[TableSpec] = []
        for table in self.complement_tables:
            is_global_ranking = _is_global_ranking_table(table)
            table_state = _without_year_filter(state) if is_global_ranking else state
            page = table_state.page if is_global_ranking else 1
            page_size = min(table_state.page_size, 200 if is_global_ranking else 100)
            filtered = FilterEngine.apply_filters(
                table.rows,
                table_state,
                self.context.question.supported_filters,
            )
            sorted_rows = FilterEngine.apply_sort(filtered, table_state.sort_by, table_state.sort_dir)
            paged = FilterEngine.apply_pagination(sorted_rows, page, page_size)
            specs.append(
                self._build_table_spec(
                    title=table.title,
                    columns=table.columns,
                    rows=paged,
                    total=len(sorted_rows),
                    state=FilterState(
                        anos=table_state.anos,
                        eixos=table_state.eixos,
                        partidos=table_state.partidos,
                        ufs=table_state.ufs,
                        deputados=table_state.deputados,
                        escolaridade=table_state.escolaridade,
                        search=table_state.search,
                        sort_by=table_state.sort_by,
                        sort_dir=table_state.sort_dir,
                        page=page,
                        page_size=page_size,
                    ),
                )
            )
        return specs

    def _select_tables(self) -> tuple[ParsedTable | None, ParsedTable | None, list[ParsedTable]]:
        all_tables = [table for doc in self.context.documents for table in doc.tables]
        if not all_tables:
            return None, None, []

        summary_hint = self.context.question.summary_table_contains.lower().strip()
        main_hint = self.context.question.main_table_contains.lower().strip()

        summary = None
        if summary_hint:
            summary = _find_first_table(all_tables, lambda table: summary_hint in table.title.lower())
        if summary is None:
            summary = _find_first_table(all_tables, lambda table: "resumo executivo" in table.title.lower())

        main = None
        if main_hint:
            main = _find_first_table(
                all_tables,
                lambda table: main_hint in table.title.lower(),
                excluded={id(summary)} if summary else set(),
            )
        if main is None:
            main = _find_first_table(
                all_tables,
                lambda table: "tabela principal" in table.title.lower(),
                excluded={id(summary)} if summary else set(),
            )
        if main is None:
            if summary and len(all_tables) > 1:
                for table in all_tables:
                    if id(table) != id(summary):
                        main = table
                        break
            else:
                main = all_tables[0]

        complements = [
            table
            for table in all_tables
            if id(table) not in {id(summary) if summary else -1, id(main) if main else -1}
        ]
        return summary, main, complements

    def _validate_expected_columns(self) -> None:
        expected = self.context.question.expected_columns
        if not expected or not self.main_table:
            return
        actual = set(self.main_table.columns)
        missing = [column for column in expected if column not in actual]
        if missing:
            self.warnings.append(
                WarningItem(
                    code="missing_expected_columns",
                    message=(
                        "Colunas esperadas ausentes na tabela principal: "
                        + ", ".join(missing)
                    ),
                )
            )

    def _build_bar_like_chart(
        self,
        rows: list[dict[str, Any]],
        chart_type: str,
        x_field: str | None,
        y_fields: list[str],
    ) -> ChartSpec:
        if self.context.question.id == "q3":
            return self._build_q3_chart(rows, chart_type, x_field, y_fields)
        if not rows or not x_field or not y_fields:
            return ChartSpec(
                type=chart_type,
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

        top_rows = rows[:30]
        year_values = {
            str(row.get("ano_dados"))
            for row in top_rows
            if row.get("ano_dados") not in (None, "")
        }
        include_year = len(year_values) > 1

        def _format_category(row: dict[str, Any]) -> str:
            label = str(row.get(x_field, ""))
            if include_year:
                year = row.get("ano_dados")
                if year not in (None, ""):
                    return f"{year} - {label}"
            return label

        categories = [_format_category(row) for row in top_rows]
        series = []
        for y_field in y_fields:
            series.append(
                {
                    "name": _humanize_label(y_field),
                    "data": [row.get(y_field, 0) for row in top_rows],
                    "stack": "total" if chart_type == "stacked_bar" else None,
                }
            )
        return ChartSpec(
            type=chart_type,
            title=self.context.question.title,
            description=self.context.question.description,
            x_field=x_field,
            y_fields=y_fields,
            categories=categories,
            series=series,
            options={"orientation": "horizontal" if chart_type == "bar_horizontal" else "vertical"},
        )

    def _build_q3_chart(
        self,
        rows: list[dict[str, Any]],
        chart_type: str,
        x_field: str | None,
        y_fields: list[str],
    ) -> ChartSpec:
        if not rows or not x_field or not y_fields:
            return ChartSpec(
                type=chart_type,
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

        def _to_number(value: Any) -> float:
            if isinstance(value, (int, float)):
                return float(value)
            try:
                return float(value)
            except (TypeError, ValueError):
                return 0.0

        eixo_order: list[str] = []
        year_order: list[str] = []
        aggregated: dict[tuple[str, str], dict[str, float]] = {}

        for row in rows:
            eixo = str(row.get(x_field) or "Sem eixo").strip() or "Sem eixo"
            raw_year = row.get("ano_dados")
            year = str(raw_year).strip() if raw_year is not None else ""
            if eixo not in eixo_order:
                eixo_order.append(eixo)
            if year and year not in year_order:
                year_order.append(year)

            key = (year, eixo)
            if key not in aggregated:
                aggregated[key] = {field: 0.0 for field in y_fields}
            for y_field in y_fields:
                aggregated[key][y_field] += _to_number(row.get(y_field, 0))

        def _sort_years(values: list[str]) -> list[str]:
            def _key(value: str) -> tuple[int, int | str]:
                try:
                    return (0, int(value))
                except ValueError:
                    return (1, value)

            return sorted(values, key=_key)

        years = _sort_years(year_order)
        years_for_data = years if years else [""]

        categories: list[str] = []
        for _year in years_for_data:
            categories.extend(eixo_order)

        series: list[dict[str, Any]] = []
        for y_field in y_fields:
            data: list[float] = []
            for year in years_for_data:
                for eixo in eixo_order:
                    data.append(aggregated.get((year, eixo), {}).get(y_field, 0.0))
            series.append(
                {
                    "name": _humanize_label(y_field),
                    "data": data,
                    "stack": "total" if chart_type == "stacked_bar" else None,
                }
            )

        return ChartSpec(
            type=chart_type,
            title=self.context.question.title,
            description=self.context.question.description,
            x_field=x_field,
            y_fields=y_fields,
            categories=categories,
            series=series,
            options={
                "orientation": "horizontal" if chart_type == "bar_horizontal" else "vertical",
                "year_order": years,
            },
        )

    def _build_scatter_chart(
        self, rows: list[dict[str, Any]], x_field: str | None, y_fields: list[str]
    ) -> ChartSpec:
        if not rows or not x_field or not y_fields:
            return ChartSpec(
                type="scatter",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

        y_field = y_fields[0]
        points = []
        for row in rows[:500]:
            x_value = row.get(x_field)
            y_value = row.get(y_field)
            if isinstance(x_value, (int, float)) and isinstance(y_value, (int, float)):
                points.append(
                    {
                        "name": str(row.get("nome", "")),
                        "value": [x_value, y_value],
                    }
                )

        return ChartSpec(
            type="scatter",
            title=self.context.question.title,
            description=self.context.question.description,
            x_field=x_field,
            y_fields=y_fields,
            series=[{"name": _humanize_label(y_field), "data": points}],
            options={"x_name": _humanize_label(x_field), "y_name": _humanize_label(y_field)},
        )

    def _build_radar_chart(self, rows: list[dict[str, Any]]) -> ChartSpec:
        if not rows:
            return ChartSpec(
                type="radar",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )
        indicators = [
            "media_gasto",
            "media_fidelidade",
            "media_proposicoes",
            "media_presenca_eventos",
            "media_presenca_plenario",
        ]
        dataset = []
        for row in rows[:8]:
            values = [float(row.get(indicator, 0) or 0) for indicator in indicators]
            dataset.append({"name": str(row.get("escolaridade", "")), "value": values})

        return ChartSpec(
            type="radar",
            title=self.context.question.title,
            description=self.context.question.description,
            series=dataset,
            options={
                "indicators": [
                    {"name": _humanize_label(indicator)}
                    for indicator in indicators
                ]
            },
        )

    def _build_sankey_chart(self, rows: list[dict[str, Any]]) -> ChartSpec:
        links: dict[tuple[str, str], int] = {}
        nodes: set[str] = set()
        for row in rows:
            ideologia = str(row.get("ideologia") or "Nao classificado")
            partido = str(row.get("sigla_partido") or "Sem partido")
            nodes.add(ideologia)
            nodes.add(partido)
            key = (ideologia, partido)
            links[key] = links.get(key, 0) + 1

        return ChartSpec(
            type="sankey",
            title=self.context.question.title,
            description=self.context.question.description,
            series=[
                {
                    "nodes": [{"name": name} for name in sorted(nodes)],
                    "links": [
                        {"source": source, "target": target, "value": value}
                        for (source, target), value in links.items()
                    ],
                }
            ],
            options={},
        )

    def _build_treemap_chart(
        self, rows: list[dict[str, Any]], x_field: str | None, y_fields: list[str]
    ) -> ChartSpec:
        if not rows or not x_field or not y_fields:
            return ChartSpec(
                type="treemap",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )
        y_field = y_fields[0]
        aggregated: dict[str, float] = {}
        for row in rows:
            key = str(row.get(x_field, "Sem categoria"))
            value = row.get(y_field, 0)
            if isinstance(value, (int, float)):
                aggregated[key] = aggregated.get(key, 0.0) + float(value)

        data = [{"name": key, "value": value} for key, value in aggregated.items()]
        data = sorted(data, key=lambda item: item["value"], reverse=True)[:50]
        return ChartSpec(
            type="treemap",
            title=self.context.question.title,
            description=self.context.question.description,
            series=[{"name": _humanize_label(y_field), "data": data}],
            options={},
        )

    def _build_heatmap_wordcloud_chart(self, rows: list[dict[str, Any]]) -> ChartSpec:
        eixo_values = sorted({str(row.get("eixo_maior", "")) for row in rows if row.get("eixo_maior")})
        dep_values = sorted({str(row.get("nome", "")) for row in rows if row.get("nome")})[:80]

        row_index = {dep: idx for idx, dep in enumerate(dep_values)}
        col_index = {eixo: idx for idx, eixo in enumerate(eixo_values)}
        heatmap: list[list[Any]] = []
        for row in rows:
            dep = str(row.get("nome", ""))
            eixo = str(row.get("eixo_maior", ""))
            qtd = row.get("qtd_proposicoes", 0)
            if dep in row_index and eixo in col_index and isinstance(qtd, (int, float)):
                heatmap.append([row_index[dep], col_index[eixo], qtd])

        word_table = _find_first_table(
            self.complement_tables,
            lambda table: "token" in table.columns and "frequencia" in table.columns,
        )
        words = []
        if word_table:
            for row in word_table.rows[:200]:
                token = row.get("token")
                freq = row.get("frequencia")
                if token and isinstance(freq, (int, float)):
                    words.append({"name": str(token), "value": freq})

        return ChartSpec(
            type="heatmap_wordcloud",
            title=self.context.question.title,
            description=self.context.question.description,
            categories=dep_values,
            series=[
                {
                    "name": "heatmap",
                    "x_categories": dep_values,
                    "y_categories": eixo_values,
                    "data": heatmap,
                },
                {
                    "name": "wordcloud",
                    "data": words,
                },
            ],
            options={},
        )


def _find_first_table(
    tables: Iterable[ParsedTable],
    matcher: Any,
    excluded: set[int] | None = None,
) -> ParsedTable | None:
    excluded = excluded or set()
    for table in tables:
        if id(table) in excluded:
            continue
        if matcher(table):
            return table
    return None


def _is_global_ranking_table(table: ParsedTable) -> bool:
    return "ranking global" in table.title.lower()


def _without_year_filter(state: FilterState) -> FilterState:
    return FilterState(
        anos=[],
        eixos=state.eixos,
        partidos=state.partidos,
        ufs=state.ufs,
        deputados=state.deputados,
        escolaridade=state.escolaridade,
        search=state.search,
        sort_by=state.sort_by,
        sort_dir=state.sort_dir,
        page=state.page,
        page_size=state.page_size,
    )


def _humanize_label(key: str) -> str:
    return key.replace("_", " ").strip().capitalize()


def _infer_unit(column_name: str) -> str | None:
    name = column_name.lower()
    if "pct" in name or "percent" in name or "alinhamento" in name or "fidelidade" in name:
        return "%"
    if "gasto" in name or "total_pago" in name or "valor" in name:
        return "R$"
    return "contagem"


def _format_summary_card_value(column_name: str, value: Any) -> str:
    if value is None:
        return "-"
    if _should_scale_percentage(column_name, value):
        scaled_value = round(float(value) * 100, 2)
        if scaled_value.is_integer():
            return str(int(scaled_value))
        return _format_value(scaled_value)
    return _format_value(value)


def _should_scale_percentage(column_name: str, value: Any) -> bool:
    name = column_name.lower()
    if "alinhamento" not in name:
        return False
    if not isinstance(value, (int, float)):
        return False
    numeric_value = float(value)
    return 0 <= numeric_value <= 1


def _format_value(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, float):
        return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if isinstance(value, int):
        return f"{value:,}".replace(",", ".")
    return str(value)


def _is_numeric_column(rows: list[dict[str, Any]], column: str) -> bool:
    if not rows:
        return False
    for row in rows[:50]:
        value = row.get(column)
        if value is None:
            continue
        return isinstance(value, (int, float))
    return False

