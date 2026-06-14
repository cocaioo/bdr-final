from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import time
from typing import Any

from .adapters import build_adapter
from .adapters.base import AdapterContext
from .cache import MemoryCache
from .config import REPO_ROOT, REGISTRY_PATH, RESPONSES_DIR, SQL_DIR
from .filter_engine import FilterState
from .gastos_service import GastosAnalyticsService
from .models import FilterCatalog, FilterChoice, MetaResponse, QuestionGroup, QuestionMeta, QuestionPayload
from .party_catalog import active_party_entries, normalize_party, PARTY_CATALOG_RELATIVE_PATH
from .parser import ParsedDocument, parse_data_file, read_text_with_fallback
from .registry import QuestionDefinition, QuestionRegistry, load_registry


@dataclass(slots=True)
class DataBundle:
    question: QuestionDefinition
    documents: list[ParsedDocument]
    sql_text: str
    sql_path: str


_EXCLUDED_DIRS = frozenset({
    "venv", ".venv", ".git", "node_modules", "__pycache__",
    ".pytest_cache", "dist", ".tox", ".mypy_cache",
})


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
        self.gastos = GastosAnalyticsService(repo_root=self.repo_root)
        self._version_cache: tuple[float, str] | None = None
        self._version_cache_ttl = 60.0
        self._document_cache: dict[tuple[str, int, int], ParsedDocument] = {}
        self._bundle_cache: dict[tuple[str, str], DataBundle] = {}

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
                group_id=question.group_id,
                tags=question.tags,
            )
            for question in self.registry.questions
        ]

        groups = [
            QuestionGroup(
                id=group.id,
                label=group.label,
                description=group.description,
            )
            for group in self.registry.groups
        ]

        available = self._collect_global_filters()
        response = MetaResponse(
            dataset_version=version,
            last_updated=datetime.now(timezone.utc).isoformat(),
            questions=questions,
            legend=self.registry.legend,
            available_filters=available,
            question_filters=self._collect_question_filters(),
            groups=groups,
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

        bundle = self._load_question_bundle(question, state)
        adapter = build_adapter(
            AdapterContext(
                question=question,
                documents=bundle.documents,
                sql_text=bundle.sql_text,
                sql_path=bundle.sql_path,
                dataset_version=version,
                repo_root=self.repo_root,
            )
        )
        payload = adapter.build_payload(state)
        self.cache.set(cache_key, payload)
        return payload

    def get_dataset_version(self) -> str:
        now = time.monotonic()
        if self._version_cache is not None:
            cached_time, cached_version = self._version_cache
            if now - cached_time < self._version_cache_ttl:
                return cached_version

        hash_builder = hashlib.sha256()
        _update_hash_with_file(hash_builder, self.registry_path)
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
        _update_hash_with_file(hash_builder, self.repo_root / PARTY_CATALOG_RELATIVE_PATH)
        digest = hash_builder.hexdigest()[:16]
        self._version_cache = (now, digest)
        return digest

    def _load_question_bundle(
        self,
        question: QuestionDefinition,
        state: FilterState | None = None,
    ) -> DataBundle:
        version = self.get_dataset_version()
        bundle_variant = self._bundle_variant(question, state)
        cache_key = (f"{question.id}:{bundle_variant}", version)
        cached = self._bundle_cache.get(cache_key)
        if cached is not None:
            return cached

        docs: list[ParsedDocument] = []
        for file_name in self._response_files_for_state(question, state):
            file_path = self._resolve_response_path(file_name)
            docs.append(self._parse_document(file_path))

        sql_path = self.sql_dir / question.sql_file
        if not sql_path.exists():
            candidates = self._search_repo_for_filename(question.sql_file)
            if candidates:
                sql_path = candidates[0]
        sql_text = read_text_with_fallback(sql_path) if sql_path.exists() else "-- SQL nao encontrado"

        bundle = DataBundle(
            question=question,
            documents=docs,
            sql_text=sql_text,
            sql_path=_relative_path(sql_path, self.repo_root),
        )
        self._bundle_cache[cache_key] = bundle
        return bundle

    def _response_files_for_state(
        self,
        question: QuestionDefinition,
        state: FilterState | None,
    ) -> list[str]:
        if question.id != "q3" or state is None or state.deputados:
            return question.response_files

        resumo_files = [
            file_name
            for file_name in question.response_files
            if Path(file_name).name == "q3_resumos_agregados.csv"
        ]
        return resumo_files or question.response_files

    @staticmethod
    def _bundle_variant(question: QuestionDefinition, state: FilterState | None) -> str:
        if question.id == "q3" and state is not None and not state.deputados:
            return "sem_deputado"
        return "completo"

    def _parse_document(self, path: Path) -> ParsedDocument:
        stat = path.stat()
        cache_key = (str(path.resolve()), stat.st_mtime_ns, stat.st_size)
        cached = self._document_cache.get(cache_key)
        if cached is not None:
            return cached
        parsed = parse_data_file(path)
        self._document_cache[cache_key] = parsed
        return parsed

    def _collect_global_filters(self) -> FilterCatalog:
        cache_key = f"filters:{self.get_dataset_version()}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        anos: set[str] = set()
        partidos_observed: set[str] = set()
        eixos: set[str] = set()
        ufs: set[str] = set()
        deputados: set[str] = set()
        escolaridades: set[str] = set()

        for question in self.registry.questions:
            try:
                docs = self._load_filter_documents(question)
            except FileNotFoundError:
                continue
            for doc in docs:
                for table in doc.tables:
                    for row in table.rows:
                        _maybe_add(anos, row.get("ano_dados"), excluded={"GLOBAL"})
                        _maybe_add(anos, row.get("ano"), excluded={"GLOBAL"})
                        _maybe_add(eixos, row.get("tema"))
                        _maybe_add(eixos, row.get("tema_mais_atuante"))
                        _maybe_add(eixos, row.get("tema_mais_atuante_deputado"))
                        _maybe_add(eixos, row.get("eixo_maior"))
                        _maybe_add(eixos, row.get("eixo_mais_atuante"))
                        _maybe_add(eixos, row.get("eixo_principal"))
                        _maybe_add_party(partidos_observed, row.get("sigla_partido"))
                        _maybe_add(ufs, row.get("sigla_uf"))
                        _maybe_add(deputados, row.get("nome") or row.get("id_deputado"))
                        _maybe_add(escolaridades, row.get("escolaridade"))

        active_parties = active_party_entries(self.repo_root)
        if active_parties:
            party_choices = [
                FilterChoice(value=entry.sigla, label=entry.sigla, status=entry.status)
                for entry in active_parties
            ]
        else:
            party_choices = [
                FilterChoice(value=item, label=item, status="sem_catalogo")
                for item in sorted(partidos_observed)
            ]

        catalog = FilterCatalog(
            anos=[FilterChoice(value=item, label=item) for item in sorted(anos)],
            eixos=[FilterChoice(value=item, label=item) for item in sorted(eixos)],
            partidos=party_choices,
            ufs=[FilterChoice(value=item, label=item) for item in sorted(ufs)],
            deputados=[FilterChoice(value=item, label=item) for item in sorted(deputados)],
            escolaridade=[FilterChoice(value=item, label=item) for item in sorted(escolaridades)],
        )
        self.cache.set(cache_key, catalog)
        return catalog

    def _collect_question_filters(self) -> dict[str, FilterCatalog]:
        q3 = self.registry.by_id("q3")
        if q3 is None:
            return {}

        try:
            docs = self._load_filter_documents(q3)
        except FileNotFoundError:
            return {}

        rows = [
            row
            for doc in docs
            for table in doc.tables
            for row in table.rows
            if "eixo_principal" in row and "id_deputado" in row and "nome" in row
        ]
        if not rows:
            return {}

        deputy_names = self._load_deputy_public_names()
        anos = {str(row.get("ano_dados")).strip() for row in rows if row.get("ano_dados") not in (None, "")}
        eixos = {str(row.get("eixo_principal")).strip() for row in rows if row.get("eixo_principal")}
        deputy_ids: dict[str, str] = {}
        for row in rows:
            dep_id = str(row.get("id_deputado") or "").strip()
            name = str(row.get("nome") or "").strip()
            if dep_id and name:
                deputy_ids.setdefault(dep_id, deputy_names.get(dep_id, name))

        q3_catalog = FilterCatalog(
            anos=[FilterChoice(value=item, label=item) for item in _sort_filter_values(anos)],
            eixos=[FilterChoice(value=item, label=item) for item in _sort_filter_values(eixos)],
            partidos=[],
            ufs=[],
            deputados=[
                FilterChoice(value=dep_id, label=label)
                for dep_id, label in sorted(deputy_ids.items(), key=lambda item: item[1].lower())
            ],
            escolaridade=[],
        )
        return {"q3": q3_catalog}

    def _load_deputy_public_names(self) -> dict[str, str]:
        path = self.repo_root / "dados_padronizados" / "deputados.csv"
        if not path.exists():
            return {}

        names: dict[str, str] = {}
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=";")
            for row in reader:
                dep_id = str(row.get("id_deputado") or "").strip()
                name = str(row.get("nome") or "").strip()
                if dep_id and name:
                    names[dep_id] = name
        return names

    def _load_filter_documents(self, question: QuestionDefinition) -> list[ParsedDocument]:
        if question.id != "q3":
            return self._load_question_bundle(question).documents

        docs: list[ParsedDocument] = []
        for file_name in question.response_files:
            if Path(file_name).name != "q3_resumos_agregados.csv":
                continue
            file_path = self._resolve_response_path(file_name)
            docs.append(self._parse_document(file_path))
        return docs or self._load_question_bundle(question).documents

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

        # Try direct candidates first (fast — no directory traversal)
        seen: set[str] = set()
        for candidate in candidates:
            key = str(candidate)
            if key in seen:
                continue
            seen.add(key)
            if candidate.exists():
                return candidate

        # Only fall back to rglob if no direct candidate was found
        if not requested.is_absolute() and requested.name:
            for candidate in self._search_repo_for_filename(requested.name):
                if candidate.exists():
                    return candidate

        if allow_missing:
            return None

        unique = [c for c in candidates if str(c) in seen]
        attempted = " | ".join(str(c) for c in unique)
        raise FileNotFoundError(
            f"Arquivo de resposta nao encontrado para '{response_ref}'. Caminhos tentados: {attempted}"
        )

    def _search_repo_for_filename(self, filename: str) -> list[Path]:
        matches: list[Path] = []
        for root, dirs, files in os.walk(self.repo_root):
            # Prune excluded directories in-place to avoid entering them
            dirs[:] = [d for d in dirs if d not in _EXCLUDED_DIRS]
            if filename in files:
                matches.append((Path(root) / filename).resolve())

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
            "escolaridade": sorted(state.escolaridade),
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
    stat = path.stat()
    hash_builder.update(str(stat.st_mtime_ns).encode("utf-8"))
    hash_builder.update(str(stat.st_size).encode("utf-8"))


def _maybe_add(container: set[str], value: Any, excluded: set[str] | None = None) -> None:
    if value is None:
        return
    text = str(value).strip()
    if excluded and text.upper() in excluded:
        return
    if text:
        if "," in text:
            for part in text.split(","):
                _maybe_add(container, part.strip(), excluded)
        else:
            container.add(text)


def _maybe_add_party(container: set[str], value: Any) -> None:
    normalized = normalize_party(value)
    if normalized:
        container.add(normalized)


def _sort_filter_values(values: set[str]) -> list[str]:
    def key(value: str) -> tuple[int, int | str]:
        try:
            return (0, int(value))
        except ValueError:
            return (1, value.lower())

    return sorted(values, key=key)


def _relative_path(path: Path, base_dir: Path) -> str:
    try:
        return str(path.relative_to(base_dir))
    except ValueError:
        return str(path)

