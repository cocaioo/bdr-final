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

export interface DeputyOption {
  id: string
  uriDeputado?: string
  nome: string
  nomeCivil?: string
  cpf?: string
  partido?: string
  uf?: string
  escolaridade?: string
  legislaturaInicial?: string
  legislaturaFinal?: string
  fotoUrl?: string
}

export type DeputyCatalogItem = DeputyOption

export interface DeputyIdentityEnrichment {
  partido?: string
  uf?: string
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

export interface GastosSummary {
  valor_total: number
  qtd_despesas: number
  ticket_medio: number
  qtd_deputados: number
  qtd_fornecedores: number
}

export interface GastosMetadata {
  generated_at: string
  artifacts_dir?: string
  page?: number
  page_size?: number
  total?: number
  filters_applied?: Record<string, string | null | undefined>
  [key: string]: unknown
}

export interface GastosCollectionPayload<TItem> {
  summary: GastosSummary
  items: TItem[]
  metadata: GastosMetadata
}

export interface GastoCategoriaItem {
  categoria: string
  valor_total: number
  qtd_despesas: number
  ticket_medio: number
  qtd_deputados: number
  qtd_fornecedores?: number
  pct_total?: number
}

export interface GastoDeputadoItem {
  ano_dados: string
  id_deputado: number
  nome_parlamentar: string
  sigla_partido: string
  sigla_uf: string
  valor_total: number
  qtd_despesas: number
  ticket_medio: number
  qtd_fornecedores: number
  pct_total?: number
  categoria_principal?: string
  // Q7 cost-benefit fields
  indice_custo_beneficio?: number
  score_proposicoes_total?: number
  score_proposicoes_ajustado?: number
  total_proposicoes?: number
  total_proposicoes_substantivas?: number
  total_proposicoes_aprovadas?: number
  total_proposicoes_em_tramitacao?: number
  total_proposicoes_baixo_impacto?: number
  elegivel_ranking?: boolean
  motivo_inelegibilidade?: string | null
}

export interface GastoFornecedorItem {
  fornecedor: string
  fornecedor_exemplo?: string
  valor_total: number
  qtd_despesas: number
  qtd_deputados: number
  ticket_medio: number
  pct_total?: number
  categorias?: string
  ufs?: string
  partidos?: string
}

export interface GastoContextoPayload {
  summary: {
    qtd_partidos: number
    qtd_ufs: number
    valor_total: number
  }
  partidos: Array<Record<string, unknown>>
  ufs: Array<Record<string, unknown>>
  metadata: GastosMetadata
}


export interface DeputyGastosCategory {
  categoria: string
  valor_total: number
  qtd_despesas: number
}

export interface DeputyGastosAnnual {
  ano: string
  valor_total: number
  qtd_despesas: number
}

export interface DeputyGastosProfile {
  summary: GastosSummary | null
  categories: DeputyGastosCategory[]
  suppliers: GastoFornecedorItem[]
  evolution: DeputyGastosAnnual[]
  hasData: boolean
  partialErrors: string[]
}

export interface DeputyTemaItem {
  tema: string
  qtd_proposicoes: number
}

