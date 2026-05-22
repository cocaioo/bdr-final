"""API enrichment helpers for Dados Abertos da Camara."""

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pandas as pd

from . import cleaning as C

logger = logging.getLogger(__name__)

API_BASE = "https://dadosabertos.camara.leg.br/api/v2/deputados"


def _load_cache(path):
    path = Path(path)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache(path, cache):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _fetch_deputado(id_deputado):
    url = f"{API_BASE}/{id_deputado}"
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "BDR-Grupo4/1.0"})
    try:
        with urlopen(req, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return str(id_deputado), {"error": str(exc)}

    dados = payload.get("dados") or {}
    return str(id_deputado), {
        "cpf": C.clean_cpf(dados.get("cpf")),
        "nome_civil": C.clean_text(dados.get("nomeCivil")),
        "escolaridade": C.clean_text(dados.get("escolaridade")),
    }


def enrich_deputados(df):
    """Fill cpf, nome_civil and escolaridade from the official Camara API."""
    enabled = os.getenv("ENRICH_DEPUTADOS_API", "true").strip().lower()
    if enabled in {"0", "false", "no", "nao"}:
        logger.info("  Enriquecimento pela API desabilitado")
        return df

    cache_path = Path(os.getenv("API_CACHE_PATH", "./logs/deputados_api_cache.json"))
    cache = _load_cache(cache_path)

    ids = [str(v) for v in df["id_deputado"].dropna().astype(str).unique()]
    missing_ids = [id_ for id_ in ids if id_ not in cache]

    if missing_ids:
        workers = int(os.getenv("API_WORKERS", "8"))
        logger.info(f"  Buscando dados na API da Camara: {len(missing_ids)} deputados")
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            futures = [pool.submit(_fetch_deputado, id_) for id_ in missing_ids]
            for future in as_completed(futures):
                id_deputado, data = future.result()
                cache[id_deputado] = data
        _save_cache(cache_path, cache)
    else:
        logger.info("  Cache da API da Camara reutilizado")

    enriched = df.copy()
    by_id = enriched["id_deputado"].astype(str)

    filled_cpf = 0
    filled_schooling = 0
    for idx, id_deputado in by_id.items():
        data = cache.get(id_deputado) or {}
        if data.get("error"):
            continue

        cpf = data.get("cpf")
        if cpf and not _has_value(enriched.at[idx, "cpf"]):
            enriched.at[idx, "cpf"] = cpf
            filled_cpf += 1

        nome_civil = data.get("nome_civil")
        if nome_civil and not _has_value(enriched.at[idx, "nome_civil"]):
            enriched.at[idx, "nome_civil"] = nome_civil

        escolaridade = data.get("escolaridade")
        if escolaridade and not _has_value(enriched.at[idx, "escolaridade"]):
            enriched.at[idx, "escolaridade"] = escolaridade
            filled_schooling += 1

    logger.info(
        "  API integrada: %s CPFs e %s escolaridades preenchidos",
        filled_cpf,
        filled_schooling,
    )
    return enriched


def _has_value(value):
    if value is None:
        return False
    if isinstance(value, float) and pd.isna(value):
        return False
    return str(value).strip() != ""
