import sqlite3
import pytest
from pathlib import Path
from unittest import mock

from app.filter_engine import FilterState
from app.sqlite_runtime import is_sqlite_available, query_q3_votos_sqlite
from app.service import DashboardService

REPO_ROOT = Path(__file__).resolve().parents[3]

def test_sqlite_q3_availability() -> None:
    real_exists = (REPO_ROOT / "runtime" / "bdr_runtime.sqlite").exists()
    assert is_sqlite_available(REPO_ROOT) == real_exists

def test_sqlite_q3_fallback_and_matching_rows() -> None:
    if not is_sqlite_available(REPO_ROOT):
        pytest.skip("SQLite database not available for this test")
        
    service = DashboardService(repo_root=REPO_ROOT)
    # Filter by Dorinaldo Malafaia (id_deputado = 220573)
    state = FilterState(
        anos=[],
        eixos=[],
        partidos=[],
        ufs=[],
        deputados=["220573"],
        escolaridade=[],
        search=None,
        sort_by=None,
        sort_dir="desc",
        page=1,
        page_size=10
    )
    
    # 1. Query with SQLite enabled
    payload_sqlite = service.get_question_payload("q3", state)
    assert payload_sqlite.table_spec.total > 0
    assert len(payload_sqlite.table_spec.rows) > 0
    
    # 2. Query with SQLite forced to unavailable
    with mock.patch("app.sqlite_runtime.is_sqlite_available", return_value=False):
        # Clear caches to force reload
        service._bundle_cache.clear()
        service.cache._store = {}
        
        payload_fallback = service.get_question_payload("q3", state)
        assert payload_fallback.table_spec.total > 0
        assert len(payload_fallback.table_spec.rows) > 0
        
        # Compare SQLite and fallback payloads
        assert payload_sqlite.table_spec.total == payload_fallback.table_spec.total
        assert len(payload_sqlite.table_spec.rows) == len(payload_fallback.table_spec.rows)
        assert payload_sqlite.table_spec.rows[0]["ano_dados"] == payload_fallback.table_spec.rows[0]["ano_dados"]
        assert payload_sqlite.table_spec.rows[0]["proposicao_votacao"] == payload_fallback.table_spec.rows[0]["proposicao_votacao"]

def test_sqlite_q3_no_deputy_filter_does_not_load_votes_csv() -> None:
    service = DashboardService(repo_root=REPO_ROOT)
    state_no_deputy = FilterState(
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
        page_size=10
    )
    
    # Mock _parse_document to track loaded files
    original_parse = service._parse_document
    loaded_files = []
    
    def mock_parse(path):
        loaded_files.append(Path(path).name)
        return original_parse(path)
        
    with mock.patch.object(service, "_parse_document", side_effect=mock_parse):
        service._bundle_cache.clear()
        service.cache._store = {}
        
        payload = service.get_question_payload("q3", state_no_deputy)
        assert payload.table_spec.total == 0  # Expected empty selection payload
        
        # Verify that q3_votos_min.csv was NOT parsed/loaded into memory
        assert "q3_votos_min.csv" not in loaded_files
        # But q3_resumos_agregados.csv should be loaded
        assert "q3_resumos_agregados.csv" in loaded_files
