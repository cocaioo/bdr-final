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
): Promise<QuestionPayload> {
  const query = buildQuery({
    anos: filters.anos,
    eixos: filters.eixos,
    partidos: filters.partidos,
    ufs: filters.ufs,
    deputados: filters.deputados,
    search: filters.search,
    sort_by: table.sortBy,
    sort_dir: table.sortDir,
    page: table.page,
    page_size: table.pageSize,
  })
  return fetchJson<QuestionPayload>(`${API_BASE}/api/questions/${questionId}?${query}`)
}

