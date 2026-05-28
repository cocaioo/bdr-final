from __future__ import annotations

from typing import Any

from .base import QuestionAdapter
from ..filter_engine import FilterState
from ..models import ChartSpec, TableSpec


class Q1Adapter(QuestionAdapter):
    """Gastos por deputado."""


class Q2Adapter(QuestionAdapter):
    """Eixos e nuvem de palavras."""

    def build_chart_spec(self, rows: list[dict[str, Any]]) -> ChartSpec:
        images = [
            {
                "year": year,
                "src": f"/wordclouds/q2_nuvem_palavras_{year}.png",
                "alt": f"Nuvem de palavras dos eixos tematicos em {year}",
            }
            for year in (2023, 2024, 2025, 2026)
        ]
        return ChartSpec(
            type="wordcloud_images",
            title="Nuvens de eixos por ano",
            description=(
                "Imagens PNG geradas com os eixos tematicos como termos e peso proporcional "
                "a quantidade de proposicoes."
            ),
            series=[],
            options={"images": images},
        )

    def _build_complements(self, state: FilterState) -> list[TableSpec]:
        return []


class Q3Adapter(QuestionAdapter):
    """Votos por eixo."""


class Q4Adapter(QuestionAdapter):
    """Escolaridade de deputados ativos."""


class Q5Adapter(QuestionAdapter):
    """Fornecedores com maior total pago."""


class Q6Adapter(QuestionAdapter):
    """Correlacoes por escolaridade."""


class Q7Adapter(QuestionAdapter):
    """Indice custo-beneficio."""


class Q8Adapter(QuestionAdapter):
    """Influencia legislativa."""


class Q9Adapter(QuestionAdapter):
    """Vies ideologico e partidario."""


class Q10Adapter(QuestionAdapter):
    """Alinhamento interno de partidos."""


class Q11Adapter(QuestionAdapter):
    """Rankings partidarios."""


class Q12Adapter(QuestionAdapter):
    """Deputado x fornecedor."""


class Q13Adapter(QuestionAdapter):
    """Categorias de gasto por deputado."""


ADAPTERS_BY_ID = {
    "q1": Q1Adapter,
    "q2": Q2Adapter,
    "q3": Q3Adapter,
    "q4": Q4Adapter,
    "q5": Q5Adapter,
    "q6": Q6Adapter,
    "q7": Q7Adapter,
    "q8": Q8Adapter,
    "q9": Q9Adapter,
    "q10": Q10Adapter,
    "q11": Q11Adapter,
    "q12": Q12Adapter,
    "q13": Q13Adapter,
}

