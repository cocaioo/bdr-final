from __future__ import annotations

import csv
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ACTIVE_STATUS = "ativo"
PARTY_CATALOG_RELATIVE_PATH = Path("catalogos") / "partidos.csv"

_ALIASES = {
    "PCDOB.": "PCDOB",
    "REPUBLIC": "REPUBLICANOS",
    "REPUBLICANO": "REPUBLICANOS",
    "SOLIDARI": "SOLIDARIEDADE",
    "MISSAO": "MISSAO",
    "UNIAO": "UNIAO",
}


@dataclass(frozen=True, slots=True)
class PartyCatalogEntry:
    sigla: str
    status: str
    ideologia: str | None = None

    @property
    def is_active(self) -> bool:
        return self.status == ACTIVE_STATUS


def load_party_catalog(repo_root: Path) -> list[PartyCatalogEntry]:
    path = repo_root / PARTY_CATALOG_RELATIVE_PATH
    if not path.exists():
        return []

    entries: list[PartyCatalogEntry] = []
    with path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file, delimiter=";")
        for row in reader:
            sigla = normalize_party(row.get("sigla_partido"))
            if not sigla:
                continue
            status = (row.get("status") or "").strip().lower() or "sem_status"
            ideologia = (row.get("ideologia") or "").strip() or None
            entries.append(PartyCatalogEntry(sigla=sigla, status=status, ideologia=ideologia))
    return _deduplicate(entries)


def active_party_entries(repo_root: Path) -> list[PartyCatalogEntry]:
    return [entry for entry in load_party_catalog(repo_root) if entry.is_active]


def normalize_party(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    normalized = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    text = "".join(text.upper().split())
    return _ALIASES.get(text, text)


def active_party_values(repo_root: Path) -> set[str]:
    return {entry.sigla for entry in active_party_entries(repo_root)}


def _deduplicate(entries: Iterable[PartyCatalogEntry]) -> list[PartyCatalogEntry]:
    by_sigla: dict[str, PartyCatalogEntry] = {}
    for entry in entries:
        by_sigla.setdefault(entry.sigla, entry)
    return sorted(by_sigla.values(), key=lambda item: (item.status != ACTIVE_STATUS, item.sigla))
