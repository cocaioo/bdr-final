from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


class DeputadoTemasService:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.artifacts_dir = repo_root / "JF" / "producao-legislativa-temas" / "analytics"
        self._cache: tuple[int, int, list[dict[str, Any]]] | None = None

    def temas_nuvem(self, id_deputado: str) -> dict[str, Any]:
        rows = [row for row in self._read_all() if str(row.get("id_deputado")) == str(id_deputado)]
        rows = sorted(rows, key=lambda row: float(row.get("qtd_proposicoes") or 0), reverse=True)
        return {
            "id_deputado": id_deputado,
            "temas": [
                {"tema": row.get("tema"), "qtd_proposicoes": row.get("qtd_proposicoes")}
                for row in rows
            ],
        }

    def _read_all(self) -> list[dict[str, Any]]:
        path = self._path("deputado_temas_nuvem.csv")
        stat = path.stat()
        if self._cache and self._cache[0] == stat.st_mtime_ns and self._cache[1] == stat.st_size:
            return self._cache[2]

        with path.open("r", encoding="utf-8", newline="") as handle:
            rows = [_coerce_row(row) for row in csv.DictReader(handle, delimiter=";")]
        self._cache = (stat.st_mtime_ns, stat.st_size, rows)
        return rows

    def _path(self, filename: str) -> Path:
        path = self.artifacts_dir / filename
        if not path.exists():
            raise FileNotFoundError(
                f"Arquivo analitico de temas por deputado nao encontrado: {path}. "
                "Rode `make temas-nuvem-analytics`."
            )
        return path


def _coerce_row(row: dict[str, str]) -> dict[str, Any]:
    return {key: _coerce_value(value) for key, value in row.items()}


def _coerce_value(value: str | None) -> Any:
    if value is None:
        return None
    text = value.strip()
    if text == "":
        return ""
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text
