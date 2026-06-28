import os
import sqlite3
import pytest
from pathlib import Path
from unittest import mock

from app.filter_engine import FilterState
from app.sqlite_runtime import is_sqlite_available, query_sqlite_table
from app.service import DashboardService
from app.adapters.questions import Q12Adapter
from app.adapters.base import AdapterContext

# Repo root resolve
REPO_ROOT = Path(__file__).resolve().parents[3]

def test_sqlite_availability() -> None:
    # Test with real file if it exists
    real_exists = (REPO_ROOT / "runtime" / "bdr_runtime.sqlite").exists()
    assert is_sqlite_available(REPO_ROOT) == real_exists

def test_sqlite_fallback_behavior() -> None:
    service = DashboardService(repo_root=REPO_ROOT)
    state = FilterState(
        anos=[],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=["74454"],  # Eunício Oliveira
        escolaridade=[],
        search=None,
        sort_by="total_pago",
        sort_dir="desc",
        page=1,
        page_size=5
    )
    
    # 1. Query with SQLite available (assuming it was built)
    db_exists = (REPO_ROOT / "runtime" / "bdr_runtime.sqlite").exists()
    if db_exists:
        payload_sqlite = service.get_question_payload("q12", state)
        assert payload_sqlite.table_spec.total > 0
        assert len(payload_sqlite.table_spec.rows) > 0
        assert str(payload_sqlite.table_spec.rows[0]["id_deputado"]) == "74454"
        
        # 2. Query with SQLite forced to unavailable
        with mock.patch("app.sqlite_runtime.is_sqlite_available", return_value=False):
            # Clear caches to force reload
            service._bundle_cache.clear()
            service.cache._store = {}
            
            payload_fallback = service.get_question_payload("q12", state)
            assert payload_fallback.table_spec.total > 0
            assert len(payload_fallback.table_spec.rows) > 0
            assert str(payload_fallback.table_spec.rows[0]["id_deputado"]) == "74454"
            
            # Compare contents
            assert payload_sqlite.table_spec.total == payload_fallback.table_spec.total
            assert payload_sqlite.table_spec.rows[0]["fornecedor"] == payload_fallback.table_spec.rows[0]["fornecedor"]

def test_sqlite_filtering_sorting_pagination() -> None:
    if not is_sqlite_available(REPO_ROOT):
        pytest.skip("SQLite database not available for this test")
        
    db_path = REPO_ROOT / "runtime" / "bdr_runtime.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    
    # Test query_sqlite_table with years filter
    state_years = FilterState(
        anos=["2023"],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=[],
        escolaridade=[],
        search=None,
        sort_by="total_pago",
        sort_dir="desc",
        page=1,
        page_size=10
    )
    
    rows, total = query_sqlite_table(conn, "q12_complemento", state_years, is_global_ranking=False)
    assert total > 0
    assert len(rows) <= 10
    assert all(row["ano_dados"] == "2023" for row in rows)
    
    # Test sorting
    state_sort = FilterState(
        anos=["2023"],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=[],
        escolaridade=[],
        search=None,
        sort_by="qtd_lancamentos",
        sort_dir="asc",
        page=1,
        page_size=5
    )
    rows_sort, _ = query_sqlite_table(conn, "q12_complemento", state_sort, is_global_ranking=False)
    assert len(rows_sort) >= 2
    assert rows_sort[0]["qtd_lancamentos"] <= rows_sort[-1]["qtd_lancamentos"]
    
    # Test search
    state_search = FilterState(
        anos=[],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=[],
        escolaridade=[],
        search="CARNAUBA",
        sort_by="total_pago",
        sort_dir="desc",
        page=1,
        page_size=5
    )
    rows_search, total_search = query_sqlite_table(conn, "q12_complemento", state_search, is_global_ranking=False)
    assert total_search > 0
    assert any("CARNAUBA" in str(row["fornecedor"]).upper() or "CARNAUBA" in str(row["nome"]).upper() for row in rows_search)
    
    conn.close()
