"""Canonical party catalog shared by ETL inputs."""

from __future__ import annotations

import csv
from dataclasses import dataclass
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

    @property
    def is_active(self) -> bool:
        return self.status == ACTIVE_STATUS


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
            ideologia = C.clean_text(row.get("ideologia"))
            entries.append(PartyCatalogEntry(sigla, status, ideologia))
    return _deduplicate(entries)


def active_party_ideology_rows(path: Path | None = None) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for entry in load_party_catalog(path):
        if entry.is_active and entry.ideologia:
            rows.append({"sigla_partido": entry.sigla_partido, "ideologia": entry.ideologia})
    return rows


def _deduplicate(entries: Iterable[PartyCatalogEntry]) -> list[PartyCatalogEntry]:
    by_sigla: dict[str, PartyCatalogEntry] = {}
    for entry in entries:
        by_sigla.setdefault(entry.sigla_partido, entry)
    return sorted(by_sigla.values(), key=lambda item: (item.status != ACTIVE_STATUS, item.sigla_partido))
