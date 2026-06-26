"""Canonical party catalog shared by ETL inputs."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from . import cleaning as C


ACTIVE_STATUS = "ativo"
CATALOG_PATH = Path(__file__).resolve().parents[1] / "catalogos" / "partidos.csv"


@dataclass(frozen=True, slots=True)
class PartyCatalogEntry:
    sigla_partido: str
    status: str
    ideologia: str | None = None
    ideologia_score: str | None = None
    ideologia_faixa: str | None = None
    campo_ideologico: str | None = None
    fonte_ideologia: str | None = None
    ano_base_ideologia: str | None = None
    tipo_match_ideologia: str | None = None
    observacao_ideologia: str | None = None
    score_2018: str | None = None
    score_2022: str | None = None
    mediana_2022: str | None = None
    n_respostas_2022: str | None = None
    desvio_padrao_2022: str | None = None
    entra_universo_analitico: str | None = None

    @property
    def is_active(self) -> bool:
        return self.status == ACTIVE_STATUS

    @property
    def in_analytic_universe(self) -> bool:
        return (self.entra_universo_analitico or "").strip().lower() == "sim"


def load_party_catalog(path: Path | None = None) -> list[PartyCatalogEntry]:
    source = Path(path or CATALOG_PATH)
    if not source.exists():
        return []

    entries: list[PartyCatalogEntry] = []
    with source.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file, delimiter=";")
        for row in reader:
            sigla = C.clean_party(row.get("sigla_partido"))
            if not sigla:
                continue
            status = (row.get("status") or "").strip().lower() or "sem_status"
            entries.append(PartyCatalogEntry(
                sigla_partido=sigla,
                status=status,
                ideologia=C.clean_text(row.get("ideologia")),
                ideologia_score=C.clean_text(row.get("ideologia_score")),
                ideologia_faixa=C.clean_text(row.get("ideologia_faixa")),
                campo_ideologico=C.clean_text(row.get("campo_ideologico")),
                fonte_ideologia=C.clean_text(row.get("fonte_ideologia")),
                ano_base_ideologia=C.clean_text(row.get("ano_base_ideologia")),
                tipo_match_ideologia=C.clean_text(row.get("tipo_match_ideologia")),
                observacao_ideologia=C.clean_text(row.get("observacao_ideologia")),
                score_2018=C.clean_text(row.get("score_2018")),
                score_2022=C.clean_text(row.get("score_2022")),
                mediana_2022=C.clean_text(row.get("mediana_2022")),
                n_respostas_2022=C.clean_text(row.get("n_respostas_2022")),
                desvio_padrao_2022=C.clean_text(row.get("desvio_padrao_2022")),
                entra_universo_analitico=C.clean_text(row.get("entra_universo_analitico")),
            ))
    return _deduplicate(entries)


def active_party_ideology_rows(path: Path | None = None) -> list[dict[str, str | None]]:
    """Return rows for partidos_ideologia table.

    Loads parties where entra_universo_analitico == 'sim'.  The legacy
    ideologia column is kept as an alias of campo_ideologico so older
    consumers can continue to read the macro field while newer queries use
    score, faixa, source and match metadata directly. Falls back to the
    legacy filter (status == 'ativo' + ideologia/campo column) when the
    catalog lacks entra_universo_analitico.
    """
    rows: list[dict[str, str | None]] = []
    entries = load_party_catalog(path)

    has_universe_flag = any(e.entra_universo_analitico is not None for e in entries)

    for entry in entries:
        if has_universe_flag and not entry.in_analytic_universe:
            continue
        if not has_universe_flag and not entry.is_active:
            continue

        campo = entry.campo_ideologico or entry.ideologia
        if not campo:
            continue

        rows.append({
            "sigla_partido": entry.sigla_partido,
            "ideologia": campo,
            "ideologia_score": entry.ideologia_score,
            "ideologia_faixa": entry.ideologia_faixa,
            "campo_ideologico": campo,
            "fonte_ideologia": entry.fonte_ideologia,
            "ano_base_ideologia": entry.ano_base_ideologia,
            "tipo_match_ideologia": entry.tipo_match_ideologia,
            "observacao_ideologia": entry.observacao_ideologia,
        })
    return rows


def _deduplicate(entries: Iterable[PartyCatalogEntry]) -> list[PartyCatalogEntry]:
    by_sigla: dict[str, PartyCatalogEntry] = {}
    for entry in entries:
        by_sigla.setdefault(entry.sigla_partido, entry)
    return sorted(by_sigla.values(), key=lambda item: (item.status != ACTIVE_STATUS, item.sigla_partido))
