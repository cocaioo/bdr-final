from __future__ import annotations

from dataclasses import dataclass, field
import json
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class QuestionGroupDefinition:
    id: str
    label: str
    description: str


@dataclass(slots=True)
class QuestionDefinition:
    id: str
    title: str
    description: str
    response_files: list[str]
    sql_file: str
    chart_type: str
    supported_filters: list[str]
    expected_columns: list[str]
    main_table_contains: str
    summary_table_contains: str
    explanation: str
    chart: dict[str, Any]
    group_id: str | None = None
    tags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class QuestionRegistry:
    legend: dict[str, Any]
    questions: list[QuestionDefinition]
    groups: list[QuestionGroupDefinition] = field(default_factory=list)

    def by_id(self, question_id: str) -> QuestionDefinition | None:
        for question in self.questions:
            if question.id == question_id:
                return question
        return None


def load_registry(path: Path) -> QuestionRegistry:
    raw = json.loads(path.read_text(encoding="utf-8"))
    groups = [
        QuestionGroupDefinition(
            id=item["id"],
            label=item["label"],
            description=item.get("description", ""),
        )
        for item in raw.get("groups", [])
    ]
    questions = [
        QuestionDefinition(
            id=item["id"],
            title=item["title"],
            description=item["description"],
            response_files=item["response_files"],
            sql_file=item["sql_file"],
            chart_type=item["chart_type"],
            supported_filters=item["supported_filters"],
            expected_columns=item.get("expected_columns", []),
            main_table_contains=item.get("main_table_contains", ""),
            summary_table_contains=item.get("summary_table_contains", ""),
            explanation=item["explanation"],
            chart=item.get("chart", {}),
            group_id=item.get("group_id"),
            tags=item.get("tags", []),
        )
        for item in raw["questions"]
    ]
    return QuestionRegistry(legend=raw.get("legend", {}), questions=questions, groups=groups)

