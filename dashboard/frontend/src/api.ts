import type { FilterState, MetaResponse, QuestionPayload, TableState } from './types'

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

