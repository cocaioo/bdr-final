from __future__ import annotations

from .base import AdapterContext, QuestionAdapter
from .questions import ADAPTERS_BY_ID


def build_adapter(context: AdapterContext) -> QuestionAdapter:
    adapter_cls = ADAPTERS_BY_ID.get(context.question.id, QuestionAdapter)
    return adapter_cls(context)

