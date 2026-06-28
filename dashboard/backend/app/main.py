from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .filter_engine import FilterState
from .models import MetaResponse, QuestionPayload
from .service import DashboardService

logger = logging.getLogger(__name__)

service = DashboardService()


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Warm cache in background thread — server starts immediately
    async def _warm_cache():
        try:
            await asyncio.to_thread(service.get_meta)
            logger.info("Cache warmed successfully.")
        except Exception:
            logger.warning("Cache warmup failed — first request will be slower.", exc_info=True)

    warmup_task = asyncio.create_task(_warm_cache())
    yield
    warmup_task.cancel()


app = FastAPI(
    title="BDR Dashboard API",
    version="1.0.0",
    description="API adapter para respostas Q1-Q13 com filtros, tabela e especificacao de grafico.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DASHBOARD_DIR = Path(__file__).resolve().parents[2]
_STATIC_DIR = _DASHBOARD_DIR / "frontend" / "dist"
_STATIC_INDEX = _STATIC_DIR / "index.html"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return service.get_meta()


@app.get("/api/questions/{question_id}", response_model=QuestionPayload)
def get_question(
    question_id: str,
    ano: str | None = None,
    anos: list[str] | None = Query(default=None),
    ano_dados: list[str] | None = Query(default=None),
    nome: str | None = None,
    eixos: list[str] | None = Query(default=None),
    partidos: list[str] | None = Query(default=None),
    partido: str | None = None,
    ufs: list[str] | None = Query(default=None),
    estado: str | None = None,
    deputados: list[str] | None = Query(default=None),
    escolaridade: list[str] | None = Query(default=None),
    search: str | None = None,
    sort_by: str | None = None,
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 50,
) -> QuestionPayload:
    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 200)
    safe_sort = "asc" if sort_dir.lower() == "asc" else "desc"
    selected_years = (anos or []) + (ano_dados or []) + ([ano] if ano else [])
    selected_ufs = (ufs or []) + ([estado] if estado else [])
    selected_partidos = (partidos or []) + ([partido] if partido else [])
    normalized_search = nome if nome is not None else search

    state = FilterState(
        anos=selected_years,
        eixos=eixos or [],
        partidos=selected_partidos,
        ufs=selected_ufs,
        deputados=deputados or [],
        escolaridade=escolaridade or [],
        search=normalized_search,
        sort_by=sort_by,
        sort_dir=safe_sort,
        page=safe_page,
        page_size=safe_page_size,
    )
    try:
        return service.get_question_payload(question_id=question_id, state=state)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/gastos/resumo")
def get_gastos_resumo() -> dict:
    try:
        return service.gastos.resumo()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/gastos/categorias")
def get_gastos_categorias(page: int = 1, page_size: int = 100) -> dict:
    try:
        return service.gastos.categorias(page=page, page_size=page_size)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/gastos/deputados")
def get_gastos_deputados(
    ano: str | None = None,
    partido: str | None = None,
    uf: str | None = None,
    busca: str | None = None,
    page: int = 1,
    page_size: int = 100,
) -> dict:
    try:
        return service.gastos.deputados(
            ano=ano,
            partido=partido,
            uf=uf,
            busca=busca,
            page=page,
            page_size=page_size,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/gastos/fornecedores")
def get_gastos_fornecedores(
    categoria: str | None = None,
    partido: str | None = None,
    uf: str | None = None,
    deputado: str | None = None,
    page: int = 1,
    page_size: int = 100,
) -> dict:
    try:
        return service.gastos.fornecedores(
            categoria=categoria,
            partido=partido,
            uf=uf,
            deputado=deputado,
            page=page,
            page_size=page_size,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/gastos/contexto")
def get_gastos_contexto() -> dict:
    try:
        return service.gastos.contexto()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/deputados/{id_deputado}/temas-nuvem")
def get_deputado_temas_nuvem(id_deputado: str) -> dict:
    try:
        return service.tema_nuvem.temas_nuvem(id_deputado=id_deputado)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# Keep these routes after every API route: Starlette resolves the first match.
# In local development Vite runs separately, so no routes are added until a
# frontend build exists.
if _STATIC_INDEX.is_file():
    _assets_dir = _STATIC_DIR / "assets"
    if _assets_dir.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_assets_dir)),
            name="assets",
        )

    @app.get("/", include_in_schema=False)
    def serve_spa_root() -> FileResponse:
        return FileResponse(_STATIC_INDEX)

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        # Unknown API paths must remain API 404s instead of returning HTML.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        requested_file = (_STATIC_DIR / full_path).resolve()
        try:
            requested_file.relative_to(_STATIC_DIR.resolve())
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Not Found") from exc

        # Vite copies public/ files to the dist root. Serve those files as-is;
        # all remaining paths fall back to React Router's entry point.
        if requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(_STATIC_INDEX)
