from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

from .adapters import build_adapter
from .adapters.base import AdapterContext
from .cache import MemoryCache
from .config import REGISTRY_PATH, RESPONSES_DIR, SQL_DIR
from .filter_engine import FilterState
from .models import FilterCatalog, FilterChoice, MetaResponse, QuestionMeta, QuestionPayload
from .parser import ParsedDocument, parse_psql_file, read_text_with_fallback
from .registry import QuestionDefinition, QuestionRegistry, load_registry


@dataclass(slots=True)
class DataBundle:
    question: QuestionDefinition
    documents: list[ParsedDocument]
    sql_text: str
    sql_path: str


class DashboardService:
    def __init__(self) -> None:
        self.registry: QuestionRegistry = load_registry(REGISTRY_PATH)
        self.cache = MemoryCache(ttl_seconds=300)

    def get_meta(self) -> MetaResponse:
        version = self.get_dataset_version()
        cache_key = f"meta:{version}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        questions = [
            QuestionMeta(
                id=question.id,
                title=question.title,
                route=f"/q/{question.id}",
                description=question.description,
                chart_type=question.chart_type,
                supported_filters=question.supported_filters,
            )
            for question in self.registry.questions
        ]

        available = self._collect_global_filters()
        response = MetaResponse(
            dataset_version=version,
            last_updated=datetime.now(timezone.utc).isoformat(),
            questions=questions,
            legend=self.registry.legend,
            available_filters=available,
        )
        self.cache.set(cache_key, response)
        return response

    def get_question_payload(self, question_id: str, state: FilterState) -> QuestionPayload:
        question = self.registry.by_id(question_id)
        if question is None:
            raise KeyError(f"Pergunta '{question_id}' nao encontrada")

        version = self.get_dataset_version()
        state_key = self._state_cache_key(state)
        cache_key = f"question:{version}:{question_id}:{state_key}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        bundle = self._load_question_bundle(question)
        adapter = build_adapter(
            AdapterContext(
                question=question,
                documents=bundle.documents,
                sql_text=bundle.sql_text,
                sql_path=bundle.sql_path,
                dataset_version=version,
            )
        )
        payload = adapter.build_payload(state)
        self.cache.set(cache_key, payload)
        return payload

    def get_dataset_version(self) -> str:
        hash_builder = hashlib.sha256()
        for question in self.registry.questions:
            for response_name in question.response_files:
                response_path = RESPONSES_DIR / response_name
                _update_hash_with_file(hash_builder, response_path)
            sql_path = SQL_DIR / question.sql_file
            _update_hash_with_file(hash_builder, sql_path)
        digest = hash_builder.hexdigest()
        return digest[:16]

    def _load_question_bundle(self, question: QuestionDefinition) -> DataBundle:
        docs: list[ParsedDocument] = []
        for file_name in question.response_files:
            file_path = RESPONSES_DIR / file_name
            if not file_path.exists():
                docs.append(
                    ParsedDocument(
                        title=f"Arquivo ausente: {file_name}",
                        tables=[],
                    )
                )
                continue
            docs.append(parse_psql_file(file_path))

        sql_path = SQL_DIR / question.sql_file
        sql_text = read_text_with_fallback(sql_path) if sql_path.exists() else "-- SQL nao encontrado"

        return DataBundle(
            question=question,
            documents=docs,
            sql_text=sql_text,
            sql_path=str(sql_path.relative_to(SQL_DIR.parent.parent)),
        )

    def _collect_global_filters(self) -> FilterCatalog:
        cache_key = f"filters:{self.get_dataset_version()}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        anos: set[str] = set()
        partidos: set[str] = set()
        ufs: set[str] = set()
        deputados: set[str] = set()

        for question in self.registry.questions:
            bundle = self._load_question_bundle(question)
            for doc in bundle.documents:
                for table in doc.tables:
                    for row in table.rows:
                        _maybe_add(anos, row.get("ano_dados"))
                        _maybe_add(anos, row.get("ano"))
                        _maybe_add(partidos, row.get("sigla_partido"))
                        _maybe_add(ufs, row.get("sigla_uf"))
                        _maybe_add(deputados, row.get("nome"))
                        _maybe_add(deputados, row.get("id_deputado"))

        catalog = FilterCatalog(
            anos=[FilterChoice(value=item, label=item) for item in sorted(anos)],
            partidos=[FilterChoice(value=item, label=item) for item in sorted(partidos)],
            ufs=[FilterChoice(value=item, label=item) for item in sorted(ufs)],
            deputados=[FilterChoice(value=item, label=item) for item in sorted(deputados)],
        )
        self.cache.set(cache_key, catalog)
        return catalog

    @staticmethod
    def _state_cache_key(state: FilterState) -> str:
        serializable = {
            "anos": sorted(state.anos),
            "partidos": sorted(state.partidos),
            "ufs": sorted(state.ufs),
            "deputados": sorted(state.deputados),
            "search": state.search or "",
            "sort_by": state.sort_by or "",
            "sort_dir": state.sort_dir,
            "page": state.page,
            "page_size": state.page_size,
        }
        return hashlib.md5(
            json.dumps(serializable, sort_keys=True).encode("utf-8"),
            usedforsecurity=False,
        ).hexdigest()


def _update_hash_with_file(hash_builder: hashlib._Hash, path: Path) -> None:
    hash_builder.update(str(path).encode("utf-8"))
    if not path.exists():
        hash_builder.update(b"missing")
        return
    hash_builder.update(str(path.stat().st_mtime_ns).encode("utf-8"))
    with path.open("rb") as file:
        while True:
            chunk = file.read(1024 * 64)
            if not chunk:
                break
            hash_builder.update(chunk)


def _maybe_add(container: set[str], value: Any) -> None:
    if value is None:
        return
    text = str(value).strip()
    if text:
        container.add(text)

