"""
Pipeline ETL — Câmara dos Deputados (Grupo 4)

Executa limpeza e carga de todas as tabelas na ordem correta.

Uso:
    python -m src.main
"""

import os
import time
import logging
import csv
from pathlib import Path

from dotenv import load_dotenv

from .utils import setup_logging
from .mappings import TABLES, LOAD_ORDER, ALL_TABLES_ORDERED
from .loaders import load_table
from . import db

logger = logging.getLogger(__name__)


def main():
    # ---- Carregar .env ----
    load_dotenv()

    # ---- Configurações ----
    schema = os.getenv("DB_SCHEMA", "grupo4")
    data_dir = Path(os.getenv("RAW_DATA_DIR", "./tabelas"))
    clean_dir = Path(os.getenv("CLEAN_DATA_DIR", "./dados_padronizados"))
    log_dir = Path(os.getenv("LOG_DIR", "./logs"))

    clean_dir.mkdir(parents=True, exist_ok=True)

    # ---- Logging ----
    setup_logging(log_dir)

    # ---- Banner ----
    logger.info("=" * 60)
    logger.info("ETL — Câmara dos Deputados (Grupo 4)")
    logger.info("=" * 60)
    logger.info(f"Schema: {schema}")
    logger.info(f"Dados:  {data_dir.resolve()}")
    logger.info(f"Padronizados: {clean_dir.resolve()}")
    logger.info(f"Logs:   {log_dir.resolve()}")
    logger.info(f"Tabelas: {len(LOAD_ORDER)}")
    logger.info("")

    # ---- Conexão ----
    try:
        conn = db.get_connection()
        db.set_search_path(conn, schema)
        logger.info("✓ Conexão com PostgreSQL estabelecida")
    except Exception as e:
        logger.error(f"✗ Falha na conexão com PostgreSQL: {e}")
        logger.error("  Verifique se o Docker está rodando e o .env está correto")
        return

    # ---- TRUNCATE todas as tabelas de uma vez ----
    logger.info("")
    logger.info("Limpando tabelas...")
    try:
        db.truncate_all(conn, schema, ALL_TABLES_ORDERED)
    except Exception as e:
        logger.warning(f"  Aviso ao truncar: {e}")
        conn.rollback()

    # ---- Processar tabelas ----
    results = []
    total_start = time.time()

    for i, table_key in enumerate(LOAD_ORDER, 1):
        config = TABLES[table_key]
        logger.info("")
        logger.info(f"[{i}/{len(LOAD_ORDER)}] {config['table']}")
        logger.info("-" * 40)

        start = time.time()
        try:
            stats = load_table(config, conn, schema, data_dir, clean_dir, log_dir)
            stats["duration"] = f"{time.time() - start:.1f}s"
            results.append(stats)
        except Exception as e:
            logger.error(f"  ✗ ERRO FATAL: {e}")
            conn.rollback()
            results.append({
                "table": config["table"],
                "rows_raw": 0,
                "rows_clean": 0,
                "rows_loaded": 0,
                "status": "erro",
                "error": str(e),
                "duration": f"{time.time() - start:.1f}s",
            })
            # Continua para a próxima tabela

    # ---- Fechar conexão ----
    conn.close()
    _write_manifest(results, log_dir)

    # ---- Resumo final ----
    total_time = time.time() - total_start
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESUMO FINAL")
    logger.info("=" * 60)
    logger.info("")
    logger.info(f"  {'Tabela':<35} {'Status':<10} {'Bruto':>10} {'Limpo':>10} {'Cargado':>10} {'Tempo':>8}")
    logger.info(f"  {'-'*35} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*8}")

    ok_count = 0
    err_count = 0
    skip_count = 0

    for r in results:
        status_icon = "✓" if r["status"] == "ok" else ("⊘" if r["status"] == "skip" else "✗")
        logger.info(
            f"  {r['table']:<35} {status_icon} {r['status']:<8} "
            f"{r['rows_raw']:>10,} {r['rows_clean']:>10,} {r['rows_loaded']:>10,} "
            f"{r.get('duration', ''):>8}"
        )
        if r.get("error"):
            logger.info(f"    → {r['error']}")

        if r["status"] == "ok":
            ok_count += 1
        elif r["status"] == "skip":
            skip_count += 1
        else:
            err_count += 1

    logger.info("")
    logger.info(f"  Total: {ok_count} ok, {skip_count} skip, {err_count} erros")
    logger.info(f"  Tempo total: {total_time:.1f}s")
    logger.info("=" * 60)


def _write_manifest(results, log_dir):
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / "etl_load_manifest.csv"
    columns = [
        "table",
        "source_files",
        "years",
        "rows_raw",
        "rows_bad",
        "rows_clean",
        "rows_loaded",
        "status",
        "error",
        "duration",
    ]
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)
    logger.info(f"Manifest de carga salvo: {path.resolve()}")


if __name__ == "__main__":
    main()
