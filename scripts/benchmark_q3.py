#!/usr/bin/env python
import sys
import time
import os
import subprocess
from pathlib import Path
from unittest import mock

# Resolve repo root and add backend to python path
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(REPO_ROOT / "dashboard" / "backend"))

from app.service import DashboardService
from app.filter_engine import FilterState

def get_process_rss_mb() -> float:
    try:
        pid = os.getpid()
        cmd = f'tasklist /FI "PID eq {pid}" /FO CSV /NH'
        out = subprocess.check_output(cmd, shell=True, text=True)
        parts = out.strip().split(',')
        if len(parts) >= 5:
            mem_str = parts[4].strip('"').replace(' K', '').replace('.', '').replace(',', '').strip()
            mem_digits = ''.join(c for c in mem_str if c.isdigit())
            if mem_digits:
                return float(mem_digits) / 1024.0 # Convert KB to MB
    except Exception as e:
        pass
    return 0.0

def run_benchmarks(label: str, use_sqlite: bool) -> dict:
    import gc
    gc.collect()
    time.sleep(0.5)
    
    rss_start = get_process_rss_mb()
    
    # Initialize service
    with mock.patch("app.sqlite_runtime.is_sqlite_available", return_value=use_sqlite):
        service = DashboardService(repo_root=REPO_ROOT)
        
        # Query: Deputy-filtered Q3 (Dorinaldo Malafaia, page size 10)
        # ID is 220573
        state = FilterState(
            anos=[], eixos=[], partidos=[], ufs=[], deputados=["220573"], escolaridade=[],
            search=None, sort_by=None, sort_dir="desc", page=1, page_size=10
        )
        
        t0 = time.perf_counter()
        payload = service.get_question_payload("q3", state)
        elapsed = (time.perf_counter() - t0) * 1000  # ms
        
        gc.collect()
        rss_end = get_process_rss_mb()
        
        return {
            "label": label,
            "rss_start": rss_start,
            "rss_end": rss_end,
            "rss_diff": max(0.0, rss_end - rss_start),
            "time_ms": elapsed,
            "total_rows": payload.table_spec.total,
            "returned_rows": len(payload.table_spec.rows),
        }

def main():
    print("=" * 60)
    print("       Q3 RUNTIME BENCHMARK: CSV vs SQLite")
    print("=" * 60)
    
    # 1. Run CSV Fallback Benchmark
    print("Running CSV Fallback implementation...")
    csv_res = run_benchmarks("CSV Fallback", use_sqlite=False)
    
    # 2. Run SQLite Benchmark
    print("Running SQLite implementation...")
    sqlite_res = run_benchmarks("SQLite DB", use_sqlite=True)
    
    # Assert correctness
    assert csv_res["total_rows"] == sqlite_res["total_rows"], "Error: Total row count mismatch!"
    assert csv_res["returned_rows"] == sqlite_res["returned_rows"], "Error: Returned row count mismatch!"
    print("Verification passed: row counts match exactly!")
    
    # Output results
    print("\n" + "=" * 60)
    print("                      BENCHMARK RESULTS")
    print("=" * 60)
    print(f"{'Metric':<30} | {'CSV Fallback':<12} | {'SQLite':<12}")
    print("-" * 60)
    
    print(f"{'Initial Process RSS (MB)':<30} | {csv_res['rss_start']:>12.2f} | {sqlite_res['rss_start']:>12.2f}")
    print(f"{'RSS After Q3 Queries (MB)':<30} | {csv_res['rss_end']:>12.2f} | {sqlite_res['rss_end']:>12.2f}")
    print(f"{'Memory delta (MB)':<30} | {csv_res['rss_diff']:>12.2f} | {sqlite_res['rss_diff']:>12.2f}")
    print("-" * 60)
    print(f"{'Q3 Deputy Query Latency (ms)':<30} | {csv_res['time_ms']:>12.2f} | {sqlite_res['time_ms']:>12.2f}")
    print(f"{'Q3 Deputy Query Total Rows':<30} | {csv_res['total_rows']:>12} | {sqlite_res['total_rows']:>12}")
    print(f"{'Q3 Deputy Query Returned Rows':<30} | {csv_res['returned_rows']:>12} | {sqlite_res['returned_rows']:>12}")
    print("=" * 60)
    
    mem_saved = csv_res['rss_end'] - sqlite_res['rss_end']
    print(f"Memory saved by SQLite: {mem_saved:.2f} MB")
    print(f"Render Free 512MB viability: {'EXCELLENT' if sqlite_res['rss_end'] < 200 else 'VIABLE' if sqlite_res['rss_end'] < 350 else 'TIGHT'}")
    print("=" * 60)

if __name__ == "__main__":
    main()
