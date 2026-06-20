import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { fetchQuestion } from '../../api'
import type { MetaResponse, QuestionPayload } from '../../types'
import { PerfilDashboardPage } from '../PerfilDashboardPage'

vi.mock('../../api', () => ({
  fetchQuestion: vi.fn(),
}))

vi.mock('../../components/ChartPanel', () => ({
  ChartPanel: ({ spec }: { spec: { title: string; description: string; options: Record<string, unknown> } }) => (
    <div data-testid="perfil-chart" data-options={JSON.stringify(spec.options)}>
      <span>{spec.title}</span>
      <small>{spec.description}</small>
    </div>
  ),
}))

const fetchQuestionMock = vi.mocked(fetchQuestion)

const meta: MetaResponse = {
  dataset_version: 'perfil-test',
  last_updated: '2026-06-19T12:00:00Z',
  legend: {},
  available_filters: {
    anos: [
      { value: '2023', label: '2023' },
      { value: '2024', label: '2024' },
    ],
    eixos: [],
    partidos: [{ value: 'PT', label: 'PT' }],
    ufs: [],
    deputados: [],
    escolaridade: [
      { value: 'Mestrado', label: 'Mestrado' },
      { value: 'Superior', label: 'Superior' },
    ],
  },
  questions: [
    {
      id: 'q4',
      title: 'Escolaridade',
      route: '/q/q4',
      description: 'Distribuicao',
      chart_type: 'bar_vertical',
      supported_filters: ['partidos', 'escolaridade'],
      group_id: 'perfil',
    },
    {
      id: 'q6',
      title: 'Associacoes',
      route: '/q/q6',
      description: 'Indicadores',
      chart_type: 'bar_vertical',
      supported_filters: ['anos', 'escolaridade'],
      group_id: 'perfil',
    },
  ],
}

const basePayload: QuestionPayload = {
  question_id: 'q4',
  title: 'Teste',
  description: 'Teste',
  filters_supported: [],
  filters_applied: {},
  summary_cards: [],
  chart_spec: {
    type: 'bar_vertical',
    title: 'Teste',
    description: 'Teste',
    y_fields: [],
    categories: [],
    series: [],
    options: {},
  },
  table_spec: {
    title: 'Tabela',
    columns: [],
    rows: [],
    total: 0,
    page: 1,
    page_size: 200,
    sort_dir: 'desc',
  },
  complement_tables: [],
  query_panel: { sql_path: '', sql_text: '', explanation: '' },
  warnings: [],
  empty_state: { is_empty: false, message: '' },
  dataset_version: 'perfil-test',
  generated_at: '2026-06-19T12:00:00Z',
}

const q4Payload: QuestionPayload = {
  ...basePayload,
  question_id: 'q4',
  summary_cards: [{ id: 'total_deputados', label: 'Total', value: '640', unit: 'deputados' }],
  chart_spec: {
    ...basePayload.chart_spec,
    options: {
      second_chart: {
        type: 'stacked_bar',
        title: 'Distribuição de Escolaridade por Partido',
        description: 'Partidos',
        y_fields: ['qtd_deputados'],
        categories: ['PT'],
        series: [{ name: 'Superior', data: [1] }],
        options: {},
      },
    },
  },
  table_spec: {
    ...basePayload.table_spec,
    total: 2,
    rows: [
      { escolaridade: 'Superior', qtd_deputados: 500 },
      { escolaridade: 'Mestrado', qtd_deputados: 140 },
    ],
  },
}

const q4DeputyRows = [
  { id_deputado: '101', nome: 'Ana Maria', escolaridade: 'Mestrado', sigla_partido: 'PT', sigla_uf: 'SP' },
  { id_deputado: '102', nome: 'Bruno Lima', escolaridade: 'Mestrado', sigla_partido: 'PT', sigla_uf: 'BA' },
  { id_deputado: '103', nome: 'Carla Souza', escolaridade: 'Mestrado', sigla_partido: 'PSB', sigla_uf: 'PE' },
  { id_deputado: '104', nome: 'Diego Alves', escolaridade: 'Superior', sigla_partido: 'PT', sigla_uf: 'RJ' },
]

function buildQ4Payload(filters: { partidos?: string[]; escolaridade?: string[] } = {}): QuestionPayload {
  const filteredRows = q4DeputyRows.filter((row) => {
    const matchesParty = !filters.partidos?.length || filters.partidos.includes(String(row.sigla_partido))
    const matchesEducation =
      !filters.escolaridade?.length || filters.escolaridade.includes(String(row.escolaridade))
    return matchesParty && matchesEducation
  })

  return {
    ...q4Payload,
    summary_cards: [{ id: 'total_deputados', label: 'Total', value: String(filteredRows.length), unit: 'deputados' }],
    complement_tables: [
      {
        ...basePayload.table_spec,
        title: 'Lista nominal',
        columns: [
          { key: 'escolaridade', label: 'Escolaridade', numeric: false },
          { key: 'id_deputado', label: 'Deputado ID', numeric: false },
          { key: 'nome', label: 'Nome', numeric: false },
          { key: 'sigla_partido', label: 'Partido', numeric: false },
          { key: 'sigla_uf', label: 'UF', numeric: false },
        ],
        rows: filteredRows,
        total: filteredRows.length,
      },
    ],
  }
}

function complement(metric: string, rows: Array<Record<string, unknown>>) {
  return {
    ...basePayload.table_spec,
    title: metric,
    columns: [
      { key: 'escolaridade', label: 'Escolaridade', numeric: false },
      { key: metric, label: metric, numeric: true },
    ],
    rows,
    total: rows.length,
  }
}

const metricRows = [
  {
    escolaridade: 'Superior',
    media_gasto: 100,
    media_fidelidade: 90,
    media_proposicoes: 12,
    media_presenca_eventos: 30,
    media_presenca_plenario: 20,
  },
  {
    escolaridade: 'Mestrado',
    media_gasto: 120,
    media_fidelidade: 92,
    media_proposicoes: 14,
    media_presenca_eventos: 32,
    media_presenca_plenario: 22,
  },
]

const q6Payload: QuestionPayload = {
  ...basePayload,
  question_id: 'q6',
  table_spec: { ...basePayload.table_spec, total: 2, rows: metricRows },
  complement_tables: [
    complement('media_gasto', metricRows),
    complement('media_fidelidade', metricRows),
    complement('media_proposicoes', metricRows),
    complement('media_presenca_eventos', metricRows),
    complement('media_presenca_plenario', metricRows),
    {
      ...basePayload.table_spec,
      title: 'Eta quadrado',
      columns: [
        { key: 'indicador', label: 'Indicador', numeric: false },
        { key: 'eta_quadrado', label: 'Eta', numeric: true },
        { key: 'interpretacao', label: 'Interpretação', numeric: false },
      ],
      rows: [
        { indicador: 'presenca_eventos', eta_quadrado: 0.012, interpretacao: 'associacao fraca' },
      ],
      total: 1,
    },
  ],
}

describe('PerfilDashboardPage', () => {
  beforeEach(() => {
    fetchQuestionMock.mockReset()
    fetchQuestionMock.mockImplementation(async (questionId, filters) => {
      if (questionId === 'q4') {
        return buildQ4Payload({
          partidos: filters.partidos,
          escolaridade: filters.escolaridade,
        })
      }
      return q6Payload
    })
  })

  it('apresenta uma análise integrada sem referências internas ou cards removidos', async () => {
    render(
      <MemoryRouter>
        <PerfilDashboardPage meta={meta} />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Escolaridade e Perfil' })).toBeInTheDocument()
    expect(screen.getByText('Escolaridade dos deputados')).toBeInTheDocument()
    expect(screen.getByText('Gasto médio anual por escolaridade')).toBeInTheDocument()
    expect(screen.getByText('Coincidência com a orientação partidária')).toBeInTheDocument()
    expect(screen.getByText('Produção legislativa média por escolaridade')).toBeInTheDocument()
    expect(screen.getByText('Presença média por escolaridade')).toBeInTheDocument()
    expect(screen.getByText(/não provam que a escolaridade causou/i)).toBeInTheDocument()
    expect(screen.queryByText('Deputados no recorte', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Níveis de escolaridade', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Período da atividade', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText(/Maior associação \(η²\)/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\bQ[46]\b|quest[aã]o|pergunta/i)
    expect(fetchQuestionMock).toHaveBeenCalledTimes(2)
  })

  it('formata o gráfico de gastos como valor monetário', async () => {
    render(
      <MemoryRouter>
        <PerfilDashboardPage meta={meta} />
      </MemoryRouter>,
    )

    const title = await screen.findByText('Gasto médio anual por escolaridade')
    expect(title.closest('[data-testid="perfil-chart"]')).toHaveAttribute(
      'data-options',
      expect.stringContaining('"currency":true'),
    )
  })

  it('mantem o q6 sem filtro anual e recarrega apenas com filtros confiaveis', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PerfilDashboardPage meta={meta} />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Escolaridade e Perfil' })
    await user.selectOptions(screen.getByLabelText('Escolaridade'), 'Mestrado')
    await user.selectOptions(screen.getByLabelText('Partido'), 'PT')

    await waitFor(() => {
      expect(fetchQuestionMock).toHaveBeenCalledWith(
        'q6',
        expect.objectContaining({ anos: [], escolaridade: ['Mestrado'], partidos: [] }),
        expect.objectContaining({ pageSize: 200 }),
        ['escolaridade'],
      )
      expect(fetchQuestionMock).toHaveBeenCalledWith(
        'q4',
        expect.objectContaining({ anos: [], partidos: ['PT'], escolaridade: ['Mestrado'] }),
        expect.objectContaining({ pageSize: 200 }),
        ['partidos', 'escolaridade'],
      )
    })
    expect(screen.queryByLabelText('Ano da atividade')).not.toBeInTheDocument()
    expect(screen.getByText(/filtro de ano foi removido desta subseção/i)).toBeInTheDocument()
  })
  it('lista abaixo dos graficos os deputados do recorte filtrado por escolaridade e partido', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PerfilDashboardPage meta={meta} />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Escolaridade e Perfil' })
    expect(screen.queryByRole('heading', { name: 'Deputados no recorte' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Escolaridade'), 'Mestrado')
    await user.selectOptions(screen.getByLabelText('Partido'), 'PT')

    expect(await screen.findByRole('heading', { name: 'Deputados no recorte' })).toBeInTheDocument()
    expect(screen.getByText('Ana Maria')).toBeInTheDocument()
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.queryByText('Carla Souza')).not.toBeInTheDocument()
    expect(screen.queryByText('Diego Alves')).not.toBeInTheDocument()
  })
})
