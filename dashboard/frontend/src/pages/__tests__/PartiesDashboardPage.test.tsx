import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PartiesDashboardPage } from '../PartiesDashboardPage'
import type { MetaResponse, QuestionPayload } from '../../types'

// Componentes baseados em ECharts sao substituidos por marcadores leves para
// que o teste rode no jsdom sem canvas. toSpectrumParties vive no util e e
// importado diretamente pela pagina, entao nao precisa do modulo real aqui.
vi.mock('../../components/IdeologySpectrum', () => ({
  IdeologySpectrum: ({ parties }: { parties: unknown[] }) => (
    <div data-testid="spectrum">espectro:{parties.length}</div>
  ),
}))

vi.mock('../../components/IdeologyBarChart', () => ({
  IdeologyBarChart: ({ bars }: { bars: unknown[] }) => (
    <div data-testid="bar-chart">barras:{bars.length}</div>
  ),
}))

const meta = {
  questions: [
    { id: 'q9', title: 'Q9', route: '/q/q9', description: '', chart_type: 'sankey', supported_filters: [] },
    { id: 'q10', title: 'Q10', route: '/q/q10', description: '', chart_type: 'bar_vertical', supported_filters: [] },
    { id: 'q11', title: 'Q11', route: '/q/q11', description: '', chart_type: 'wordcloud_images', supported_filters: [] },
  ],
} as unknown as MetaResponse

function payload(table: QuestionPayload['table_spec'], complements: QuestionPayload['complement_tables'] = []): QuestionPayload {
  return {
    question_id: 'x',
    title: 't',
    description: 'd',
    filters_supported: [],
    filters_applied: {},
    summary_cards: [],
    chart_spec: { type: 'bar', title: '', description: '', y_fields: [], categories: [], series: [], options: {} },
    table_spec: table,
    complement_tables: complements,
    query_panel: { sql_path: '', sql_text: '', explanation: '' },
    warnings: [],
    empty_state: { is_empty: false, message: '' },
    dataset_version: '1',
    generated_at: '',
  }
}

const q9 = payload(
  {
    title: 'Q9.1 - Lista completa partidos x ideologia',
    columns: [],
    rows: [
      { sigla_partido: 'PT', ideologia_score: 2.6, ideologia_faixa: 'Esquerda', campo_ideologico: 'esquerda', fonte_ideologia: 'Bolognesi', tipo_match_ideologia: 'direto' },
      { sigla_partido: 'PL', ideologia_score: 8.8, ideologia_faixa: 'Extrema direita', campo_ideologico: 'direita', fonte_ideologia: 'Bolognesi', tipo_match_ideologia: 'equivalencia' },
    ],
    total: 2,
    page: 1,
    page_size: 500,
    sort_dir: 'desc',
  },
  [
    {
      title: 'Q9.2 - Correlacao ideologia x proposicao',
      columns: [],
      rows: [
        { ideologia_faixa: 'Esquerda', pct_sim: 80, total_votos: 50 },
        { ideologia_faixa: 'Extrema direita', pct_sim: 40, total_votos: 90 },
      ],
      total: 2,
      page: 1,
      page_size: 500,
      sort_dir: 'desc',
    },
  ],
)

const q10 = payload({
  title: 'Q10 - Ranking de alinhamento interno - consolidado',
  columns: [],
  rows: [
    { posicao: 1, sigla_partido: 'NOVO', ideologia_faixa: 'Extrema direita', qtd_deputados: 5, total_votos_com_diretriz: 100, votos_alinhados: 99, pct_alinhamento: 99.5 },
  ],
  total: 1,
  page: 1,
  page_size: 500,
  sort_dir: 'desc',
})

const q11 = payload(
  {
    title: 'Q11.a - Ranking de partidos por frequência nas votações',
    columns: [],
    rows: [
      { sigla_partido: 'PL', ideologia_faixa: 'Extrema direita', votacoes_participadas: 1541, total_votos_registrados: 85540 },
    ],
    total: 1,
    page: 1,
    page_size: 500,
    sort_dir: 'desc',
  },
  [
    {
      title: 'Q11.b - Ranking de partidos por proposicoes de projetos',
      columns: [],
      rows: [{ sigla_partido: 'PL', ideologia_faixa: 'Extrema direita', total_proposicoes: 66665 }],
      total: 1,
      page: 1,
      page_size: 500,
      sort_dir: 'desc',
    },
    {
      title: 'Q11.c - Ranking de partidos por gastos',
      columns: [],
      rows: [{ sigla_partido: 'PL', ideologia_faixa: 'Extrema direita', gasto_total: 151600251 }],
      total: 1,
      page: 1,
      page_size: 500,
      sort_dir: 'desc',
    },
  ],
)

describe('PartiesDashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        const body = url.includes('/q9') ? q9 : url.includes('/q10') ? q10 : q11
        return { ok: true, json: async () => body } as Response
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renderiza o painel consolidado sem comportamento de voto nem metodologia', async () => {
    render(<PartiesDashboardPage meta={meta} />)

    expect(await screen.findByRole('heading', { name: /Partidos, Ideologia e Votação/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Espectro ideológico/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Distribuição ideológica/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Alinhamento partidário/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Rankings partidários/i, level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Comportamento de voto/i, level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Metodologia e fontes/i })).not.toBeInTheDocument()
  })

  it('mostra os cards de resumo com os partidos classificados', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    const card = await screen.findByText('Partidos classificados')
    expect(card.parentElement?.querySelector('p')?.textContent).toContain('2')
    expect(screen.getByText('Maior alinhamento partidário')).toBeInTheDocument()
    expect(screen.getByText('99.5%')).toBeInTheDocument()
  })

  it('exibe a legenda sempre com as sete faixas, inclusive a vazia (Centro)', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    await screen.findByLabelText('Faixas ideologicas')
    expect(screen.getByText('Centro')).toBeInTheDocument()
    expect(screen.getByText('Extrema esquerda')).toBeInTheDocument()
  })

  it('alterna entre as abas de ranking', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    await screen.findByRole('tab', { name: 'Votações' })
    await userEvent.click(screen.getByRole('tab', { name: 'Score composto' }))
    expect(screen.getByRole('tab', { name: 'Score composto' })).toHaveAttribute('aria-selected', 'true')
  })

})
