from datetime import datetime, timezone
from typing import Any

from .base import QuestionAdapter
from ..filter_engine import FilterEngine, FilterState
from ..models import ChartSpec, TableSpec, QuestionPayload, SummaryCard, EmptyState, QueryPanel


class Q1Adapter(QuestionAdapter):
    """Gastos por deputado."""

    def _build_summary_cards(self) -> list[SummaryCard]:
        main_rows = self.main_table.rows if self.main_table else []
        if not main_rows:
            return []

        total_spent = sum(float(r.get("gasto_total") or 0) for r in main_rows)
        num_deputados = len(main_rows)
        average_spent = total_spent / num_deputados if num_deputados > 0 else 0

        # Encontra o deputado com maior gasto
        max_dep = max(main_rows, key=lambda r: float(r.get("gasto_total") or 0))
        max_name = max_dep.get("nome", "Desconhecido")
        max_value = float(max_dep.get("gasto_total") or 0)

        from .base import _format_value

        return [
            SummaryCard(
                id="gasto_total",
                label="Gasto Total Geral",
                value=f"R$ {_format_value(total_spent)}",
                unit=None,
            ),
            SummaryCard(
                id="gasto_medio",
                label="Média por Deputado",
                value=f"R$ {_format_value(average_spent)}",
                unit=None,
            ),
            SummaryCard(
                id="maior_gasto",
                label="Maior Gasto Individual",
                value=f"{max_name} (R$ {_format_value(max_value)})",
                unit=None,
            ),
            SummaryCard(
                id="total_deputados",
                label="Deputados Analisados",
                value=str(num_deputados),
                unit="deputados",
            ),
        ]

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        # Pega os Top 15 e inverte a ordem para que o maior apareça no topo do gráfico
        top_rows = list(reversed(rows[:15]))
        chart_cfg = self.context.question.chart
        x_field = chart_cfg.get("x_field")
        y_fields = chart_cfg.get("y_fields", [])

        from .base import _humanize_label

        categories = [str(row.get(x_field, "")) for row in top_rows]
        series = []
        for y_field in y_fields:
            series.append(
                {
                    "name": _humanize_label(y_field),
                    "data": [row.get(y_field, 0) for row in top_rows],
                    "stack": None,
                }
            )

        return ChartSpec(
            type="bar_horizontal",
            title="Top 15 Deputados com Maiores Gastos",
            description="Ranking dos 15 parlamentares que mais consumiram cota no período",
            x_field=x_field,
            y_fields=y_fields,
            categories=categories,
            series=series,
            options={"orientation": "horizontal"},
        )


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
        years = sorted(list({int(r["ano_dados"]) for r in self.main_table.rows if r.get("ano_dados")})) if self.main_table else []
        images = [
            {
                "year": year,
                "src": f"/wordclouds/q2_nuvem_palavras_{year}.svg",
                "alt": f"Nuvem de palavras dos eixos tematicos em {year}",
            }
            for year in years
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
        # 1. Carrega os deputados a partir da tabela complementar original (q4_escolaridade_complementar.txt)
        comp_table = self.complement_tables[0] if self.complement_tables else None
        comp_rows = comp_table.rows if comp_table else []

        # 2. Carrega o mapeamento de deputado -> partido/UF a partir da Q1
        deputy_to_party = {}
        deputy_to_uf = {}
        
        q1_file = self.context.repo_root / "respostas" / "q1_gastos_deputados.txt"
        if not q1_file.exists():
            q1_file = self.context.repo_root / "Caio" / "q1" / "q1_gastos_deputados.txt"
            
        if q1_file.exists():
            try:
                from ..parser import parse_psql_file
                q1_doc = parse_psql_file(q1_file)
                for r in q1_doc.tables[0].rows:
                    dep_id = r.get("id_deputado")
                    party = r.get("sigla_partido")
                    uf = r.get("sigla_uf")
                    if dep_id:
                        dep_id_int = int(dep_id)
                        if party:
                            deputy_to_party[dep_id_int] = str(party).strip()
                        if uf:
                            deputy_to_uf[dep_id_int] = str(uf).strip()
            except Exception:
                pass

        # Enrich comp_rows in place so that _build_complements and FilterEngine can find the attributes
        from ..party_catalog import normalize_party
        for r in comp_rows:
            dep_id = r.get("id_deputado")
            dep_id_int = int(dep_id) if dep_id else -1
            party_raw = deputy_to_party.get(dep_id_int, "Nao informado")
            party_normalized = normalize_party(party_raw)
            if not party_normalized or party_normalized == "NAOINFORMADO":
                party_normalized = "Nao informado"
            r["sigla_partido"] = party_normalized
            r["sigla_uf"] = deputy_to_uf.get(dep_id_int, "Nao informado")

        deputy_records = comp_rows

        # 4. Aplica os filtros nos registros de deputados de acordo com a responsabilidade de cada componente
        # Gráfico 1 (Geral): Completamente sem filtros (Design A)
        records_for_chart1 = deputy_records
        
        # Gráfico 2 (Por Partido): Filtrado por escolaridade, mas NÃO por partidos (Opção 1)
        chart2_supported = [f for f in self.context.question.supported_filters if f != "partidos"]
        records_for_chart2 = FilterEngine.apply_filters(
            deputy_records,
            state,
            chart2_supported,
        )

        # Tabela principal: Filtrada por partidos, mas NÃO por escolaridade
        main_supported_filters = [f for f in self.context.question.supported_filters if f != "escolaridade"]
        filtered_records_for_main = FilterEngine.apply_filters(
            deputy_records,
            state,
            main_supported_filters,
        )

        # 5. Agrupa por escolaridade para montar as linhas da tabela principal (escolaridade | qtd_deputados)
        edu_counts = {}
        for r in filtered_records_for_main:
            edu = r["escolaridade"]
            edu_counts[edu] = edu_counts.get(edu, 0) + 1

        main_rows = []
        for edu, count in edu_counts.items():
            main_rows.append({
                "escolaridade": edu,
                "qtd_deputados": count
            })
        
        # Ordena a tabela principal como a original
        main_rows.sort(key=lambda x: (-x["qtd_deputados"], x["escolaridade"]))

        # Paginação e ordenação
        sorted_rows = FilterEngine.apply_sort(main_rows, state.sort_by or "qtd_deputados", state.sort_dir)
        paged_rows = FilterEngine.apply_pagination(sorted_rows, state.page, state.page_size)

        # 6. Card de resumo e complementos: Contando total de deputados que batem com todos os filtros (incluindo escolaridade)
        filtered_records_all = FilterEngine.apply_filters(
            deputy_records,
            state,
            self.context.question.supported_filters,
        )
        total_deputados = len(filtered_records_all)
        summary_cards = [
            SummaryCard(
                id="total_deputados",
                label="Total de deputados",
                value=str(total_deputados),
                unit="deputados",
            )
        ]

        # 7. Constrói os gráficos (dois gráficos: um simples e outro empilhado por partido)
        chart_spec = self.build_chart_spec(records_for_chart1, state, chart2_rows=records_for_chart2)

        # Tabela principal com as colunas originais (escolaridade | qtd_deputados)
        table_spec = self._build_table_spec(
            title="Distribuição de Escolaridade",
            columns=["escolaridade", "qtd_deputados"],
            rows=paged_rows,
            total=len(sorted_rows),
            state=state,
        )

        # Tabela complementar para compatibilidade com a API
        complement_specs = self._build_complements(state)

        has_data = table_spec.total > 0
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
            complement_tables=complement_specs, # Retorna para compatibilidade de API e testes
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

    def build_chart_spec(
        self,
        rows: list[dict[str, Any]],
        state: FilterState | None = None,
        chart2_rows: list[dict[str, Any]] | None = None
    ) -> ChartSpec:
        if not rows:
            return ChartSpec(
                type="bar_vertical",
                title="Sem dados",
                description="Não há dados suficientes para montar o gráfico.",
            )

        # 1. Gráfico Principal (Distribuição Geral de Escolaridade)
        edu_counts = {}
        for r in rows:
            edu = r["escolaridade"]
            edu_counts[edu] = edu_counts.get(edu, 0) + 1

        sorted_edu = sorted(list(edu_counts.keys()), key=lambda e: (-edu_counts[e], e))
        categories_edu = sorted_edu
        series_edu = [{
            "name": "Qtd deputados",
            "data": [edu_counts[e] for e in sorted_edu]
        }]

        main_chart = ChartSpec(
            type="bar_vertical",
            title="Distribuição Geral de Escolaridade",
            description="Total de deputados por nível de instrução.",
            x_field="escolaridade",
            y_fields=["qtd_deputados"],
            categories=categories_edu,
            series=series_edu,
            options={}
        )

        # 2. Segundo Gráfico (Gráfico Empilhado por Partido)
        c2_rows = chart2_rows if chart2_rows is not None else rows
        categories_party = sorted(list({str(row.get("sigla_partido", "")) for row in c2_rows if row.get("sigla_partido")}))
        escolaridades = sorted(list({str(row.get("escolaridade", "")) for row in c2_rows if row.get("escolaridade")}))

        # Filtra as séries do gráfico dinamicamente com base nos filtros ativos
        if state and state.escolaridade:
            selected_esc = {e.strip().lower() for e in state.escolaridade if e.strip()}
            if selected_esc:
                escolaridades = [e for e in escolaridades if e.strip().lower() in selected_esc]

        series_party = []
        for esc in escolaridades:
            data = []
            for party in categories_party:
                val = sum(
                    1 for r in c2_rows
                    if str(r.get("sigla_partido", "")) == party
                    and str(r.get("escolaridade", "")) == esc
                )
                data.append(val)
            
            if sum(data) > 0 or not state or not state.escolaridade:
                series_party.append({
                    "name": esc,
                    "data": data,
                    "stack": "total",
                })

        second_chart = ChartSpec(
            type="stacked_bar",
            title="Distribuição de Escolaridade por Partido",
            description="Nível de instrução detalhado de cada partido.",
            x_field="sigla_partido",
            y_fields=["qtd_deputados"],
            categories=categories_party,
            series=series_party,
            options={"orientation": "vertical"},
        )

        # Adiciona o segundo gráfico nas opções do primeiro
        main_chart.options["second_chart"] = second_chart

        return main_chart


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
    """Rankings partidarios — alterna entre consolidado e por ano conforme filtro.

    Quando nenhum ano esta selecionado nos filtros, exibe as tabelas
    consolidadas (com '-' na coluna ano_dados).
    Quando um ou mais anos estao selecionados, exibe as tabelas 'por ano'
    filtradas ao(s) ano(s) escolhido(s).
    """

    # -- helpers internos ------------------------------------------------

    @staticmethod
    def _is_consolidated(title: str) -> bool:
        return "consolidado" in title.lower()

    @staticmethod
    def _is_per_year(title: str) -> bool:
        return "por ano" in title.lower()

    @staticmethod
    def _add_ano_column(rows: list[dict], value: str = "-") -> list[dict]:
        """Insere 'ano_dados' no inicio de cada linha se ausente."""
        out = []
        for row in rows:
            new_row = {"ano_dados": value}
            new_row.update(row)
            out.append(new_row)
        return out

    @staticmethod
    def _ensure_ano_first(columns: list[str]) -> list[str]:
        if "ano_dados" in columns:
            return columns
        return ["ano_dados"] + list(columns)

    # -- override do build_payload ---------------------------------------

    def build_payload(self, state: FilterState) -> QuestionPayload:
        from datetime import datetime, timezone as tz
        from ..models import EmptyState, QueryPanel

        has_year_filter = bool(state.anos)

        # Separar tabelas consolidadas e por ano
        all_tables_raw = [self.main_table] + self.complement_tables if self.main_table else list(self.complement_tables)
        all_tables = [t for t in all_tables_raw if t is not None]

        consolidated = [t for t in all_tables if self._is_consolidated(t.title)]
        per_year = [t for t in all_tables if self._is_per_year(t.title)]
        # Tabelas que nao se encaixam em nenhuma categoria — excluir Q11.d textual
        _hidden = {"score", "nuvem de palavras"}
        other = [
            t for t in all_tables
            if not self._is_consolidated(t.title)
            and not self._is_per_year(t.title)
            and not any(h in t.title.lower() for h in _hidden)
        ]

        if has_year_filter:
            chosen_tables = per_year + other
        else:
            chosen_tables = consolidated + other

        # Main table = primeira tabela escolhida; restante = complementos
        main = chosen_tables[0] if chosen_tables else self.main_table
        complements = chosen_tables[1:] if len(chosen_tables) > 1 else []

        # Preparar linhas da tabela principal
        main_rows = main.rows if main else []
        main_columns = list(main.columns) if main else []

        if not has_year_filter and main and not self._is_per_year(main.title):
            main_rows = self._add_ano_column(main_rows, "-")
            main_columns = self._ensure_ano_first(main_columns)

        filtered_rows = FilterEngine.apply_filters(
            main_rows, state, self.context.question.supported_filters,
        )
        sorted_rows = FilterEngine.apply_sort(filtered_rows, state.sort_by, state.sort_dir)
        paged_rows = FilterEngine.apply_pagination(sorted_rows, state.page, state.page_size)

        BASE_TITLE_A = "Q11.a - Ranking de partidos por frequência nas votações"
        table_title = BASE_TITLE_A if has_year_filter else f"{BASE_TITLE_A} (Todos os anos)"

        table_spec = self._build_table_spec(
            title=table_title,
            columns=main_columns,
            rows=paged_rows,
            total=len(sorted_rows),
            state=state,
        )

        # Mapeamento de títulos normalizados para tabelas B e C
        _TITLE_MAP = {
            "proposicoes": "Q11.b - Ranking de partidos por proposicoes de projetos",
            "proposições": "Q11.b - Ranking de partidos por proposicoes de projetos",
            "gastos":      "Q11.c - Ranking de partidos por gastos",
        }

        def _normalized_complement_title(raw_title: str) -> str:
            lower = raw_title.lower()
            for keyword, base in _TITLE_MAP.items():
                if keyword in lower:
                    return base if has_year_filter else f"{base} (Todos os anos)"
            return raw_title

        # Complementos
        complement_specs = []
        for table in complements:
            t_rows = table.rows
            t_cols = list(table.columns)
            if not has_year_filter and not self._is_per_year(table.title):
                t_rows = self._add_ano_column(t_rows, "-")
                t_cols = self._ensure_ano_first(t_cols)

            t_filtered = FilterEngine.apply_filters(
                t_rows, state, self.context.question.supported_filters,
            )
            t_sorted = FilterEngine.apply_sort(t_filtered, state.sort_by, state.sort_dir)
            page_size = min(state.page_size, 200)
            t_paged = FilterEngine.apply_pagination(t_sorted, 1, page_size)
            complement_specs.append(
                self._build_table_spec(
                    title=_normalized_complement_title(table.title),
                    columns=t_cols,
                    rows=t_paged,
                    total=len(t_sorted),
                    state=FilterState(
                        anos=state.anos, eixos=state.eixos, partidos=state.partidos,
                        ufs=state.ufs, deputados=state.deputados,
                        escolaridade=state.escolaridade, search=state.search,
                        sort_by=state.sort_by, sort_dir=state.sort_dir,
                        page=1, page_size=page_size,
                    ),
                )
            )

        chart_spec = self.build_chart_spec(filtered_rows)
        summary_cards = self._build_summary_cards()

        has_data = table_spec.total > 0 or any(s.total > 0 for s in complement_specs)
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
                "anos": state.anos, "eixos": state.eixos,
                "partidos": state.partidos, "ufs": state.ufs,
                "deputados": state.deputados, "search": state.search,
                "sort_by": state.sort_by, "sort_dir": state.sort_dir,
                "page": state.page, "page_size": state.page_size,
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
            generated_at=datetime.now(tz.utc).isoformat(),
        )

    # -- chart spec (nuvens de palavras) ---------------------------------

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        images = [
            {
                "year": "Frequencia nas votacoes",
                "src": "/wordclouds/q11_nuvem_votacoes.svg",
                "alt": "Nuvem de palavras - Frequencia dos partidos nas votacoes",
            },
            {
                "year": "Proposicoes de projetos",
                "src": "/wordclouds/q11_nuvem_proposicoes.svg",
                "alt": "Nuvem de palavras - Proposicoes de projetos por partido",
            },
            {
                "year": "Gastos por partido",
                "src": "/wordclouds/q11_nuvem_gastos.svg",
                "alt": "Nuvem de palavras - Gastos por partido",
            },
        ]
        return ChartSpec(
            type="wordcloud_images",
            title="Q11.d - Nuvens de palavras por dimensao",
            description=(
                "Nuvens de palavras dos partidos ponderadas por votacoes, proposicoes e gastos. "
                "Partidos maiores indicam maior atividade na dimensao. "
                "Cores: verde = esquerda, amarelo = centro, laranja = direita."
            ),
            series=[],
            options={"images": images},
        )


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


class Q3NormalizedAdapter(QuestionAdapter):
    """Q3 normalizada: agregados para metricas, votos minimos para tabela."""

    def build_payload(self, state: FilterState) -> QuestionPayload:
        resumo_rows = self._resumo_rows()
        if not resumo_rows:
            return super().build_payload(state)

        if not state.deputados:
            return self._build_empty_selection_payload(state)

        votos_rows = self._votos_rows()
        classificacoes = self._classificacao_index()
        if not resumo_rows or not votos_rows:
            return super().build_payload(state)

        aggregate_filters = [f for f in self.context.question.supported_filters if f != "search"]
        filtered_resumo = FilterEngine.apply_filters(resumo_rows, state, aggregate_filters)
        filtered_votos = FilterEngine.apply_filters(
            votos_rows,
            state,
            self.context.question.supported_filters,
        )
        unique_votos = self._dedupe_vote_rows(filtered_votos)
        sorted_votos = FilterEngine.apply_sort(unique_votos, state.sort_by, state.sort_dir)
        paged_votos = FilterEngine.apply_pagination(sorted_votos, state.page, state.page_size)
        display_rows = [
            self._display_row(row, classificacoes.get(self._classification_key(row), {}))
            for row in paged_votos
        ]

        chart_spec = self.build_chart_spec(filtered_resumo)
        donut_data = self._build_donut_data(filtered_resumo)
        chart_spec.options["donut"] = donut_data
        chart_spec.options["second_chart"] = {
            "type": "donut",
            "title": "Distribuicao dos votos",
            "description": "Contagem de votos nominais unicos nas votacoes filtradas.",
            "x_field": None,
            "y_fields": [],
            "categories": [],
            "series": [{"name": "Votos", "data": donut_data}],
            "options": {},
        }

        table_spec = self._build_table_spec(
            title="Votos individuais",
            columns=self._display_columns(),
            rows=display_rows,
            total=len(sorted_votos),
            state=state,
        )
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
            summary_cards=self._build_vote_summary_cards(filtered_resumo),
            chart_spec=chart_spec,
            table_spec=table_spec,
            complement_tables=[],
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

    def _resumo_rows(self) -> list[dict[str, Any]]:
        table = self._find_table_with_columns({"votos_total", "eixo_principal"})
        return table.rows if table else []

    def _build_empty_selection_payload(self, state: FilterState) -> QuestionPayload:
        empty_chart = ChartSpec(
            type="bar_vertical",
            title="Distribuicao dos votos",
            description="Selecione um deputado para visualizar a distribuicao dos votos.",
            x_field="voto",
            y_fields=["votos_total"],
            categories=["Sim", "Nao", "Abstencao", "Outros"],
            series=[{"name": "Votos", "data": [0, 0, 0, 0]}],
            options={"orientation": "vertical"},
        )
        table_spec = self._build_table_spec(
            title="Votos individuais",
            columns=self._display_columns(),
            rows=[],
            total=0,
            state=state,
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
            summary_cards=[],
            chart_spec=empty_chart,
            table_spec=table_spec,
            complement_tables=[],
            query_panel=QueryPanel(
                sql_path=self.context.sql_path,
                sql_text=self.context.sql_text,
                explanation=self.context.question.explanation,
            ),
            warnings=self.warnings,
            empty_state=EmptyState(
                is_empty=True,
                message="Selecione um deputado para visualizar os votos.",
            ),
            dataset_version=self.context.dataset_version,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _votos_rows(self) -> list[dict[str, Any]]:
        table = self._find_table_with_columns({"id_votacao", "id_deputado", "voto"})
        return table.rows if table else []

    def _classificacao_rows(self) -> list[dict[str, Any]]:
        table = self._find_table_with_columns({"id_votacao", "evidencias_eixo_principal"})
        return table.rows if table else []

    def _find_table_with_columns(self, required: set[str]):
        for doc in self.context.documents:
            for table in doc.tables:
                if required.issubset(set(table.columns)):
                    return table
        return None

    @staticmethod
    def _vote_key(row: dict[str, Any]) -> tuple[Any, Any, Any]:
        return (row.get("ano_dados"), row.get("id_votacao"), row.get("id_deputado"))

    @staticmethod
    def _classification_key(row: dict[str, Any]) -> tuple[Any, Any]:
        return (row.get("ano_dados"), row.get("id_votacao"))

    def _dedupe_vote_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: dict[tuple[Any, Any, Any], dict[str, Any]] = {}
        for row in rows:
            deduped.setdefault(self._vote_key(row), row)
        return list(deduped.values())

    def _classificacao_index(self) -> dict[tuple[Any, Any], dict[str, Any]]:
        return {self._classification_key(row): row for row in self._classificacao_rows()}

    @staticmethod
    def _display_columns() -> list[str]:
        return [
            "ano_dados",
            "voto",
            "eixo_principal",
            "proposicao_votacao",
            "ementa_descricao",
        ]

    def _display_row(self, row: dict[str, Any], classificacao: dict[str, Any]) -> dict[str, Any]:
        merged = dict(row)
        for key, value in classificacao.items():
            merged.setdefault(key, value)
        merged["proposicao_votacao"] = (
            merged.get("materia_resumo")
            or merged.get("proposicoes_associadas_resumo")
            or merged.get("id_votacao")
        )
        merged["ementa_descricao"] = (
            merged.get("ementa_resumo")
            or merged.get("descricao_votacao")
            or "-"
        )
        return {column: merged.get(column) for column in self._display_columns()}

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        if not rows:
            return ChartSpec(
                type="bar_vertical",
                title="Sem dados",
                description="Nao ha dados suficientes para montar o grafico.",
            )

        categories = ["Sim", "Nao", "Abstencao", "Outros"]
        data = [
            sum(self._to_int(row.get("voto_sim")) for row in rows),
            sum(self._to_int(row.get("voto_nao")) for row in rows),
            sum(self._to_int(row.get("voto_abstencao")) for row in rows),
            sum(self._to_int(row.get("voto_outro")) for row in rows),
        ]

        return ChartSpec(
            type="bar_vertical",
            title="Distribuicao dos votos",
            description="Total de votos por tipo, respeitando os filtros aplicados.",
            x_field="voto",
            y_fields=["votos_total"],
            categories=categories,
            series=[{"name": "Votos", "data": data}],
            options={"orientation": "vertical"},
        )

    def _build_vote_summary_cards(self, rows: list[dict[str, Any]]) -> list[SummaryCard]:
        total_votos = sum(self._to_int(row.get("votos_total")) for row in rows)
        total_sim = sum(self._to_int(row.get("voto_sim")) for row in rows)
        total_nao = sum(self._to_int(row.get("voto_nao")) for row in rows)
        total_abst = sum(self._to_int(row.get("voto_abstencao")) for row in rows)
        total_outros = sum(self._to_int(row.get("voto_outro")) for row in rows)

        return [
            SummaryCard(id="total_votos", label="Total de votos", value=self._format_int(total_votos), unit="votos"),
            SummaryCard(id="votos_sim", label="Votos Sim", value=self._format_int(total_sim), unit="votos"),
            SummaryCard(id="votos_nao", label="Votos Nao", value=self._format_int(total_nao), unit="votos"),
            SummaryCard(id="abstencoes", label="Abstencoes", value=self._format_int(total_abst), unit="votos"),
            SummaryCard(id="votos_outros", label="Outros votos", value=self._format_int(total_outros), unit="votos"),
        ]

    def _build_donut_data(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sim = sum(self._to_int(row.get("voto_sim")) for row in rows)
        nao = sum(self._to_int(row.get("voto_nao")) for row in rows)
        abstencao = sum(self._to_int(row.get("voto_abstencao")) for row in rows)
        outros = sum(self._to_int(row.get("voto_outro")) for row in rows)
        return [
            {"name": "Sim", "value": sim},
            {"name": "Nao", "value": nao},
            {"name": "Abstencao", "value": abstencao},
            {"name": "Outros", "value": outros},
        ]

    @staticmethod
    def _to_int(value: Any) -> int:
        try:
            return int(value or 0)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _format_int(value: int) -> str:
        return f"{value:,}".replace(",", ".")

    @staticmethod
    def _vote_label(field: str) -> str:
        return {
            "voto_sim": "Sim",
            "voto_nao": "Nao",
            "voto_abstencao": "Abstencao",
            "voto_outro": "Outros",
        }.get(field, field)


ADAPTERS_BY_ID = {
    "q1": Q1Adapter,
    "q2": Q2Adapter,
    "q3": Q3NormalizedAdapter,
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

