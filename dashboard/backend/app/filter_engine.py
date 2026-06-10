from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .party_catalog import normalize_party


@dataclass(slots=True)
class FilterState:
    anos: list[str]
    eixos: list[str]
    partidos: list[str]
    ufs: list[str]
    deputados: list[str]
    escolaridade: list[str]
    search: str | None
    sort_by: str | None
    sort_dir: str
    page: int
    page_size: int


class FilterEngine:
    COLUMN_MAP = {
        "anos": ["ano_dados", "ano"],
        "eixos": ["tema", "tema_mais_atuante", "eixo_maior", "eixo_mais_atuante", "eixo_principal"],
        "partidos": ["sigla_partido"],
        "ufs": ["sigla_uf"],
        "deputados": ["id_deputado", "nome"],
        "escolaridade": ["escolaridade"],
    }

    @classmethod
    def apply_filters(
        cls,
        rows: list[dict[str, Any]],
        state: FilterState,
        supported_filters: list[str],
    ) -> list[dict[str, Any]]:
        filtered = rows
        if "anos" in supported_filters and state.anos:
            filtered = cls._filter_by_columns(filtered, cls.COLUMN_MAP["anos"], state.anos)
        if "eixos" in supported_filters and state.eixos:
            filtered = cls._filter_by_columns(filtered, cls.COLUMN_MAP["eixos"], state.eixos)
        if "partidos" in supported_filters and state.partidos:
            filtered = cls._filter_parties(filtered, state.partidos)
        if "ufs" in supported_filters and state.ufs:
            filtered = cls._filter_by_columns(filtered, cls.COLUMN_MAP["ufs"], state.ufs)
        if "deputados" in supported_filters and state.deputados:
            filtered = cls._filter_deputados(filtered, state.deputados)
        if "escolaridade" in supported_filters and state.escolaridade:
            filtered = cls._filter_by_columns(filtered, cls.COLUMN_MAP["escolaridade"], state.escolaridade)
        if state.search:
            filtered = cls._search(filtered, state.search)
        return filtered

    @staticmethod
    def apply_sort(
        rows: list[dict[str, Any]],
        sort_by: str | None,
        sort_dir: str,
    ) -> list[dict[str, Any]]:
        if not rows:
            return rows
        key = sort_by if sort_by in rows[0] else None
        if not key:
            return rows
        reverse = sort_dir.lower() != "asc"
        return sorted(rows, key=lambda row: _sortable_value(row.get(key)), reverse=reverse)

    @staticmethod
    def apply_pagination(
        rows: list[dict[str, Any]], page: int, page_size: int
    ) -> list[dict[str, Any]]:
        start = max(page - 1, 0) * page_size
        end = start + page_size
        return rows[start:end]

    @classmethod
    def _filter_by_columns(
        cls,
        rows: list[dict[str, Any]],
        columns: list[str],
        allowed_values: list[str],
    ) -> list[dict[str, Any]]:
        normalized = {value.strip().lower() for value in allowed_values if value.strip()}
        if not normalized:
            return rows
        if not any(any(column in row for column in columns) for row in rows):
            return rows
        output: list[dict[str, Any]] = []
        for row in rows:
            for column in columns:
                raw = row.get(column)
                if raw is None:
                    continue
                raw_str = str(raw).strip().lower()
                parts = {p.strip() for p in raw_str.split(",") if p.strip()}
                if parts & normalized:
                    output.append(row)
                    break
        return output

    @classmethod
    def _filter_parties(
        cls,
        rows: list[dict[str, Any]],
        allowed_values: list[str],
    ) -> list[dict[str, Any]]:
        normalized = {
            normalized_value
            for value in allowed_values
            if (normalized_value := normalize_party(value))
        }
        if not normalized:
            return rows
        if not any("sigla_partido" in row for row in rows):
            return rows
        output: list[dict[str, Any]] = []
        for row in rows:
            if normalize_party(row.get("sigla_partido")) in normalized:
                output.append(row)
        return output

    @classmethod
    def _filter_deputados(
        cls, rows: list[dict[str, Any]], allowed_values: list[str]
    ) -> list[dict[str, Any]]:
        normalized = {value.strip().lower() for value in allowed_values if value.strip()}
        if not normalized:
            return rows
        if not any(("id_deputado" in row) or ("nome" in row) for row in rows):
            return rows
        output: list[dict[str, Any]] = []
        for row in rows:
            dep_id = row.get("id_deputado")
            name = row.get("nome")
            candidates = {
                str(dep_id).strip().lower() if dep_id is not None else "",
                str(name).strip().lower() if name is not None else "",
            }
            if candidates & normalized:
                output.append(row)
        return output

    @staticmethod
    def _search(rows: list[dict[str, Any]], search: str) -> list[dict[str, Any]]:
        query = search.strip().lower()
        if not query:
            return rows
        output: list[dict[str, Any]] = []
        for row in rows:
            haystack = " ".join(
                str(value).lower()
                for value in row.values()
                if value is not None and not isinstance(value, (dict, list))
            )
            if query in haystack:
                output.append(row)
        return output


def _sortable_value(value: Any) -> Any:
    if value is None:
        return (1, "")
    if isinstance(value, (int, float)):
        return (0, value)
    return (0, str(value).lower())

