import { render, screen } from '@testing-library/react'
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

vi.mock('../../components/RevealedPositionScatter', () => ({
  RevealedPositionScatter: ({ deputies }: { deputies: unknown[] }) => (
    <div data-testid="revealed-scatter">revelados:{deputies.length}</div>
  ),
}))

const meta = {
  questions: [
    { id: 'q9', title: 'Q9', route: '/q/q9', description: '', chart_type: 'sankey', supported_filters: [] },
    { id: 'q10', title: 'Q10', route: '/q/q10', description: '', chart_type: 'bar_vertical', supported_filters: [] },
    { id: 'q11', title: 'Q11', route: '/q/q11', description: '', chart_type: 'wordcloud_images', supported_filters: [] },
    { id: 'q14', title: 'Q14', route: '/q/q14', description: '', chart_type: 'scatter', supported_filters: [] },
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

const q14 = payload(
  {
    title: 'Q14 - Posição ideológica revelada por deputado',
    columns: [],
    rows: [
      { deputy_id: 1, deputy_name: 'Ana', party: 'PT', party_ideology_score: 2.6, party_ideology_band: 'Esquerda', behavioral_score_calibrated: 3.0, party_deviation: 0.4, party_deviation_direction: 'alinhado', valid_votes: 700, confidence_band: 'alta' },
      { deputy_id: 2, deputy_name: 'Bruno', party: 'PL', party_ideology_score: 8.8, party_ideology_band: 'Extrema direita', behavioral_score_calibrated: 6.0, party_deviation: -2.8, party_deviation_direction: 'mais a esquerda', valid_votes: 650, confidence_band: 'média' },
    ],
    total: 2,
    page: 1,
    page_size: 1000,
    sort_dir: 'desc',
  },
)

q14.chart_spec.options = {
  topRightDeviation: [{ deputy_name: 'Carla', party: 'PT', party_deviation: 3.5, party_deviation_direction: 'mais a direita', party_ideology_band: 'Esquerda' }],
  topLeftDeviation: [{ deputy_name: 'Bruno', party: 'PL', party_deviation: -2.8, party_deviation_direction: 'mais a esquerda', party_ideology_band: 'Extrema direita' }],
  mostAligned: [{ deputy_name: 'Ana', party: 'PT', party_deviation: 0.4 }],
  partyCohesionRanking: [{ party: 'PT', num_deputados: 12, party_ideology_band: 'Esquerda', caucus_deviation_mean_abs: 0.8 }, { party: 'PL', num_deputados: 8, party_ideology_band: 'Extrema direita', caucus_deviation_mean_abs: 1.6 }],
  methodology: { source: 'W-NOMINATE + Bolognesi', summary: 'Posição revelada por votos.', text: 'A posição ideológica revelada é estimada a partir do comportamento de voto calibrado contra a escala dos partidos.' },
}

describe('PartiesDashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        const body = url.includes('/q14') ? q14 : url.includes('/q9') ? q9 : url.includes('/q10') ? q10 : q11
        return { ok: true, json: async () => body } as Response
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renderiza o bloco consolidado com as dez seções na ordem definida', async () => {
    render(<PartiesDashboardPage meta={meta} />)

    expect(await screen.findByRole('heading', { name: /Partidos, Ideologia e Votação/i, level: 1 })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
    expect(headings).toEqual([
      expect.stringMatching(/Espectro ideológico/i),
      expect.stringMatching(/Distribuição ideológica/i),
      expect.stringMatching(/Alinhamento partidário/i),
      expect.stringMatching(/Rankings partidários/i),
      expect.stringMatching(/Posição ideológica revelada/i),
      expect.stringMatching(/Deputados fora da curva/i),
      expect.stringMatching(/Coesão das bancadas/i),
      expect.stringMatching(/Tabela completa/i),
      expect.stringMatching(/Metodologia e fontes/i),
    ])
  })

  it('integra Q14: scatter de posição revelada, outliers e tabela colapsável fechada', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    expect(await screen.findByTestId('revealed-scatter')).toHaveTextContent('revelados:2')
    expect(screen.getByRole('heading', { name: /Mais à direita que o partido/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Mais à esquerda que o partido/i })).toBeInTheDocument()
    // A tabela completa começa recolhida (apenas o botão, sem linhas).
    const toggle = screen.getByRole('button', { name: /Tabela completa de deputados/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('mostra o resumo executivo com os indicadores-chave', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    const card = await screen.findByText('Partidos analisados')
    expect(card.parentElement?.querySelector('p')?.textContent).toContain('2')
    expect(screen.getByText('Deputados analisados')).toBeInTheDocument()
    expect(screen.getByText('Votos analisados')).toBeInTheDocument()
    expect(screen.getByText('Correlação ideologia × comportamento')).toBeInTheDocument()
    expect(screen.getByText('Coesão média das bancadas')).toBeInTheDocument()
  })

  it('exibe a legenda sempre com as sete faixas, inclusive a vazia (Centro)', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    await screen.findByLabelText('Faixas ideologicas')
    expect(screen.getByText('Centro')).toBeInTheDocument()
    expect(screen.getByText('Extrema esquerda')).toBeInTheDocument()
  })

  it('alterna entre as abas de ranking e não expõe o Score composto', async () => {
    render(<PartiesDashboardPage meta={meta} />)
    await screen.findByRole('tab', { name: 'Votações' })
    expect(screen.queryByRole('tab', { name: 'Score composto' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Gastos' }))
    expect(screen.getByRole('tab', { name: 'Gastos' })).toHaveAttribute('aria-selected', 'true')
  })

})
