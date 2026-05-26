"""
Utilitários gerais do ETL.

- Configuração de logging simples
- Leitura robusta de CSV com fallback de encoding
"""

import csv
import logging
import re
from pathlib import Path
from typing import Optional

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


def read_csv(path, delimiter=";", bad_lines=None):
    """Lê CSV com fallback robusto de encoding.

    Tenta: utf-8 → utf-8-sig → latin1 (com errors='replace' no último).
    Retorna DataFrame com todas as colunas como string.
    """
    path = Path(path)
    on_bad_lines = _bad_line_handler(bad_lines)

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
                on_bad_lines=on_bad_lines,
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
        on_bad_lines=on_bad_lines,
        engine="python",
    )
    return df


def _bad_line_handler(bad_lines):
    if bad_lines is None:
        return "skip"

    def collect_bad_line(fields):
        bad_lines.append(fields)
        return None

    return collect_bad_line


def find_data_file(base_dir: Path, filename: str) -> Optional[Path]:
    """Localiza um arquivo por nome, procurando tambem em subpastas."""
    matches = find_data_files(base_dir, filename)
    if matches:
        return matches[0]

    base_dir = Path(base_dir)
    if re.fullmatch(r"\d{4}", base_dir.name):
        parent_candidate = base_dir.parent / filename
        if parent_candidate.is_file() and not _ignored_path(parent_candidate):
            return parent_candidate
    return None


def find_data_files(base_dir: Path, pattern: str) -> list[Path]:
    """Localiza arquivos por padrao, ignorando pastas ocultas e temporarios."""
    base_dir = Path(base_dir)
    if not base_dir.exists():
        return []

    candidates = []
    for candidate in base_dir.rglob(pattern):
        if candidate.is_file() and not _ignored_path(candidate):
            candidates.append(candidate)

    return sorted(candidates, key=lambda path: (extract_year(path) or 0, str(path).lower()))


def extract_year(path) -> Optional[int]:
    """Extrai ano de nomes como Ano-2026.csv ou do diretorio pai."""
    path = Path(path)
    match = re.search(r"(?:^|[-_/\\])(20\d{2})(?:\D|$)", str(path))
    if match:
        return int(match.group(1))
    return None


def _ignored_path(path: Path) -> bool:
    if any(part.startswith(".") for part in path.parts):
        return True
    name = path.name.lower()
    return name.startswith("~") or name.endswith((".tmp", ".temp", ".bak", ".swp"))


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
