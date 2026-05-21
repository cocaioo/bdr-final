"""
Loader genérico do ETL.

Fluxo para cada tabela:
  1. Lê CSV bruto
  2. Seleciona e renomeia colunas
  3. Aplica funções de limpeza
  4. Remove duplicatas por PK
  5. Remove linhas com campos obrigatórios nulos
  6. Exporta CSV limpo
  7. TRUNCATE + COPY no PostgreSQL
"""

import time
import logging
from pathlib import Path

import pandas as pd

from . import cleaning as C
from . import db
from .utils import read_csv, write_clean_csv

logger = logging.getLogger(__name__)


def load_table(config, conn, schema, data_dir, clean_dir):
    """Processa uma tabela completa: limpeza + carga.

    Args:
        config: dict com a configuração da tabela (de mappings.TABLES)
        conn: conexão psycopg2
        schema: schema do PostgreSQL
        data_dir: diretório dos CSVs brutos
        clean_dir: diretório para CSVs limpos

    Returns:
        dict com estatísticas: rows_raw, rows_clean, rows_loaded, status, error
    """
    table_name = config["table"]
    csv_file = config.get("file")
    stats = {
        "table": table_name,
        "rows_raw": 0,
        "rows_clean": 0,
        "rows_loaded": 0,
        "status": "ok",
        "error": None,
    }

    # ---- Verificar se tem CSV ----
    if csv_file is None:
        stats["status"] = "skip"
        stats["error"] = "sem CSV disponível"
        return stats

    csv_path = Path(data_dir) / csv_file
    if not csv_path.exists():
        stats["status"] = "skip"
        stats["error"] = f"arquivo não encontrado: {csv_file}"
        return stats

    # ---- 1. Ler CSV ----
    logger.info(f"  Lendo {csv_file}...")
    df = read_csv(csv_path)
    stats["rows_raw"] = len(df)
    logger.info(f"  {len(df):,} linhas lidas")

    # ---- 2. Selecionar e renomear colunas + aplicar limpeza ----
    columns_map = config["columns"]
    transform_type = config.get("transform")

    out = pd.DataFrame()

    # Transform especial para deputados (id extraído da URI)
    if transform_type == "_deputados":
        if "uri" in df.columns:
            out["id_dep"] = df["uri"].apply(C.extract_id_from_uri).apply(C.clean_int)
            out["uri_dep"] = df["uri"].apply(C.clean_text)
        for csv_col, (db_col, clean_fn) in columns_map.items():
            if csv_col.startswith("_"):
                continue  # pula marcadores internos
            if csv_col == "uri":
                continue  # já tratado acima
            if csv_col in df.columns:
                out[db_col] = df[csv_col].apply(clean_fn) if clean_fn else df[csv_col]

    # Transform especial para votações (idEvento=0 → NULL)
    elif transform_type == "_votacoes":
        for csv_col, (db_col, clean_fn) in columns_map.items():
            if csv_col in df.columns:
                out[db_col] = df[csv_col].apply(clean_fn) if clean_fn else df[csv_col]
        if "idevento" in out.columns:
            out["idevento"] = out["idevento"].replace({"0": None})

    # Transform padrão
    else:
        for csv_col, (db_col, clean_fn) in columns_map.items():
            if csv_col in df.columns:
                out[db_col] = df[csv_col].apply(clean_fn) if clean_fn else df[csv_col]
            else:
                # Coluna não existe no CSV — preencher com None
                out[db_col] = None

    # ---- 3. Remover duplicatas por PK ----
    pk_cols = config["pk"]
    if pk_cols:
        before = len(out)
        out = out.drop_duplicates(subset=pk_cols, keep="first")
        dups = before - len(out)
        if dups > 0:
            logger.info(f"  {dups:,} duplicatas removidas")

    # ---- 4. Remover linhas com campos obrigatórios nulos ----
    required = config.get("required", [])
    if required:
        present_required = [c for c in required if c in out.columns]
        if present_required:
            before = len(out)
            mask = out[present_required].isna() | (out[present_required] == "")
            out = out[~mask.any(axis=1)]
            removed = before - len(out)
            if removed > 0:
                logger.info(f"  {removed:,} linhas removidas (campos obrigatórios nulos)")

    # ---- 5. Remover colunas IDENTITY do COPY ----
    skip = config.get("skip_identity", [])
    copy_columns = [c for c in out.columns if c not in skip]
    out_copy = out[copy_columns]

    stats["rows_clean"] = len(out_copy)
    logger.info(f"  {len(out_copy):,} linhas após limpeza")

    # ---- 6. Exportar CSV limpo ----
    clean_path = Path(clean_dir) / f"{table_name}.csv"
    write_clean_csv(out_copy, clean_path)
    logger.info(f"  CSV limpo salvo: {clean_path.name}")

    # ---- 7. COPY para PostgreSQL ----
    try:
        db.copy_csv(conn, schema, table_name, copy_columns, clean_path)
        stats["rows_loaded"] = stats["rows_clean"]
        logger.info(f"  ✓ {stats['rows_loaded']:,} linhas carregadas no banco")
    except Exception as e:
        stats["status"] = "erro_carga"
        stats["error"] = str(e)
        conn.rollback()
        logger.error(f"  ✗ Erro no COPY: {e}")

    return stats
