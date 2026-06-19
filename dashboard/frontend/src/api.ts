import type {
  DeputyCatalogItem,
  FilterState,
  GastoAnomaliaDetalhesPayload,
  GastoAnomaliasPayload,
  GastoCategoriaItem,
  GastoContextoPayload,
  GastoDeputadoItem,
  GastoFornecedorItem,
  GastosCollectionPayload,
  GastosSummary,
  MetaResponse,
  QuestionPayload,
  TableState,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function buildQuery(params: Record<string, string | number | undefined | string[]>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item.trim()) query.append(key, item)
      })
      return
    }
    if (String(value).trim()) query.append(key, String(value))
  })
  return query.toString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Erro na API (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function fetchMeta(): Promise<MetaResponse> {
  return fetchJson<MetaResponse>(`${API_BASE}/api/meta`)
}

function parseSemicolonCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(';').map((item) => item.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(';')
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index]?.trim() ?? ''
      return row
    }, {})
  })
}

export async function fetchDeputiesCatalog(): Promise<DeputyCatalogItem[]> {
  const response = await fetch('/deputados.csv')
  if (!response.ok) {
    throw new Error(`Erro ao carregar catalogo de deputados (${response.status})`)
  }
  const rows = parseSemicolonCsv(await response.text())
  return rows
    .map((row) => ({
      id_deputado: row.id_deputado,
      nome: row.nome,
      nome_civil: row.nome_civil,
      escolaridade: row.escolaridade,
    }))
    .filter((row) => row.id_deputado && row.nome)
}

export function fetchQuestion(
  questionId: string,
  filters: FilterState,
  table: TableState,
  supportedFilters?: string[],
): Promise<QuestionPayload> {
  const queryParams: Record<string, string | number | undefined | string[]> = {
    search: filters.search,
    sort_by: table.sortBy,
    sort_dir: table.sortDir,
    page: table.page,
    page_size: table.pageSize,
  }

  const isEnabled = (filterName: string) => {
    if (!supportedFilters || supportedFilters.length === 0) return true
    return supportedFilters.includes(filterName)
  }

  if (isEnabled('anos')) queryParams.anos = filters.anos
  if (isEnabled('eixos')) queryParams.eixos = filters.eixos
  if (isEnabled('partidos')) queryParams.partidos = filters.partidos
  if (isEnabled('ufs')) queryParams.ufs = filters.ufs
  if (isEnabled('deputados')) queryParams.deputados = filters.deputados
  if (isEnabled('escolaridade')) queryParams.escolaridade = filters.escolaridade

  const query = buildQuery(queryParams)
  return fetchJson<QuestionPayload>(`${API_BASE}/api/questions/${questionId}?${query}`)
}

export function fetchGastosResumo(): Promise<GastosSummary> {
  return fetchJson<GastosSummary>(`${API_BASE}/api/gastos/resumo`)
}

export function fetchGastosCategorias(
  page = 1,
  pageSize = 100,
): Promise<GastosCollectionPayload<GastoCategoriaItem>> {
  const query = buildQuery({ page, page_size: pageSize })
  return fetchJson<GastosCollectionPayload<GastoCategoriaItem>>(`${API_BASE}/api/gastos/categorias?${query}`)
}

export function fetchGastosDeputados(params: {
  ano?: string
  partido?: string
  uf?: string
  busca?: string
  page?: number
  pageSize?: number
} = {}): Promise<GastosCollectionPayload<GastoDeputadoItem>> {
  const query = buildQuery({
    ano: params.ano,
    partido: params.partido,
    uf: params.uf,
    busca: params.busca,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 100,
  })
  return fetchJson<GastosCollectionPayload<GastoDeputadoItem>>(`${API_BASE}/api/gastos/deputados?${query}`)
}

export function fetchGastosFornecedores(params: {
  categoria?: string
  partido?: string
  uf?: string
  deputado?: string
  page?: number
  pageSize?: number
} = {}): Promise<GastosCollectionPayload<GastoFornecedorItem>> {
  const query = buildQuery({
    categoria: params.categoria,
    partido: params.partido,
    uf: params.uf,
    deputado: params.deputado,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 100,
  })
  return fetchJson<GastosCollectionPayload<GastoFornecedorItem>>(`${API_BASE}/api/gastos/fornecedores?${query}`)
}

export function fetchGastosContexto(): Promise<GastoContextoPayload> {
  return fetchJson<GastoContextoPayload>(`${API_BASE}/api/gastos/contexto`)
}

export function fetchGastosAnomalias(params: {
  partido?: string
  uf?: string
  busca?: string
  page?: number
  pageSize?: number
} = {}): Promise<GastoAnomaliasPayload> {
  const query = buildQuery({
    partido: params.partido,
    uf: params.uf,
    busca: params.busca,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 100,
  })
  return fetchJson<GastoAnomaliasPayload>(`${API_BASE}/api/gastos/anomalias?${query}`)
}

export function fetchGastosAnomaliaDetalhes(params: {
  deputado?: string
  partido?: string
  uf?: string
  categoria?: string
  page?: number
  pageSize?: number
}): Promise<GastoAnomaliaDetalhesPayload> {
  const query = buildQuery({
    deputado: params.deputado,
    partido: params.partido,
    uf: params.uf,
    categoria: params.categoria,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 50,
  })
  return fetchJson<GastoAnomaliaDetalhesPayload>(`${API_BASE}/api/gastos/anomalias/detalhes?${query}`)
}

