from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from .filter_engine import FilterState
from .models import QuestionPayload, TableSpec, SummaryCard, ChartSpec, QueryPanel, EmptyState
from .parser import ParsedTable, ParsedDocument

def is_sqlite_available(repo_root: Path) -> bool:
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    return db_path.exists() and db_path.is_file()

def load_q12_filter_data(repo_root: Path) -> list[ParsedDocument]:
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Query distinct years from principal
    cursor.execute("SELECT DISTINCT ano_dados FROM q12_principal WHERE ano_dados != 'GLOBAL'")
    years = [row[0] for row in cursor.fetchall()]
    
    # Query distinct deputados from principal
    cursor.execute("SELECT DISTINCT id_deputado, nome, sigla_uf, sigla_partido FROM q12_principal")
    deputados = cursor.fetchall()
    
    rows = []
    for yr in years:
        rows.append({"ano_dados": yr})
        
    for dep_id, nome, sigla_uf, sigla_partido in deputados:
        rows.append({
            "id_deputado": dep_id,
            "nome": nome,
            "sigla_uf": sigla_uf,
            "sigla_partido": sigla_partido
        })
        
    conn.close()
    
    return [
        ParsedDocument(
            title="Q12 filter data",
            tables=[
                ParsedTable(
                    title="Filter data",
                    columns=["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido"],
                    rows=rows
                )
            ]
        )
    ]

def build_where_clause(state: FilterState, is_global_ranking: bool) -> tuple[str, list[Any]]:
    where_clauses = []
    params = []
    
    if not is_global_ranking and state.anos:
        placeholders = ", ".join("?" for _ in state.anos)
        where_clauses.append(f"ano_dados IN ({placeholders})")
        params.extend(state.anos)
        
    if state.deputados:
        dep_clauses = []
        for dep in state.deputados:
            dep_clauses.append("id_deputado = ? OR nome = ?")
            try:
                dep_int = int(dep)
                params.extend([dep_int, dep])
            except ValueError:
                params.extend([dep, dep])
        where_clauses.append(f"({ ' OR '.join(dep_clauses) })")
        
    if state.search:
        search_query = f"%{state.search}%"
        where_clauses.append("(nome LIKE ? OR fornecedor LIKE ?)")
        params.extend([search_query, search_query])
        
    where_str = " AND ".join(where_clauses)
    if where_str:
        return f"WHERE {where_str}", params
    return "", []

def get_order_by_clause(sort_by: str | None, sort_dir: str, default_col: str = "total_pago") -> str:
    valid_columns = {
        "ano_dados", "id_deputado", "nome", "sigla_uf",
        "sigla_partido", "fornecedor", "qtd_lancamentos",
        "total_pago", "pct_total"
    }
    col = sort_by if sort_by in valid_columns else default_col
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    return f"ORDER BY {col} {direction}"

def query_sqlite_table(
    conn: sqlite3.Connection,
    table_name: str,
    state: FilterState,
    is_global_ranking: bool,
    default_sort: str = "total_pago",
    page: int | None = None,
    page_size: int | None = None
) -> tuple[list[dict[str, Any]], int]:
    cursor = conn.cursor()
    where_clause, params = build_where_clause(state, is_global_ranking)
    
    # Get total matching rows
    count_sql = f"SELECT COUNT(*) FROM {table_name} {where_clause}"
    cursor.execute(count_sql, params)
    total = cursor.fetchone()[0]
    
    # Get sorted and paginated rows
    order_clause = get_order_by_clause(state.sort_by, state.sort_dir, default_sort)
    if page is None:
        page = state.page
    if page_size is None:
        page_size = state.page_size
        
    offset = max(page - 1, 0) * page_size
    query_sql = f"SELECT * FROM {table_name} {where_clause} {order_clause} LIMIT ? OFFSET ?"
    cursor.execute(query_sql, params + [page_size, offset])
    rows = [dict(r) for r in cursor.fetchall()]
    
    return rows, total

def query_q12_sqlite(repo_root: Path, adapter: Any, state: FilterState) -> QuestionPayload:
    from datetime import datetime, timezone
    from .adapters.base import _humanize_label, _format_summary_card_value, _infer_unit
    
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # 1. Summary Cards
        cursor.execute("SELECT * FROM q12_resumo")
        resumo_rows = [dict(r) for r in cursor.fetchall()]
        summary_cards = []
        if resumo_rows:
            first_row = resumo_rows[0]
            summary_cards = [
                SummaryCard(
                    id=key,
                    label=_humanize_label(key),
                    value=_format_summary_card_value(key, value),
                    unit=_infer_unit(key)
                )
                for key, value in first_row.items()
            ]
            
        # 2. Main table query (top 30 pares) from q12_principal
        cursor.execute("SELECT * FROM q12_principal")
        principal_rows = [dict(r) for r in cursor.fetchall()]
        
        from .filter_engine import FilterEngine
        filtered_main = FilterEngine.apply_filters(principal_rows, state, adapter.context.question.supported_filters)
        sorted_main = FilterEngine.apply_sort(filtered_main, state.sort_by, state.sort_dir)
        paged_main = FilterEngine.apply_pagination(sorted_main, state.page, state.page_size)
        
        has_deputy = bool(state.deputados)
        in_top_30 = len(filtered_main) > 0
        
        if has_deputy and not in_top_30:
            # Fallback path: main table is q12_ranking_global
            rows_global, total_global = query_sqlite_table(
                conn, "q12_ranking_global", state, is_global_ranking=True,
                page=state.page, page_size=state.page_size
            )
            
            # Chart spec uses all filtered rows of q12_ranking_global
            where_clause, params = build_where_clause(state, is_global_ranking=True)
            cursor.execute(f"SELECT * FROM q12_ranking_global {where_clause} ORDER BY total_pago DESC", params)
            all_filtered_global = [dict(r) for r in cursor.fetchall()]
            chart_spec = adapter.build_chart_spec(all_filtered_global)
            
            global_columns = ["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido", "fornecedor", "qtd_lancamentos", "total_pago", "pct_total"]
            table_spec = adapter._build_table_spec(
                title="Ranking global - todos os anos",
                columns=global_columns,
                rows=rows_global,
                total=total_global,
                state=state
            )
            
            # Complement table: q12_complemento (page=1, size=min(state.page_size, 100))
            comp_page_size = min(state.page_size, 100)
            comp_rows, comp_total = query_sqlite_table(
                conn, "q12_complemento", state, is_global_ranking=False,
                page=1, page_size=comp_page_size
            )
            comp_columns = ["ano_dados", "id_deputado", "nome", "fornecedor", "qtd_lancamentos", "total_pago"]
            comp_spec = adapter._build_table_spec(
                title="Q12 complemento - ranking completo deputado x fornecedor",
                columns=comp_columns,
                rows=comp_rows,
                total=comp_total,
                state=state
            )
            comp_spec.page = 1
            comp_spec.page_size = comp_page_size
            
            complement_tables = [comp_spec]
        else:
            # Normal path: main table is q12_principal
            chart_spec = adapter.build_chart_spec(filtered_main)
            
            main_columns = ["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido", "fornecedor", "qtd_lancamentos", "total_pago", "pct_total"]
            table_spec = adapter._build_table_spec(
                title="Tabela principal - top 30 pares por total pago",
                columns=main_columns,
                rows=paged_main,
                total=len(sorted_main),
                state=state
            )
            
            # Complement 1: q12_ranking_global
            from .adapters.base import _without_year_filter
            global_state = _without_year_filter(state)
            global_page_size = min(state.page_size, 200)
            global_rows, global_total = query_sqlite_table(
                conn, "q12_ranking_global", global_state, is_global_ranking=True,
                page=state.page, page_size=global_page_size
            )
            global_columns = ["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido", "fornecedor", "qtd_lancamentos", "total_pago", "pct_total"]
            global_spec = adapter._build_table_spec(
                title="Ranking global - todos os anos",
                columns=global_columns,
                rows=global_rows,
                total=global_total,
                state=global_state
            )
            global_spec.page = state.page
            global_spec.page_size = global_page_size
            
            # Complement 2: q12_complemento
            comp_page_size = min(state.page_size, 100)
            comp_rows, comp_total = query_sqlite_table(
                conn, "q12_complemento", state, is_global_ranking=False,
                page=1, page_size=comp_page_size
            )
            comp_columns = ["ano_dados", "id_deputado", "nome", "fornecedor", "qtd_lancamentos", "total_pago"]
            comp_spec = adapter._build_table_spec(
                title="Q12 complemento - ranking completo deputado x fornecedor",
                columns=comp_columns,
                rows=comp_rows,
                total=comp_total,
                state=state
            )
            comp_spec.page = 1
            comp_spec.page_size = comp_page_size
            
            complement_tables = [global_spec, comp_spec]
            
        has_data = table_spec.total > 0 or any(spec.total > 0 for spec in complement_tables)
        empty = EmptyState(
            is_empty=not has_data,
            message="Sem dados para os filtros selecionados." if not has_data else "",
        )
        
        return QuestionPayload(
            question_id=adapter.context.question.id,
            title=adapter.context.question.title,
            description=adapter.context.question.description,
            filters_supported=adapter.context.question.supported_filters,
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
            complement_tables=complement_tables,
            query_panel=QueryPanel(
                sql_path=adapter.context.sql_path,
                sql_text=adapter.context.sql_text,
                explanation=adapter.context.question.explanation,
            ),
            warnings=adapter.warnings,
            empty_state=empty,
            dataset_version=adapter.context.dataset_version,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    finally:
        conn.close()

def query_q3_votos_sqlite(repo_root: Path, state: FilterState) -> list[dict[str, Any]]:
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    where_clauses = []
    params = []
    
    if state.deputados:
        dep_clauses = []
        for dep in state.deputados:
            dep_clauses.append("id_deputado = ? OR nome = ?")
            try:
                dep_int = int(dep)
                params.extend([dep_int, dep])
            except ValueError:
                params.extend([dep, dep])
        where_clauses.append(f"({ ' OR '.join(dep_clauses) })")
        
    if state.anos:
        placeholders = ", ".join("?" for _ in state.anos)
        where_clauses.append(f"ano_dados IN ({placeholders})")
        params.extend(state.anos)
        
    if state.eixos:
        placeholders = ", ".join("?" for _ in state.eixos)
        where_clauses.append(f"eixo_principal IN ({placeholders})")
        params.extend(state.eixos)
        
    where_str = " AND ".join(where_clauses)
    where_sql = f"WHERE {where_str}" if where_str else ""
    
    sql = f"SELECT * FROM q3_votos_min {where_sql}"
    cursor.execute(sql, params)
    rows = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return rows

def query_q3_classificacoes_sqlite(repo_root: Path, votacao_ids: list[str]) -> list[dict[str, Any]]:
    if not votacao_ids:
        return []
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    placeholders = ", ".join("?" for _ in votacao_ids)
    sql = f"SELECT * FROM q3_classificacao_votacoes WHERE id_votacao IN ({placeholders})"
    cursor.execute(sql, votacao_ids)
    rows = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return rows

def query_deputy_presence(repo_root: Path, id_deputado: int) -> list[dict[str, Any]]:
    db_path = repo_root / "runtime" / "bdr_runtime.sqlite"
    if not db_path.exists():
        return []
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT * FROM presenca_deputados WHERE id_deputado = ? ORDER BY ano_dados ASC",
            (id_deputado,)
        )
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    except sqlite3.OperationalError as e:
        # Table might not exist if build ran without presence CSV
        import logging
        logging.getLogger(__name__).warning(f"Table 'presenca_deputados' not found in SQLite: {e}")
        return []
    finally:
        conn.close()

