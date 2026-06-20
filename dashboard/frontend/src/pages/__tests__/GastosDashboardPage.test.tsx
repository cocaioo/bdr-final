import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import {
  fetchGastosCategorias,
  fetchGastosContexto,
  fetchGastosDeputados,
  fetchGastosFornecedores,
  fetchGastosResumo,
} from '../../api'
import type { MetaResponse } from '../../types'
import { GastosDashboardPage } from '../GastosDashboardPage'

vi.mock('../../api', () => ({
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

beforeEach(() => {
  vi.mocked(fetchGastosResumo).mockResolvedValue(summary)
  vi.mocked(fetchGastosCategorias).mockResolvedValue(collection([
    { categoria: 'Passagens', valor_total: 800_000, qtd_despesas: 12, ticket_medio: 66_666.67, qtd_deputados: 1, pct_total: 64.8 },
  ]))
  vi.mocked(fetchGastosDeputados).mockResolvedValue(collection([deputy]))
  vi.mocked(fetchGastosFornecedores).mockResolvedValue(collection([]))
  vi.mocked(fetchGastosContexto).mockResolvedValue({ summary: { qtd_partidos: 1, qtd_ufs: 1, valor_total: summary.valor_total }, partidos: [], ufs: [], metadata: {} })
})

it('remove gastos atipicos and configures financial charts without a clickable legend', async () => {
  render(<GastosDashboardPage meta={meta} />)

  const evolution = await screen.findByTestId('chart-Evolucao temporal dos gastos')
  const category = screen.getByTestId('chart-Distribuicao por categoria')

  expect(evolution).toHaveAttribute('data-options', expect.stringContaining('"show_legend":false'))
  expect(category).toHaveAttribute('data-options', expect.stringContaining('"currency":true'))
  expect(screen.queryByText(/gastos at[ií]picos/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/anomalia/i)).not.toBeInTheDocument()
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
