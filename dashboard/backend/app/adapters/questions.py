from datetime import datetime, timezone
from typing import Any

from .base import QuestionAdapter
from ..filter_engine import FilterEngine, FilterState
from ..models import ChartSpec, TableSpec, QuestionPayload, SummaryCard, EmptyState, QueryPanel


class Q1Adapter(QuestionAdapter):
    """Gastos por deputado."""


class Q2Adapter(QuestionAdapter):
    """Eixos e nuvem de palavras."""

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        images = [
            {
                "year": year,
                "src": f"/wordclouds/q2_nuvem_palavras_{year}.svg",
                "alt": f"Nuvem de palavras dos eixos tematicos em {year}",
            }
            for year in (2023, 2024, 2025, 2026)
        ]
        return ChartSpec(
            type="wordcloud_images",
            title="Nuvens de eixos por ano",
            description=(
                "Nuvens de palavras geradas com os temas como termos e peso proporcional "
                "a quantidade de proposicoes (interativo)."
            ),
            series=[],
            options={"images": images},
        )

    def _build_complements(self, state: FilterState) -> list[TableSpec]:
        return []


class Q3Adapter(QuestionAdapter):
    """Votos por eixo."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        payload = super().build_payload(state)
        
        main_rows = self.main_table.rows if self.main_table else []
        if not main_rows or "votos_total" not in main_rows[0]:
            return payload

        filtered = FilterEngine.apply_filters(
            main_rows,
            state,
            self.context.question.supported_filters,
        )
        
        total_sim = sum(int(row.get("votos_sim") or 0) for row in filtered)
        total_nao = sum(int(row.get("votos_nao") or 0) for row in filtered)
        total_abst = sum(int(row.get("abstencoes") or 0) for row in filtered)
        total_votos = sum(int(row.get("votos_total") or 0) for row in filtered)
        
        payload.summary_cards = [
            SummaryCard(
                id="total_votos",
                label="Total de votos",
                value=f"{total_votos:,}".replace(",", "."),
                unit="votos",
            ),
            SummaryCard(
                id="votos_sim",
                label="Votos Sim",
                value=f"{total_sim:,}".replace(",", "."),
                unit="votos",
            ),
            SummaryCard(
                id="votos_nao",
                label="Votos Não",
                value=f"{total_nao:,}".replace(",", "."),
                unit="votos",
            ),
            SummaryCard(
                id="abstencoes",
                label="Abstenções",
                value=f"{total_abst:,}".replace(",", "."),
                unit="votos",
            ),
        ]
        return payload


class Q4Adapter(QuestionAdapter):
    """Escolaridade de deputados ativos."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        # Para a Q4, as linhas principais (tabela principal e gráfico) NÃO devem ser filtradas por escolaridade.
        # Isso mantém a tabela principal e o gráfico exibindo a distribuição completa.
        main_rows = self.main_table.rows if self.main_table else []
        main_supported_filters = [f for f in self.context.question.supported_filters if f != "escolaridade"]
        filtered_rows = FilterEngine.apply_filters(
            main_rows,
            state,
            main_supported_filters,
        )
        sorted_rows = FilterEngine.apply_sort(filtered_rows, state.sort_by, state.sort_dir)
        paged_rows = FilterEngine.apply_pagination(sorted_rows, state.page, state.page_size)

        # Gera cards de resumo dinâmicos baseados no total de deputados na tabela complementar filtrada
        summary_cards = self._build_q4_summary_cards(state)
        
        chart_spec = self.build_chart_spec(filtered_rows)
        table_spec = self._build_table_spec(
            title=self.main_table.title if self.main_table else "Tabela principal",
            columns=self.main_table.columns if self.main_table else [],
            rows=paged_rows,
            total=len(sorted_rows),
            state=state,
        )
        
        # A tabela complementar é filtrada normalmente (incluindo o filtro de escolaridade)
        complement_specs = self._build_complements(state)

        has_data = table_spec.total > 0 or any(spec.total > 0 for spec in complement_specs)
        empty = EmptyState(
            is_empty=not has_data,
            message="Sem dados para os filtros selecionados." if not has_data else "",
        )

        filters_applied = {
            "anos": state.anos,
            "eixos": state.eixos,
            "partidos": state.partidos,
            "ufs": state.ufs,
            "deputados": state.deputados,
            "escolaridade": state.escolaridade,
            "search": state.search,
            "sort_by": state.sort_by,
            "sort_dir": state.sort_dir,
            "page": state.page,
            "page_size": state.page_size,
        }

        return QuestionPayload(
            question_id=self.context.question.id,
            title=self.context.question.title,
            description=self.context.question.description,
            filters_supported=self.context.question.supported_filters,
            filters_applied=filters_applied,
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

    def _build_q4_summary_cards(self, state: FilterState) -> list[SummaryCard]:
        if not self.complement_tables:
            return []
        
        comp_table = self.complement_tables[0]
        filtered = FilterEngine.apply_filters(
            comp_table.rows,
            state,
            self.context.question.supported_filters,
        )
        total_deputados = len(filtered)
        
        return [
            SummaryCard(
                id="total_deputados",
                label="Total de deputados",
                value=str(total_deputados),
                unit="deputados",
            )
        ]


class Q5Adapter(QuestionAdapter):
    """Fornecedores com maior total pago."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        payload = super().build_payload(state)
        
        # Se houver um único ano selecionado no filtro, atualiza os cards de resumo com a linha correspondente
        if state.anos and len(state.anos) == 1 and self.summary_table and self.summary_table.rows:
            target_year = str(state.anos[0])
            selected_row = None
            for row in self.summary_table.rows:
                if str(row.get("ano_dados")) == target_year:
                    selected_row = row
                    break
            
            if selected_row:
                from .base import _humanize_label, _format_summary_card_value, _infer_unit
                payload.summary_cards = [
                    SummaryCard(
                        id=key,
                        label=_humanize_label(key),
                        value=_format_summary_card_value(key, value),
                        unit=_infer_unit(key),
                    )
                    for key, value in selected_row.items()
                    if key != "ano_dados"
                ]
        
        # Garante que o card "ano_dados" nunca seja exibido (inclusive no estado inicial sem filtros)
        payload.summary_cards = [card for card in payload.summary_cards if card.id != "ano_dados"]
                
        return payload


class Q6Adapter(QuestionAdapter):
    """Correlacoes por escolaridade."""


class Q7Adapter(QuestionAdapter):
    """Indice custo-beneficio."""


class Q8Adapter(QuestionAdapter):
    """Influencia legislativa."""


class Q9Adapter(QuestionAdapter):
    """Vies ideologico e partidario."""


class Q10Adapter(QuestionAdapter):
    """Alinhamento interno de partidos."""


class Q11Adapter(QuestionAdapter):
    """Rankings partidarios."""


class Q12Adapter(QuestionAdapter):
    """Deputado x fornecedor."""


class Q13Adapter(QuestionAdapter):
    """Categorias de gasto por deputado."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        payload = super().build_payload(state)
        
        # Se houver um único ano selecionado no filtro, atualiza os cards de resumo com a linha correspondente
        if state.anos and len(state.anos) == 1 and self.summary_table and self.summary_table.rows:
            target_year = str(state.anos[0])
            selected_row = None
            for row in self.summary_table.rows:
                if str(row.get("ano_dados")) == target_year:
                    selected_row = row
                    break
            
            if selected_row:
                from .base import _humanize_label, _format_summary_card_value, _infer_unit
                payload.summary_cards = [
                    SummaryCard(
                        id=key,
                        label=_humanize_label(key),
                        value=_format_summary_card_value(key, value),
                        unit=_infer_unit(key),
                    )
                    for key, value in selected_row.items()
                    if key != "ano_dados"
                ]
        
        # Garante que o card "ano_dados" nunca seja exibido (inclusive no estado inicial sem filtros)
        payload.summary_cards = [card for card in payload.summary_cards if card.id != "ano_dados"]
        
        # Remove as duas últimas tabelas de categorias de gastos consolidados,
        # já que essa informação já é apresentada dinamicamente no gráfico de treemap.
        if payload.complement_tables:
            payload.complement_tables = payload.complement_tables[:1]
                
        return payload


ADAPTERS_BY_ID = {
    "q1": Q1Adapter,
    "q2": Q2Adapter,
    "q3": Q3Adapter,
    "q4": Q4Adapter,
    "q5": Q5Adapter,
    "q6": Q6Adapter,
    "q7": Q7Adapter,
    "q8": Q8Adapter,
    "q9": Q9Adapter,
    "q10": Q10Adapter,
    "q11": Q11Adapter,
    "q12": Q12Adapter,
    "q13": Q13Adapter,
}

