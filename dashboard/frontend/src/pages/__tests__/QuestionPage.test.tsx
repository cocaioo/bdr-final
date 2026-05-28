import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import { QuestionPage } from '../QuestionPage'
import type { FilterState, MetaResponse, QuestionPayload } from '../../types'
import { fetchQuestion } from '../../api'

vi.mock('../../api', () => ({
  fetchQuestion: vi.fn(),
}))

vi.mock('../../components/ChartPanel', () => ({
  ChartPanel: () => <div data-testid="chart-panel">Grafico</div>,
}))

vi.mock('../../components/DataTablePanel', () => ({
  DataTablePanel: ({ table }: { table: { title: string } }) => (
    <div data-testid="table-panel">{table.title}</div>
  ),
}))

vi.mock('../../components/ExecutiveCards', () => ({
  ExecutiveCards: () => <div data-testid="executive-cards">Cards</div>,
}))

vi.mock('../../components/NoDataState', () => ({
  NoDataState: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('../../components/QueryDrawer', () => ({
  QueryDrawer: () => <div data-testid="query-drawer">SQL</div>,
}))

vi.mock('../../components/WarningBanner', () => ({
  WarningBanner: () => null,
}))

vi.mock('../../components/WordCloudGrid', () => ({
  WordCloudGrid: () => <div data-testid="wordcloud-grid">Nuvens</div>,
}))

const fetchQuestionMock = vi.mocked(fetchQuestion)

const filters: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  search: '',
}

function buildMeta(questionId: string, title: string): MetaResponse {
  return {
    dataset_version: 'test-version',
    last_updated: '2026-05-26T12:00:00Z',
    legend: {},
    available_filters: {
      anos: [],
      eixos: [],
      partidos: [],
      ufs: [],
      deputados: [],
    },
    questions: [
      {
        id: questionId,
        title,
        route: `/q/${questionId}`,
        description: `Descricao ${questionId}`,
        chart_type: 'bar_horizontal',
        supported_filters: [],
      },
    ],
  }
}

const payload: QuestionPayload = {
  question_id: 'q1',
  title: 'Teste',
  description: 'Descricao',
  filters_supported: [],
  filters_applied: {},
  summary_cards: [],
  chart_spec: {
    type: 'bar_horizontal',
    title: 'Grafico',
    description: 'Descricao do grafico',
    categories: [],
    series: [],
    y_fields: [],
    options: {},
  },
  table_spec: {
    title: 'Tabela principal',
    columns: [],
    rows: [{ nome: 'Deputado A' }],
    total: 1,
    page: 1,
    page_size: 50,
    sort_dir: 'desc',
  },
  complement_tables: [],
  query_panel: {
    sql_path: 'sql/questoes-queries/q1.sql',
    sql_text: 'SELECT 1;',
    explanation: 'Teste',
  },
  warnings: [],
  empty_state: {
    is_empty: false,
    message: '',
  },
  dataset_version: 'test-version',
  generated_at: '2026-05-26T12:00:00Z',
}

function renderQuestionPage(meta: MetaResponse, route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/q/:questionId" element={<QuestionPage meta={meta} filters={filters} />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuestionPage', () => {
  beforeEach(() => {
    fetchQuestionMock.mockReset()
  })

  it('keeps Q1 table visible without rendering the chart', async () => {
    fetchQuestionMock.mockResolvedValue(payload)

    renderQuestionPage(buildMeta('q1', 'Gastos por deputado'), '/q/q1')

    expect(await screen.findByTestId('table-panel')).toHaveTextContent('Tabela principal')
    expect(screen.queryByTestId('chart-panel')).not.toBeInTheDocument()
  })

  it('renders Q2 word clouds and analytical table', async () => {
    fetchQuestionMock.mockResolvedValue({
      ...payload,
      question_id: 'q2',
      chart_spec: {
        type: 'wordcloud_images',
        title: 'Nuvens de palavras por ano',
        description: 'Descricao do grafico',
        categories: [],
        series: [],
        y_fields: [],
        options: {
          images: [{ year: 2023, src: '/wordclouds/q2_nuvem_palavras_2023.svg' }],
        },
      },
    })

    renderQuestionPage(buildMeta('q2', 'Eixos e nuvem de palavras'), '/q/q2')

    expect(await screen.findByTestId('wordcloud-grid')).toBeInTheDocument()
    expect(screen.getByTestId('table-panel')).toHaveTextContent('Tabela principal')
    expect(screen.queryByTestId('chart-panel')).not.toBeInTheDocument()
  })

  it('loads Q7 like a regular enabled question', async () => {
    fetchQuestionMock.mockResolvedValue({ ...payload, question_id: 'q7' })

    renderQuestionPage(buildMeta('q7', 'Indice de custo-beneficio'), '/q/q7')

    expect(await screen.findByTestId('chart-panel')).toBeInTheDocument()
    expect(screen.getByTestId('table-panel')).toHaveTextContent('Tabela principal')
  })
})
