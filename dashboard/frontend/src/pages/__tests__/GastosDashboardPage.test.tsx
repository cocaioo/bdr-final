import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import {
  fetchDeputyExpenseBreakdown,
  fetchQuestion,
  fetchGastosCategorias,
  fetchGastosContexto,
  fetchGastosDeputados,
  fetchGastosFornecedores,
  fetchGastosResumo,
} from '../../api'
import type { MetaResponse } from '../../types'
import { GastosDashboardPage } from '../GastosDashboardPage'

vi.mock('../../api', () => ({
  fetchDeputyExpenseBreakdown: vi.fn(),
  fetchQuestion: vi.fn(),
  fetchGastosCategorias: vi.fn(),
  fetchGastosContexto: vi.fn(),
  fetchGastosDeputados: vi.fn(),
  fetchGastosFornecedores: vi.fn(),
  fetchGastosResumo: vi.fn(),
}))

vi.mock('../../components/ChartPanel', () => ({
  ChartPanel: ({ spec }: { spec: { title: string; options: Record<string, unknown> } }) => (
    <div data-testid={`chart-${spec.title}`} data-options={JSON.stringify(spec.options)}>{spec.title}</div>
  ),
}))

const summary = {
  valor_total: 1_234_567.89,
  qtd_despesas: 20,
  ticket_medio: 61_728.39,
  qtd_deputados: 1,
  qtd_fornecedores: 2,
}

const collection = <T,>(items: T[]) => ({ summary, items, metadata: {} })

const meta: MetaResponse = {
  dataset_version: 'gastos-test',
  last_updated: '2026-06-19T12:00:00Z',
  legend: {},
  questions: [],
  available_filters: {
    anos: [{ value: '2024', label: '2024' }, { value: '2025', label: '2025' }],
    eixos: [],
    partidos: [{ value: 'PT', label: 'PT' }],
    ufs: [{ value: 'CE', label: 'CE' }],
    deputados: [],
    escolaridade: [],
  },
  question_filters: {
    q7: {
      anos: [{ value: '2026', label: '2026 parcial' }, { value: '2025', label: '2025' }],
      eixos: [],
      partidos: [],
      ufs: [],
      deputados: [],
      escolaridade: [],
    },
  },
}

const deputy = {
  ano_dados: '2025',
  id_deputado: 123,
  nome_parlamentar: 'Deputada Teste',
  sigla_partido: 'PT',
  sigla_uf: 'CE',
  valor_total: 100_000,
  qtd_despesas: 10,
  ticket_medio: 10_000,
  qtd_fornecedores: 3,
  pct_total: 8.1,
  categoria_principal: 'Passagens',
}

const deputyBreakdown = {
  total: 100_000,
  source: 'q12_q13' as const,
  partialErrors: [],
  suppliers: [
    {
      fornecedor: 'Fornecedor do Deputado',
      valor_total: 60_000,
      qtd_despesas: 4,
      qtd_deputados: 1,
      ticket_medio: 15_000,
      pct_total: 60,
    },
    {
      fornecedor: 'Segundo Fornecedor',
      valor_total: 25_000,
      qtd_despesas: 3,
      qtd_deputados: 1,
      ticket_medio: 8_333.33,
      pct_total: 25,
    },
  ],
  categories: [
    {
      categoria: 'Categoria do Deputado',
      valor_total: 70_000,
      qtd_despesas: 7,
      qtd_deputados: 1,
      ticket_medio: 10_000,
      pct_total: 70,
    },
    {
      categoria: 'Categoria Secundaria',
      valor_total: 30_000,
      qtd_despesas: 3,
      qtd_deputados: 1,
      ticket_medio: 10_000,
      pct_total: 30,
    },
  ],
}

const q7GlobalPayload = {
  question_id: 'q7',
  title: 'Indice de custo-beneficio',
  description: 'Ranking global',
  filters_supported: ['anos'],
  filters_applied: {},
  summary_cards: [],
  chart_spec: {
    type: 'scatter',
    title: 'Q7',
    description: 'Q7',
    categories: [],
    series: [],
    y_fields: [],
    options: {},
  },
  table_spec: {
    title: 'Tabela principal',
    columns: [],
    rows: [
      {
        posicao: 1,
        periodo_label: 'Global',
        ano_parcial: false,
        nome_parlamentar: 'Amom Mandel',
        sigla_partido: 'REPUBLICANOS',
        sigla_uf: 'AM',
        gasto_total: 89463.44,
        score_proposicoes_ajustado: 596.4,
        indice_custo_beneficio: 20.33197,
      },
    ],
    total: 620,
    page: 1,
    page_size: 5,
    sort_dir: 'desc' as const,
  },
  complement_tables: [],
  query_panel: {
    sql_path: 'q7.sql',
    sql_text: 'select 1',
    explanation: 'Q7',
  },
  warnings: [],
  empty_state: {
    is_empty: false,
    message: '',
  },
  dataset_version: 'test',
  generated_at: '2026-06-24T00:00:00Z',
}

const q7PartialPayload = {
  ...q7GlobalPayload,
  table_spec: {
    ...q7GlobalPayload.table_spec,
    rows: [
      {
        posicao: 1,
        periodo_label: '2026',
        ano_parcial: true,
        nome_parlamentar: 'Altineu Cortes',
        sigla_partido: 'PL',
        sigla_uf: 'RJ',
        gasto_total: 94200,
        score_proposicoes_ajustado: 328.16,
        indice_custo_beneficio: 10.76736,
      },
    ],
    total: 541,
  },
}

beforeEach(() => {
  vi.mocked(fetchDeputyExpenseBreakdown).mockResolvedValue(deputyBreakdown)
  vi.mocked(fetchQuestion).mockImplementation(async (_questionId, filters) => (
    filters.anos[0] === '2026' ? q7PartialPayload : q7GlobalPayload
  ))
  vi.mocked(fetchGastosResumo).mockResolvedValue(summary)
  vi.mocked(fetchGastosCategorias).mockResolvedValue(collection([
    { categoria: 'Passagens', valor_total: 800_000, qtd_despesas: 12, ticket_medio: 66_666.67, qtd_deputados: 1, pct_total: 64.8 },
  ]))
  vi.mocked(fetchGastosDeputados).mockResolvedValue(collection([deputy]))
  vi.mocked(fetchGastosFornecedores).mockResolvedValue(collection([
    {
      fornecedor: 'Fornecedor Global',
      valor_total: 900_000,
      qtd_despesas: 20,
      qtd_deputados: 5,
      ticket_medio: 45_000,
      pct_total: 72.9,
    },
  ]))
  vi.mocked(fetchGastosContexto).mockResolvedValue({ summary: { qtd_partidos: 1, qtd_ufs: 1, valor_total: summary.valor_total }, partidos: [], ufs: [], metadata: {} })
})

it('renders the Q7 ranking cards in the resumo tab without atypical-expense jargon', async () => {
  render(<GastosDashboardPage meta={meta} />)

  // The resumo tab shows Q7 ranking cards (no chart widget for evolution or category)
  expect(await screen.findByRole('heading', { name: /Custo-Benefício Parlamentar/i })).toBeInTheDocument()
  expect(await screen.findByText('Amom Mandel')).toBeInTheDocument()

  // Outdated chart test-ids no longer exist in the redesigned resumo tab
  expect(screen.queryByTestId('chart-Evolucao temporal dos gastos')).not.toBeInTheDocument()
  expect(screen.queryByTestId('chart-Distribuicao por categoria')).not.toBeInTheDocument()

  // Atypical-expense / anomaly / ticket jargon should never appear
  expect(screen.queryByText(/gastos at[ií]picos/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/anomalia/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/ticket/i)).not.toBeInTheDocument()
})

it('renders the Q7 ranking in the gastos dashboard and supports the annual partial view', async () => {
  const user = userEvent.setup()
  render(<GastosDashboardPage meta={meta} />)

  // Q7 section is always visible in the resumo tab — no expand button needed
  expect(await screen.findByRole('heading', { name: /Custo-Benefício Parlamentar/i })).toBeInTheDocument()
  expect(await screen.findByText('Amom Mandel')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Abrir pagina completa/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ver analise completa/i })).not.toBeInTheDocument()

  // Filters are directly available — switch to annual scope and pick 2026
  await user.selectOptions(screen.getByLabelText('Escopo'), 'anual')
  await user.selectOptions(screen.getByLabelText('Ano'), '2026')

  await waitFor(() => {
    expect(screen.getAllByText('2026 parcial').length).toBeGreaterThan(0)
  })
  expect(screen.getByText('Altineu Cortes')).toBeInTheDocument()
})

it('clears section-specific filters and selections when changing tabs', async () => {
  const user = userEvent.setup()
  render(<GastosDashboardPage meta={meta} />)

  await user.click(screen.getByRole('button', { name: /DeputadosQuem gastou/i }))
  await screen.findByText('Ranking de Deputados (Clique para Analisar)')

  await user.selectOptions(screen.getByLabelText('Ano'), '2024')
  await user.selectOptions(screen.getByLabelText('Partido'), 'PT')
  await user.type(screen.getByLabelText('Busca'), 'Teste')
  await user.click(screen.getByRole('button', { name: /Deputada Teste/i }))
  expect(screen.getByText('Analisando deputado:')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /FornecedoresQuem recebeu/i }))
  await user.click(screen.getByRole('button', { name: /DeputadosQuem gastou/i }))

  await waitFor(() => {
    expect(screen.getByLabelText('Ano')).toHaveValue('2024')
    expect(screen.getByLabelText('Partido')).toHaveValue('PT')
    expect(screen.getByLabelText('Busca')).toHaveValue('')
  })
  expect(screen.queryByText('Analisando deputado:')).not.toBeInTheDocument()
})

it('does not refetch the ranking when selecting a deputy card', async () => {
  const user = userEvent.setup()
  const deputyFetchMock = vi.mocked(fetchGastosDeputados)
  render(<GastosDashboardPage meta={meta} />)

  await user.click(screen.getByRole('button', { name: /DeputadosQuem gastou/i }))
  await screen.findByText('Ranking de Deputados (Clique para Analisar)')

  const callsBeforeSelection = deputyFetchMock.mock.calls.length
  await user.click(screen.getByRole('button', { name: /Deputada Teste/i }))

  await waitFor(() => {
    expect(screen.getByText('Analisando deputado:')).toBeInTheDocument()
  })
  expect(deputyFetchMock.mock.calls.length).toBe(callsBeforeSelection)
})

it('renders the selected deputy drilldown from Q12 and Q13 with deputy-based percentages', async () => {
  const user = userEvent.setup()
  render(<GastosDashboardPage meta={meta} />)

  await user.click(screen.getByRole('button', { name: /DeputadosQuem gastou/i }))
  await screen.findByText('Ranking de Deputados (Clique para Analisar)')
  await user.click(screen.getByRole('button', { name: /Deputada Teste/i }))

  expect(await screen.findByText(/Fonte canônica: Q12 e Q13/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Top fornecedores do deputado (Q12)' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Top categorias do deputado (Q13)' })).toBeInTheDocument()
  expect(screen.getAllByText('Fornecedor do Deputado').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Categoria do Deputado').length).toBeGreaterThan(0)
  expect(screen.getByText('Q12_Q13')).toBeInTheDocument()
  expect(screen.getAllByText(/Valor médio por despesa/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText('60%').length).toBeGreaterThan(0)
  expect(screen.getAllByText('70%').length).toBeGreaterThan(0)
  expect(vi.mocked(fetchDeputyExpenseBreakdown)).toHaveBeenCalledWith('123', {
    ano: undefined,
    partido: undefined,
    uf: undefined,
  })
  expect(vi.mocked(fetchGastosFornecedores)).not.toHaveBeenCalledWith(
    expect.objectContaining({ deputado: '123' }),
  )
})

it('keeps the fornecedores tab global and does not pass deputy to the global endpoint', async () => {
  const user = userEvent.setup()
  render(<GastosDashboardPage meta={meta} />)

  await user.click(screen.getByRole('button', { name: /DeputadosQuem gastou/i }))
  await screen.findByText('Ranking de Deputados (Clique para Analisar)')
  await user.click(screen.getByRole('button', { name: /Deputada Teste/i }))
  await user.click(screen.getByRole('button', { name: /FornecedoresQuem recebeu/i }))

  expect((await screen.findAllByText('Fornecedor Global')).length).toBeGreaterThan(0)
  expect(vi.mocked(fetchGastosFornecedores)).toHaveBeenLastCalledWith({
    categoria: undefined,
    partido: undefined,
    uf: undefined,
    pageSize: 100,
  })
  expect(vi.mocked(fetchGastosFornecedores)).not.toHaveBeenCalledWith(
    expect.objectContaining({ deputado: '123' }),
  )
})

it('typing in Q7 search triggers fetchQuestion with the search value', async () => {
  const user = userEvent.setup()
  const questionMock = vi.mocked(fetchQuestion)
  render(<GastosDashboardPage meta={meta} />)

  // Q7 section is always visible in the resumo tab — no expand button needed
  expect(await screen.findByRole('heading', { name: /Custo-Benefício Parlamentar/i })).toBeInTheDocument()

  // Clear mock call history once initial load is done
  questionMock.mockClear()
  questionMock.mockResolvedValue(q7GlobalPayload)

  // Type in the search input (placeholder matches what the component renders)
  const searchInput = screen.getByPlaceholderText('Nome do deputado...')
  await user.type(searchInput, 'amom')

  // Wait for debounced fetch with the search value
  await waitFor(() => {
    const calls = questionMock.mock.calls
    const hasSearchCall = calls.some(
      ([qId, filters]) => qId === 'q7' && filters.search === 'amom'
    )
    expect(hasSearchCall).toBe(true)
  }, { timeout: 2000 })
})
