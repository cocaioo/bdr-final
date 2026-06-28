from __future__ import annotations

import csv
import json
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AGGREGATE_FILES = {
    "resumo": "gastos_resumo.csv",
    "categorias": "gastos_por_categoria.csv",
    "deputados": "gastos_por_deputado.csv",
    "fornecedores": "gastos_por_fornecedor.csv",
    "partidos": "gastos_por_partido.csv",
    "ufs": "gastos_por_uf.csv",
}


@dataclass(slots=True)
class Page:
    number: int
    size: int


class GastosAnalyticsService:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.artifacts_dir = repo_root / "Caio" / "gastos-fornecedores" / "analytics"
        self._cache: dict[str, tuple[int, int, list[dict[str, Any]]]] = {}

    def resumo(self) -> dict[str, Any]:
        row = self._first_row("resumo", lambda item: str(item.get("escopo")) == "Todos")
        return self._summary_from_row(row)

    def categorias(self, page: int = 1, page_size: int = 100) -> dict[str, Any]:
        rows = self._read_aggregate("categorias")
        rows = self._sort_rows(rows, "valor_total")
        page_state = _page(page, page_size)
        items = self._paginate(rows, page_state)
        return self._collection_payload(self._summary_from_items(rows), items, rows, page_state)

    def deputados(
        self,
        ano: str | None = None,
        partido: str | None = None,
        uf: str | None = None,
        busca: str | None = None,
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 100,
    ) -> dict[str, Any]:
        rows = self._read_aggregate("deputados")
        selected_year = str(ano).strip() if ano else "Todos"
        rows = [row for row in rows if str(row.get("ano_dados")) == selected_year]
        if partido:
            rows = [row for row in rows if _same(row.get("sigla_partido"), partido)]
        if uf:
            rows = [row for row in rows if _same(row.get("sigla_uf"), uf)]
        if busca:
            rows = [
                row
                for row in rows
                if _contains(row.get("nome_parlamentar"), busca) or _same(row.get("id_deputado"), busca)
            ]
        rows = self._sort_rows(rows, "valor_total", reverse=(sort_dir == "desc"))
        page_state = _page(page, page_size)
        return self._collection_payload(self._summary_from_items(rows), self._paginate(rows, page_state), rows, page_state)

    def fornecedores(
        self,
        fornecedor: str | None = None,
        partido: str | None = None,
        uf: str | None = None,
        deputado: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> dict[str, Any]:
        rows = self._read_aggregate("fornecedores")
        if fornecedor:
            rows = [
                row
                for row in rows
                if _contains(row.get("fornecedor_normalizado"), fornecedor)
                or _contains(row.get("fornecedor_exemplo"), fornecedor)
                or _contains(row.get("variacoes_nome"), fornecedor)
            ]
        if partido:
            rows = [row for row in rows if _contains_token(row.get("partidos"), partido)]
        if uf:
            rows = [row for row in rows if _contains_token(row.get("ufs"), uf)]
        if deputado:
            rows = [row for row in rows if _contains_token(row.get("deputados"), deputado)]
        rows = self._sort_rows(rows, "valor_total")
        page_state = _page(page, page_size)
        items = [
            {
                "fornecedor": row.get("fornecedor_normalizado"),
                "fornecedor_exemplo": row.get("fornecedor_exemplo"),
                "valor_total": row.get("valor_total"),
                "qtd_despesas": row.get("qtd_despesas"),
                "qtd_deputados": row.get("qtd_deputados"),
                "ticket_medio": row.get("ticket_medio"),
                "pct_total": row.get("pct_total"),
                "categorias": row.get("categorias"),
                "ufs": row.get("ufs"),
                "partidos": row.get("partidos"),
            }
            for row in self._paginate(rows, page_state)
        ]
        return self._collection_payload(self._summary_from_items(rows), items, rows, page_state)

    def contexto(self) -> dict[str, Any]:
        partidos = self._sort_rows(self._read_aggregate("partidos"), "valor_total")
        ufs = self._sort_rows(self._read_aggregate("ufs"), "valor_total")
        return {
            "summary": {
                "qtd_partidos": len(partidos),
                "qtd_ufs": len(ufs),
                "valor_total": round(sum(float(row.get("valor_total") or 0) for row in partidos), 2),
            },
            "partidos": partidos,
            "ufs": ufs,
            "metadata": self._metadata({"fonte": ["gastos_por_partido.csv", "gastos_por_uf.csv"]}),
        }


    def _collection_payload(
        self,
        summary: dict[str, Any],
        items: list[dict[str, Any]],
        all_rows: list[dict[str, Any]],
        page_state: Page,
    ) -> dict[str, Any]:
        return {
            "summary": summary,
            "items": items,
            "metadata": self._metadata(
                {
                    "page": page_state.number,
                    "page_size": page_state.size,
                    "total": len(all_rows),
                }
            ),
        }

    def _summary_from_items(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        valor_total = round(sum(float(row.get("valor_total") or 0) for row in rows), 2)
        qtd_despesas = int(sum(float(row.get("qtd_despesas") or 0) for row in rows))
        return {
            "valor_total": valor_total,
            "qtd_despesas": qtd_despesas,
            "ticket_medio": round(valor_total / qtd_despesas, 2) if qtd_despesas else 0,
            "qtd_deputados": _distinct_count(rows, "id_deputado", "qtd_deputados"),
            "qtd_fornecedores": _distinct_count(rows, "fornecedor_normalizado", "qtd_fornecedores"),
        }

    def _summary_from_row(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "valor_total": row.get("valor_total", 0),
            "qtd_despesas": row.get("qtd_despesas", 0),
            "ticket_medio": row.get("ticket_medio", 0),
            "qtd_deputados": row.get("qtd_deputados", 0),
            "qtd_fornecedores": row.get("qtd_fornecedores", 0),
        }

    def _first_row(self, key: str, predicate) -> dict[str, Any]:
        for row in self._read_aggregate(key):
            if predicate(row):
                return row
        return {}

    def _read_aggregate(self, key: str) -> list[dict[str, Any]]:
        filename = AGGREGATE_FILES[key]
        path = self._path(filename)
        stat = path.stat()
        cache = self._cache.get(filename)
        if cache and cache[0] == stat.st_mtime_ns and cache[1] == stat.st_size:
            return cache[2]

        with path.open("r", encoding="utf-8", newline="") as handle:
            rows = [_coerce_row(row) for row in csv.DictReader(handle, delimiter=";")]
        self._cache[filename] = (stat.st_mtime_ns, stat.st_size, rows)
        return rows


    def _path(self, filename: str) -> Path:
        path = self.artifacts_dir / filename
        if not path.exists():
            raise FileNotFoundError(
                f"Arquivo analitico de gastos nao encontrado: {path}. Rode `make gastos-analytics`."
            )
        return path

    def _sort_rows(self, rows: list[dict[str, Any]], key: str, reverse: bool = True) -> list[dict[str, Any]]:
        return sorted(rows, key=lambda row: float(row.get(key) or 0), reverse=reverse)

    def _paginate(self, rows: list[dict[str, Any]], page_state: Page) -> list[dict[str, Any]]:
        start = (page_state.number - 1) * page_state.size
        return rows[start : start + page_state.size]

    def _metadata(self, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        metadata = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "artifacts_dir": str(self.artifacts_dir),
        }
        if extra:
            metadata.update(extra)
        return metadata


def _page(page: int, page_size: int, max_size: int = 500) -> Page:
    return Page(number=max(int(page or 1), 1), size=min(max(int(page_size or 100), 1), max_size))


def _coerce_row(row: dict[str, str]) -> dict[str, Any]:
    return {key: _coerce_value(value) for key, value in row.items()}


def _coerce_value(value: str | None) -> Any:
    if value is None:
        return None
    text = value.strip()
    if text == "":
        return ""
    lower = text.lower()
    if lower == "true":
        return True
    if lower == "false":
        return False
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


def _normalize(value: object) -> str:
    text = "" if value is None else str(value)
    normalized = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(text.upper().split())


def _same(value: object, expected: object) -> bool:
    return _normalize(value) == _normalize(expected)


def _contains(value: object, needle: object) -> bool:
    return _normalize(needle) in _normalize(value)


def _contains_token(value: object, expected: object) -> bool:
    tokens = [_normalize(token) for token in str(value or "").split("|")]
    return _normalize(expected) in tokens


def _distinct_count(rows: list[dict[str, Any]], identity_key: str, count_key: str) -> int:
    values = {row.get(identity_key) for row in rows if row.get(identity_key) not in (None, "")}
    if values:
        return len(values)
    return int(sum(float(row.get(count_key) or 0) for row in rows))
