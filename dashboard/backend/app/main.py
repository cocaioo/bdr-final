from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return service.get_meta()


@app.get("/api/questions/{question_id}", response_model=QuestionPayload)
def get_question(
    question_id: str,
    anos: list[str] | None = Query(default=None),
    eixos: list[str] | None = Query(default=None),
    partidos: list[str] | None = Query(default=None),
    ufs: list[str] | None = Query(default=None),
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

    state = FilterState(
        anos=anos or [],
        eixos=eixos or [],
        partidos=partidos or [],
        ufs=ufs or [],
        deputados=deputados or [],
        escolaridade=escolaridade or [],
        search=search,
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
