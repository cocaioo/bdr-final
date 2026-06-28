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
    # Clear memory / garbage collector
    import gc
    gc.collect()
    time.sleep(0.5)
    
    rss_start = get_process_rss_mb()
    
    # Initialize service
    with mock.patch("app.sqlite_runtime.is_sqlite_available", return_value=use_sqlite):
        service = DashboardService(repo_root=REPO_ROOT)
        
        # Query 1: Unfiltered Q12 (First page, size 20)
        state_unfiltered = FilterState(
            anos=[], eixos=[], partidos=[], ufs=[], deputados=[], escolaridade=[],
            search=None, sort_by="total_pago", sort_dir="desc", page=1, page_size=20
        )
        
        t0 = time.perf_counter()
        payload_unfiltered = service.get_question_payload("q12", state_unfiltered)
        t_unfiltered = (time.perf_counter() - t0) * 1000  # ms
        
        # Query 2: Deputy-filtered Q12 (Dorinaldo Malafaia, page size 10)
        state_filtered = FilterState(
            anos=[], eixos=[], partidos=[], ufs=[], deputados=["220593"], escolaridade=[],
            search=None, sort_by="total_pago", sort_dir="desc", page=1, page_size=10
        )
        
        t0 = time.perf_counter()
        payload_filtered = service.get_question_payload("q12", state_filtered)
        t_filtered = (time.perf_counter() - t0) * 1000  # ms
        
        # Garbage collect and measure peak memory
        gc.collect()
        rss_end = get_process_rss_mb()
        
        return {
            "label": label,
            "rss_start": rss_start,
            "rss_end": rss_end,
            "rss_diff": max(0.0, rss_end - rss_start),
            "unfiltered_time_ms": t_unfiltered,
            "unfiltered_total_rows": payload_unfiltered.table_spec.total,
            "unfiltered_returned_rows": len(payload_unfiltered.table_spec.rows),
            "filtered_time_ms": t_filtered,
            "filtered_total_rows": payload_filtered.table_spec.total,
            "filtered_returned_rows": len(payload_filtered.table_spec.rows),
        }

def main():
    print("=" * 60)
    print("       Q12 RUNTIME BENCHMARK: TXT vs SQLite")
    print("=" * 60)
    
    # 1. Run TXT/CSV Fallback Benchmark
    print("Running TXT/CSV Fallback implementation...")
    txt_res = run_benchmarks("TXT/CSV Fallback", use_sqlite=False)
    
    # 2. Run SQLite Benchmark
    print("Running SQLite implementation...")
    sqlite_res = run_benchmarks("SQLite DB", use_sqlite=True)
    
    # Output results
    print("\n" + "=" * 60)
    print("                      BENCHMARK RESULTS")
    print("=" * 60)
    print(f"{'Metric':<30} | {'TXT Fallback':<12} | {'SQLite':<12}")
    print("-" * 60)
    
    print(f"{'Initial Process RSS (MB)':<30} | {txt_res['rss_start']:>12.2f} | {sqlite_res['rss_start']:>12.2f}")
    print(f"{'RSS After Q12 Queries (MB)':<30} | {txt_res['rss_end']:>12.2f} | {sqlite_res['rss_end']:>12.2f}")
    print(f"{'Memory delta (MB)':<30} | {txt_res['rss_diff']:>12.2f} | {sqlite_res['rss_diff']:>12.2f}")
    print("-" * 60)
    print(f"{'Q12 Unfiltered Latency (ms)':<30} | {txt_res['unfiltered_time_ms']:>12.2f} | {sqlite_res['unfiltered_time_ms']:>12.2f}")
    print(f"{'Q12 Unfiltered Total Rows':<30} | {txt_res['unfiltered_total_rows']:>12} | {sqlite_res['unfiltered_total_rows']:>12}")
    print(f"{'Q12 Unfiltered Returned Rows':<30} | {txt_res['unfiltered_returned_rows']:>12} | {sqlite_res['unfiltered_returned_rows']:>12}")
    print("-" * 60)
    print(f"{'Q12 Deputy Filter Latency (ms)':<30} | {txt_res['filtered_time_ms']:>12.2f} | {sqlite_res['filtered_time_ms']:>12.2f}")
    print(f"{'Q12 Deputy Filter Total Rows':<30} | {txt_res['filtered_total_rows']:>12} | {sqlite_res['filtered_total_rows']:>12}")
    print(f"{'Q12 Deputy Filter Returned Rows':<30} | {txt_res['filtered_returned_rows']:>12} | {sqlite_res['filtered_returned_rows']:>12}")
    print("=" * 60)
    
    # Check viability
    mem_saved = txt_res['rss_end'] - sqlite_res['rss_end']
    print(f"Memory saved by SQLite: {mem_saved:.2f} MB")
    print(f"Render Free 512MB viability: {'EXCELLENT' if sqlite_res['rss_end'] < 200 else 'VIABLE' if sqlite_res['rss_end'] < 350 else 'TIGHT'}")
    print("=" * 60)

if __name__ == "__main__":
    main()
