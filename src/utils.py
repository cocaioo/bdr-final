"""
Utilitários gerais do ETL.

- Configuração de logging simples
- Leitura robusta de CSV com fallback de encoding
"""

import csv
import logging
from pathlib import Path

import pandas as pd


def setup_logging(log_dir):
    """Configura logging simples: arquivo + console, formato legível."""
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "etl.log"

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Arquivo
    fh = logging.FileHandler(log_file, encoding="utf-8", mode="w")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    # Console
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    return logger


def read_csv(path, delimiter=";"):
    """Lê CSV com fallback robusto de encoding.

    Tenta: utf-8 → utf-8-sig → latin1 (com errors='replace' no último).
    Retorna DataFrame com todas as colunas como string.
    """
    path = Path(path)

    # Tentar utf-8 primeiro
    for encoding in ["utf-8", "utf-8-sig"]:
        try:
            df = pd.read_csv(
                path,
                sep=delimiter,
                dtype=str,
                encoding=encoding,
                quotechar='"',
                keep_default_na=False,
                na_values=[],
                on_bad_lines="skip",
                engine="python",
            )
            return df
        except (UnicodeDecodeError, UnicodeError):
            continue

    # Fallback: latin1 com errors=replace (nunca falha)
    df = pd.read_csv(
        path,
        sep=delimiter,
        dtype=str,
        encoding="latin1",
        quotechar='"',
        keep_default_na=False,
        na_values=[],
        on_bad_lines="skip",
        engine="python",
    )
    return df


def write_clean_csv(df, path, delimiter=";"):
    """Exporta DataFrame como CSV limpo UTF-8."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(
        path,
        sep=delimiter,
        index=False,
        encoding="utf-8",
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\n",
    )
