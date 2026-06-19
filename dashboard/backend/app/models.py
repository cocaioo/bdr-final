from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FilterChoice(BaseModel):
    value: str
    label: str
    status: str | None = None


class FilterCatalog(BaseModel):
    anos: list[FilterChoice] = Field(default_factory=list)
    eixos: list[FilterChoice] = Field(default_factory=list)
    partidos: list[FilterChoice] = Field(default_factory=list)
    ufs: list[FilterChoice] = Field(default_factory=list)
    deputados: list[FilterChoice] = Field(default_factory=list)
    escolaridade: list[FilterChoice] = Field(default_factory=list)


class QuestionGroup(BaseModel):
    id: str
    label: str
    description: str | None = None


class QuestionMeta(BaseModel):
    id: str
    title: str
    route: str
    description: str
    chart_type: str
    supported_filters: list[str]
    group_id: str | None = None
    tags: list[str] = Field(default_factory=list)


class MetaResponse(BaseModel):
    dataset_version: str
    last_updated: str
    questions: list[QuestionMeta]
    legend: dict[str, Any]
    available_filters: FilterCatalog
    question_filters: dict[str, FilterCatalog] = Field(default_factory=dict)
    groups: list[QuestionGroup] = Field(default_factory=list)


class SummaryCard(BaseModel):
    id: str
    label: str
    value: str
    unit: str | None = None


class ChartSpec(BaseModel):
    type: str
    title: str
    description: str
    x_field: str | None = None
    y_fields: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    series: list[dict[str, Any]] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)


class TableColumn(BaseModel):
    key: str
    label: str
    numeric: bool = False


class TableSpec(BaseModel):
    title: str
    columns: list[TableColumn]
    rows: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    sort_by: str | None = None
    sort_dir: str = "desc"


class QueryPanel(BaseModel):
    sql_path: str
    sql_text: str
    explanation: str


class WarningItem(BaseModel):
    code: str
    message: str


class EmptyState(BaseModel):
    is_empty: bool
    message: str


class QuestionPayload(BaseModel):
    question_id: str
    title: str
    description: str
    filters_supported: list[str]
    filters_applied: dict[str, Any]
    summary_cards: list[SummaryCard]
    chart_spec: ChartSpec
    table_spec: TableSpec
    complement_tables: list[TableSpec]
    query_panel: QueryPanel
    warnings: list[WarningItem]
    empty_state: EmptyState
    dataset_version: str
    generated_at: str

