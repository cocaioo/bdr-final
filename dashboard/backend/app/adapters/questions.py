from datetime import datetime, timezone
from typing import Any

from .base import QuestionAdapter
from ..filter_engine import FilterEngine, FilterState
from ..models import ChartSpec, TableSpec, QuestionPayload, SummaryCard, EmptyState, QueryPanel


class Q1Adapter(QuestionAdapter):
    """Gastos por deputado."""


class Q2Adapter(QuestionAdapter):
    """Eixos e nuvem de palavras."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        main_rows = self.main_table.rows if self.main_table else []

        if state.anos:
            allowed_years = {int(y) for y in state.anos if str(y).isdigit()}
            filtered_by_year = [r for r in main_rows if r.get("ano_dados") in allowed_years]
        else:
            aggregated: dict[tuple, dict[str, Any]] = {}
            for r in main_rows:
                key = (
                    r.get("id_deputado"),
                    r.get("nome"),
                    r.get("nome_civil"),
                    r.get("sigla_partido"),
                    r.get("sigla_uf"),
                    r.get("tema"),
                )
                if key not in aggregated:
                    aggregated[key] = {
                        "id_deputado": key[0],
                        "nome": key[1],
                        "nome_civil": key[2],
                        "sigla_partido": key[3],
                        "sigla_uf": key[4],
                        "tema": key[5],
                        "qtd_proposicoes": 0,
                        "proposicoes_aprovadas": 0,
                    }
                aggregated[key]["qtd_proposicoes"] += r.get("qtd_proposicoes") or 0
                aggregated[key]["proposicoes_aprovadas"] += r.get("proposicoes_aprovadas") or 0
            filtered_by_year = list(aggregated.values())

        supported_other = [f for f in self.context.question.supported_filters if f != "anos"]
        filtered_rows = FilterEngine.apply_filters(filtered_by_year, state, supported_other)

        sorted_rows = FilterEngine.apply_sort(filtered_rows, state.sort_by or "qtd_proposicoes", state.sort_dir)
        paged_rows = FilterEngine.apply_pagination(sorted_rows, state.page, state.page_size)

        chart_spec = self.build_chart_spec(filtered_rows)
        table_spec = self._build_table_spec(
            title=self.main_table.title if self.main_table else "Tabela principal",
            columns=self.main_table.columns if self.main_table else [],
            rows=paged_rows,
            total=len(sorted_rows),
            state=state,
        )

        summary_cards = self._build_summary_cards()
        complement_specs = self._build_complements(state)

        has_data = table_spec.total > 0
        empty = EmptyState(
            is_empty=not has_data,
            message="Sem dados para os filtros selecionados." if not has_data else "",
        )

        return QuestionPayload(
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


class Q6Adapter(QuestionAdapter):
    """Correlacoes por escolaridade."""


class Q7Adapter(QuestionAdapter):
    """Indice custo-beneficio."""


class Q8Adapter(QuestionAdapter):
    """Influencia legislativa."""


class Q9Adapter(QuestionAdapter):
    """Vies ideologico e partidario.

    Tabelas produzidas pelo SQL (3 secoes):
      - Q9.1 Catalogo:        ideologia | partidos | qtd_partidos   (resumo agrupado)
      - Q9.1 Lista completa:  sigla_partido | ideologia              (tabela principal → sankey)
      - Q9.2 Correlacao:      ano_dados | id_votacao | titulo | ideologia | pct_sim  (complemento)
      - Q9.3 Voto individual: ano_dados | id_votacao | titulo | id_deputado | ... | aderiu_orientacao
    """

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        """Sankey ideologia → partido a partir da tabela lista completa (Q9.1)."""
        links: dict[tuple[str, str], int] = {}
        nodes: set[str] = set()
        for row in rows:
            ideologia = str(row.get("ideologia") or "nao classificado").strip()
            partido = str(row.get("sigla_partido") or "Sem partido").strip()
            if not ideologia or not partido:
                continue
            nodes.add(ideologia)
            nodes.add(partido)
            key = (ideologia, partido)
            links[key] = links.get(key, 0) + 1

        if not nodes:
            return ChartSpec(
                type="sankey",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

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

    def _build_complements(self, state: FilterState) -> list[TableSpec]:
        """Expoe Q9.2 (correlacao) e Q9.3 (voto individual) como tabelas complementares."""
        specs: list[TableSpec] = []
        # Q9.2 — pct de Sim por campo ideologico
        q92 = _find_table_by_hint(self.complement_tables, "correlacao")
        # Q9.3 — voto individual
        q93 = _find_table_by_hint(self.complement_tables, "voto individual")

        for table in [q92, q93]:
            if table is None:
                continue
            filtered = FilterEngine.apply_filters(
                table.rows,
                state,
                self.context.question.supported_filters,
            )
            sorted_rows = FilterEngine.apply_sort(filtered, state.sort_by, state.sort_dir)
            page_size = min(state.page_size, 200)
            paged = FilterEngine.apply_pagination(sorted_rows, 1, page_size)
            specs.append(
                self._build_table_spec(
                    title=table.title,
                    columns=table.columns,
                    rows=paged,
                    total=len(sorted_rows),
                    state=FilterState(
                        anos=state.anos,
                        eixos=state.eixos,
                        partidos=state.partidos,
                        ufs=state.ufs,
                        deputados=state.deputados,
                        escolaridade=state.escolaridade,
                        search=state.search,
                        sort_by=state.sort_by,
                        sort_dir=state.sort_dir,
                        page=1,
                        page_size=page_size,
                    ),
                )
            )
        return specs


class Q10Adapter(QuestionAdapter):
    """Alinhamento interno de partidos.

    Tabelas produzidas pelo SQL (3 secoes):
      - Ranking consolidado:    posicao | sigla_partido | ideologia | pct_alinhamento  (principal)
      - Alinhamento por ano:    ano_dados | sigla_partido | ideologia | pct_alinhamento (complemento)
      - Disciplina individual:  sigla_partido | id_deputado | nome | pct_disciplina_individual (complemento)
    """

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        """Grafico de barras verticais com ranking de alinhamento consolidado."""
        if not rows:
            return ChartSpec(
                type="bar_vertical",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

        # Ordena por pct_alinhamento decrescente e usa todos os partidos (sem limite de 30)
        sorted_rows = sorted(
            rows,
            key=lambda r: float(r.get("pct_alinhamento", 0) or 0),
            reverse=True,
        )

        categories = [str(row.get("sigla_partido", "")) for row in sorted_rows]
        pct_values = [float(row.get("pct_alinhamento", 0) or 0) for row in sorted_rows]

        return ChartSpec(
            type="bar_vertical",
            title=self.context.question.title,
            description=self.context.question.description,
            x_field="sigla_partido",
            y_fields=["pct_alinhamento"],
            categories=categories,
            series=[
                {
                    "name": "% Alinhamento",
                    "data": pct_values,
                }
            ],
            options={"orientation": "vertical", "y_max": 100},
        )

    def _build_complements(self, state: FilterState) -> list[TableSpec]:
        """Expoe alinhamento por ano e disciplina individual como tabelas complementares."""
        specs: list[TableSpec] = []
        # Alinhamento por ano
        por_ano = _find_table_by_hint(self.complement_tables, "por ano")
        # Disciplina individual
        individual = _find_table_by_hint(self.complement_tables, "disciplina individual")

        for table in [por_ano, individual]:
            if table is None:
                continue
            filtered = FilterEngine.apply_filters(
                table.rows,
                state,
                self.context.question.supported_filters,
            )
            sorted_rows = FilterEngine.apply_sort(filtered, state.sort_by, state.sort_dir)
            page_size = min(state.page_size, 200)
            paged = FilterEngine.apply_pagination(sorted_rows, 1, page_size)
            specs.append(
                self._build_table_spec(
                    title=table.title,
                    columns=table.columns,
                    rows=paged,
                    total=len(sorted_rows),
                    state=FilterState(
                        anos=state.anos,
                        eixos=state.eixos,
                        partidos=state.partidos,
                        ufs=state.ufs,
                        deputados=state.deputados,
                        escolaridade=state.escolaridade,
                        search=state.search,
                        sort_by=state.sort_by,
                        sort_dir=state.sort_dir,
                        page=1,
                        page_size=page_size,
                    ),
                )
            )
        return specs


def _find_table_by_hint(tables: list, hint: str):
    """Retorna a primeira tabela cujo titulo contenha o hint (case-insensitive)."""
    hint_lower = hint.lower()
    for table in tables:
        if hint_lower in table.title.lower():
            return table
    return None


class Q11Adapter(QuestionAdapter):
    """Rankings partidarios."""


class Q12Adapter(QuestionAdapter):
    """Deputado x fornecedor."""


class Q13Adapter(QuestionAdapter):
    """Categorias de gasto por deputado."""


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

