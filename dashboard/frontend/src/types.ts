export interface FilterChoice {
  value: string
  label: string
  status?: string | null
}

export interface FilterCatalog {
  anos: FilterChoice[]
  eixos: FilterChoice[]
  partidos: FilterChoice[]
  ufs: FilterChoice[]
  deputados: FilterChoice[]
  escolaridade: FilterChoice[]
}

export interface QuestionGroup {
  id: string
  label: string
  description?: string
}

export interface QuestionMeta {
  id: string
  title: string
  route: string
  description: string
  chart_type: string
  supported_filters: string[]
  group_id?: string
  tags?: string[]
}

export interface DeputyCatalogItem {
  id_deputado: string
  nome: string
  nome_civil?: string
  escolaridade?: string
}

export interface MetaResponse {
  dataset_version: string
  last_updated: string
  questions: QuestionMeta[]
  legend: Record<string, unknown>
  available_filters: FilterCatalog
  question_filters?: Record<string, FilterCatalog>
  groups?: QuestionGroup[]
}

export interface SummaryCard {
  id: string
  label: string
  value: string
  unit?: string | null
}

export interface ChartSpec {
  type: string
  title: string
  description: string
  x_field?: string | null
  y_fields: string[]
  categories: string[]
  series: Array<Record<string, unknown>>
  options: Record<string, unknown>
}

export interface TableColumn {
  key: string
  label: string
  numeric: boolean
}

export interface TableSpec {
  title: string
  columns: TableColumn[]
  rows: Array<Record<string, unknown>>
  total: number
  page: number
  page_size: number
  sort_by?: string | null
  sort_dir: 'asc' | 'desc'
}

export interface QueryPanel {
  sql_path: string
  sql_text: string
  explanation: string
}

export interface WarningItem {
  code: string
  message: string
}

export interface EmptyState {
  is_empty: boolean
  message: string
}

export interface QuestionPayload {
  question_id: string
  title: string
  description: string
  filters_supported: string[]
  filters_applied: Record<string, unknown>
  summary_cards: SummaryCard[]
  chart_spec: ChartSpec
  table_spec: TableSpec
  complement_tables: TableSpec[]
  query_panel: QueryPanel
  warnings: WarningItem[]
  empty_state: EmptyState
  dataset_version: string
  generated_at: string
}

export interface FilterState {
  anos: string[]
  eixos: string[]
  partidos: string[]
  ufs: string[]
  deputados: string[]
  escolaridade: string[]
  search: string
}

export interface TableState {
  page: number
  pageSize: number
  sortBy?: string
  sortDir: 'asc' | 'desc'
}

