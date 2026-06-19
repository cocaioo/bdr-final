import type {
  DeputyOption,
  DeputyGastosCategory,
  DeputyGastosProfile,
  DeputyIdentityEnrichment,
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
  const headers = lines[0]
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((item) => item.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(';')
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index]?.trim() ?? ''
      return row
    }, {})
  })
}

export async function fetchDeputiesCatalog(): Promise<DeputyOption[]> {
  return fetchDeputies()
}

function buildDeputyPhotoUrl(id: string): string {
  return `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`
}

function readValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value && value.trim()) return value.trim()
  }
  return ''
}

export async function fetchDeputies(): Promise<DeputyOption[]> {
  const response = await fetch('/deputados.csv')
  if (!response.ok) {
    throw new Error(`Erro ao carregar catalogo de deputados (${response.status})`)
  }

  const rows = parseSemicolonCsv(await response.text())
  return rows
    .map((row) => {
      const id = readValue(row, ['id_deputado', 'id'])
      const uriDeputado = readValue(row, ['uri_deputado', 'uriDeputado']) || undefined
      const nome = readValue(row, ['nome'])
      const nomeCivil = readValue(row, ['nome_civil', 'nomeCivil']) || undefined
      const cpf = readValue(row, ['cpf']) || undefined
      const escolaridade = readValue(row, ['escolaridade']) || undefined
      const legislaturaInicial = readValue(row, ['id_legislatura_inicial', 'idLegislaturaInicial']) || undefined
      const legislaturaFinal = readValue(row, ['id_legislatura_final', 'idLegislaturaFinal']) || undefined
      const partido = readValue(row, ['sigla_partido', 'partido', 'siglaPartido']) || undefined
      const uf = readValue(row, ['sigla_uf', 'uf', 'siglaUf']) || undefined

      return {
        id,
        uriDeputado,
        nome,
        nomeCivil,
        cpf,
        partido,
        uf,
        escolaridade,
        legislaturaInicial,
        legislaturaFinal,
        fotoUrl: id ? buildDeputyPhotoUrl(id) : undefined,
      }
    })
    .filter((row) => row.id && row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
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

export function fetchQuestionForDeputy(
  questionId: string,
  deputyId: string,
  page = 1,
  pageSize = 100,
): Promise<QuestionPayload> {
  return fetchQuestion(
    questionId,
    {
      anos: [],
      eixos: [],
      partidos: [],
      ufs: [],
      deputados: [deputyId],
      escolaridade: [],
      search: '',
    },
    { page, pageSize, sortDir: 'desc' },
    ['deputados'],
  )
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

/** Busca partido e UF do deputado a partir do endpoint de gastos por deputado. */
export async function fetchDeputyIdentityFromGastos(deputyId: string): Promise<DeputyIdentityEnrichment> {
  try {
    const payload = await fetchGastosDeputados({ busca: deputyId, pageSize: 10 })
    const row =
      payload.items.find((item) => String(item.id_deputado) === deputyId) ?? payload.items[0]
    if (!row) return {}
    return {
      partido: row.sigla_partido || undefined,
      uf: row.sigla_uf || undefined,
    }
  } catch {
    return {}
  }
}

function numericValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function extractDeputyCategories(payload: QuestionPayload): DeputyGastosCategory[] {
  const tables = [payload.table_spec, ...payload.complement_tables]
  const globalRows = tables.flatMap((table) =>
    table.rows.filter((row) => String(row.ano_dados ?? '').toUpperCase() === 'GLOBAL'),
  )
  const rows = globalRows.length ? globalRows : payload.table_spec.rows

  return rows
    .filter((row) => row.descricao_despesa)
    .map((row) => ({
      categoria: String(row.descricao_despesa),
      valor_total: numericValue(row.gasto_total),
      qtd_despesas: numericValue(row.qtd_lancamentos),
    }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 6)
}

/** Consolida somente dados existentes nos contratos atuais de gastos e perguntas. */
export async function fetchDeputyGastosSummary(deputyId: string): Promise<DeputyGastosProfile> {
  const [deputiesResult, suppliersResult, categoriesResult, anomaliesResult, metaResult] = await Promise.allSettled([
    fetchGastosDeputados({ busca: deputyId, pageSize: 10 }),
    fetchGastosFornecedores({ deputado: deputyId, pageSize: 6 }),
    fetchQuestionForDeputy('q13', deputyId, 1, 100),
    fetchGastosAnomaliaDetalhes({ deputado: deputyId, pageSize: 5 }),
    fetchMeta(),
  ])

  const errors: string[] = []
  const recordFailure = (label: string, result: PromiseSettledResult<unknown>) => {
    if (result.status === 'rejected') errors.push(label)
  }
  recordFailure('resumo', deputiesResult)
  recordFailure('fornecedores', suppliersResult)
  recordFailure('categorias', categoriesResult)
  recordFailure('despesas atípicas', anomaliesResult)

  const deputyRows = deputiesResult.status === 'fulfilled' ? deputiesResult.value.items : []
  const deputyRow = deputyRows.find((item) => String(item.id_deputado) === deputyId) ?? deputyRows[0]
  const summary = deputyRow
    ? {
        valor_total: numericValue(deputyRow.valor_total),
        qtd_despesas: numericValue(deputyRow.qtd_despesas),
        ticket_medio: numericValue(deputyRow.ticket_medio),
        qtd_deputados: 1,
        qtd_fornecedores: numericValue(deputyRow.qtd_fornecedores),
      }
    : null

  const years =
    metaResult.status === 'fulfilled'
      ? metaResult.value.available_filters.anos
          .map((item) => item.value)
          .filter((year) => /^\d{4}$/.test(year) && Number(year) >= 2023)
      : []
  if (metaResult.status === 'rejected') errors.push('evolução anual')

  const annualResults = await Promise.allSettled(
    years.map((year) => fetchGastosDeputados({ ano: year, busca: deputyId, pageSize: 10 })),
  )
  const evolution = annualResults
    .flatMap((result, index) => {
      if (result.status === 'rejected') return []
      const item = result.value.items.find((row) => String(row.id_deputado) === deputyId) ?? result.value.items[0]
      return item
        ? [{ ano: years[index], valor_total: numericValue(item.valor_total), qtd_despesas: numericValue(item.qtd_despesas) }]
        : []
    })
    .sort((a, b) => a.ano.localeCompare(b.ano))
  if (annualResults.some((result) => result.status === 'rejected') && !errors.includes('evolução anual')) {
    errors.push('evolução anual')
  }

  const categories = categoriesResult.status === 'fulfilled' ? extractDeputyCategories(categoriesResult.value) : []
  const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value.items : []
  const anomalies = anomaliesResult.status === 'fulfilled' ? anomaliesResult.value.items : []

  return {
    summary,
    categories,
    suppliers,
    evolution,
    anomalies,
    hasData: Boolean(summary || categories.length || suppliers.length || evolution.length || anomalies.length),
    partialErrors: errors,
  }
}

