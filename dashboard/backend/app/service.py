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
from .config import REPO_ROOT, REGISTRY_PATH, RESPONSES_DIR, SQL_DIR
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
    def __init__(
        self,
        registry_path: Path = REGISTRY_PATH,
        responses_dir: Path = RESPONSES_DIR,
        sql_dir: Path = SQL_DIR,
        repo_root: Path = REPO_ROOT,
    ) -> None:
        self.registry_path = registry_path
        self.responses_dir = responses_dir
        self.sql_dir = sql_dir
        self.repo_root = repo_root
        self.registry: QuestionRegistry = load_registry(self.registry_path)
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
                response_path = self._resolve_response_path(response_name, allow_missing=True)
                if response_path is not None:
                    _update_hash_with_file(hash_builder, response_path)
                else:
                    hash_builder.update(response_name.encode("utf-8"))
                    hash_builder.update(b"missing")
            sql_path = self.sql_dir / question.sql_file
            _update_hash_with_file(hash_builder, sql_path)
        digest = hash_builder.hexdigest()
        return digest[:16]

    def _load_question_bundle(self, question: QuestionDefinition) -> DataBundle:
        docs: list[ParsedDocument] = []
        for file_name in question.response_files:
            file_path = self._resolve_response_path(file_name)
            docs.append(parse_psql_file(file_path))

        sql_path = self.sql_dir / question.sql_file
        sql_text = read_text_with_fallback(sql_path) if sql_path.exists() else "-- SQL nao encontrado"

        return DataBundle(
            question=question,
            documents=docs,
            sql_text=sql_text,
            sql_path=_relative_path(sql_path, self.repo_root),
        )

    def _collect_global_filters(self) -> FilterCatalog:
        cache_key = f"filters:{self.get_dataset_version()}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        anos: set[str] = set()
        partidos: set[str] = set()
        eixos: set[str] = set()
        ufs: set[str] = set()
        deputados: set[str] = set()

        for question in self.registry.questions:
            try:
                bundle = self._load_question_bundle(question)
            except FileNotFoundError:
                continue
            for doc in bundle.documents:
                for table in doc.tables:
                    for row in table.rows:
                        _maybe_add(anos, row.get("ano_dados"), excluded={"GLOBAL"})
                        _maybe_add(anos, row.get("ano"), excluded={"GLOBAL"})
                        _maybe_add(eixos, row.get("eixo_maior"))
                        _maybe_add(eixos, row.get("eixo_mais_atuante"))
                        _maybe_add(partidos, row.get("sigla_partido"))
                        _maybe_add(ufs, row.get("sigla_uf"))
                        _maybe_add(deputados, row.get("nome") or row.get("id_deputado"))

        catalog = FilterCatalog(
            anos=[FilterChoice(value=item, label=item) for item in sorted(anos)],
            eixos=[FilterChoice(value=item, label=item) for item in sorted(eixos)],
            partidos=[FilterChoice(value=item, label=item) for item in sorted(partidos)],
            ufs=[FilterChoice(value=item, label=item) for item in sorted(ufs)],
            deputados=[FilterChoice(value=item, label=item) for item in sorted(deputados)],
        )
        self.cache.set(cache_key, catalog)
        return catalog

    def _resolve_response_path(
        self,
        response_ref: str,
        allow_missing: bool = False,
    ) -> Path | None:
        requested = Path(response_ref)
        candidates: list[Path] = []

        if requested.is_absolute():
            candidates.append(requested)
        else:
            candidates.append((self.repo_root / requested).resolve())
            candidates.append((self.responses_dir / requested).resolve())
            if requested.name != response_ref:
                candidates.append((self.responses_dir / requested.name).resolve())
                candidates.append((self.repo_root / requested.name).resolve())

        if not requested.is_absolute() and requested.name:
            for candidate in self._search_repo_for_filename(requested.name):
                candidates.append(candidate)

        unique_candidates: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            candidate_key = str(candidate)
            if candidate_key in seen:
                continue
            seen.add(candidate_key)
            unique_candidates.append(candidate)

        for candidate in unique_candidates:
            if candidate.exists():
                return candidate

        if allow_missing:
            return None

        attempted = " | ".join(str(candidate) for candidate in unique_candidates)
        raise FileNotFoundError(
            f"Arquivo de resposta nao encontrado para '{response_ref}'. Caminhos tentados: {attempted}"
        )

    def _search_repo_for_filename(self, filename: str) -> list[Path]:
        matches: list[Path] = []
        for candidate in self.repo_root.rglob(filename):
            if candidate.is_file():
                matches.append(candidate.resolve())

        def sort_key(path: Path) -> tuple[int, int, str]:
            parts = path.parts
            legacy_penalty = 1 if self.responses_dir.name in parts else 0
            return (legacy_penalty, len(parts), str(path).lower())

        return sorted(matches, key=sort_key)

    @staticmethod
    def _state_cache_key(state: FilterState) -> str:
        serializable = {
            "anos": sorted(state.anos),
            "eixos": sorted(state.eixos),
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


def _maybe_add(container: set[str], value: Any, excluded: set[str] | None = None) -> None:
    if value is None:
        return
    text = str(value).strip()
    if excluded and text.upper() in excluded:
        return
    if text:
        container.add(text)


def _relative_path(path: Path, base_dir: Path) -> str:
    try:
        return str(path.relative_to(base_dir))
    except ValueError:
        return str(path)

