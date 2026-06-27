import { useEffect, useMemo, useState } from 'react'

import { fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { NoDataState } from '../components/NoDataState'
import type {
  ChartSpec,
  FilterState,
  MetaResponse,
  QuestionPayload,
  TableSpec,
} from '../types'

interface PerfilDashboardPageProps {
  meta: MetaResponse
}

type DataRow = Record<string, unknown>

const TABLE_STATE = {
  page: 1,
  pageSize: 200,
  sortDir: 'desc' as const,
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundedNumberValue(value: unknown): number {
  return Math.round(numberValue(value))
}

function rowLabel(row: DataRow): string {
  return String(row.escolaridade ?? 'Nao informado')
}

function tableWithMetric(payload: QuestionPayload, metric: string): TableSpec | undefined {
  return payload.complement_tables.find((table) =>
    table.columns.some((column) => column.key === metric),
  )
}

function metricRows(payload: QuestionPayload, metric: string): DataRow[] {
  return tableWithMetric(payload, metric)?.rows ?? []
}

function buildMetricChart(
  payload: QuestionPayload,
  metric: string,
  title: string,
  description: string,
  seriesName: string,
  currency = false,
): ChartSpec | null {
  const rows = metricRows(payload, metric)
    .filter((row) => row[metric] !== null && row[metric] !== undefined)
    .sort((a, b) => numberValue(a[metric]) - numberValue(b[metric]))

  if (!rows.length) return null

  return {
    type: 'bar_horizontal',
    title,
    description,
    x_field: metric,
    y_fields: [metric],
    categories: rows.map(rowLabel),
    series: [
      {
        name: seriesName,
        data: rows.map((row) => (currency ? numberValue(row[metric]) : roundedNumberValue(row[metric]))),
      },
    ],
    options: {
      bar_category_gap: '34%',
      bar_max_width: 18,
      chart_height: 420,
      compact_axis: currency,
      compact_tooltip: currency,
      currency,
      grid_bottom: 52,
      grid_left: 184,
      grid_right: 28,
      label_max_chars: 24,
      label_width: 170,
      show_legend: false,
    },
  }
}

function buildPresenceChart(payload: QuestionPayload): ChartSpec | null {
  const eventRows = tableWithMetric(payload, 'media_presenca_eventos')?.rows ?? []
  const plenaryRows = tableWithMetric(payload, 'media_presenca_plenario')?.rows ?? []
  const plenaryByEducation = new Map(
    plenaryRows.map((row) => [rowLabel(row), roundedNumberValue(row.media_presenca_plenario)]),
  )
  const rows: DataRow[] = eventRows.map((row) => ({
    ...row,
    media_presenca_plenario: plenaryByEducation.get(rowLabel(row)) ?? 0,
  }))

  if (!rows.length) return null

  const sortedRows = [...rows].sort(
    (a, b) => numberValue(a.media_presenca_eventos) - numberValue(b.media_presenca_eventos),
  )

  return {
    type: 'bar_horizontal',
    title: 'Presença média por escolaridade',
    description:
      'Média anual de registros de presença. "Todos os eventos" inclui reuniões de comissão e demais sessões oficiais, enquanto "Atividades de plenário" restringe-se estritamente às votações no Plenário Principal da Câmara.',
    x_field: 'escolaridade',
    y_fields: ['media_presenca_eventos', 'media_presenca_plenario'],
    categories: sortedRows.map(rowLabel),
    series: [
      {
        name: 'Todos os eventos',
        data: sortedRows.map((row) => roundedNumberValue(row.media_presenca_eventos)),
      },
      {
        name: 'Atividades de plenário',
        data: sortedRows.map((row) => roundedNumberValue(row.media_presenca_plenario)),
      },
    ],
    options: {
      bar_category_gap: '34%',
      bar_max_width: 18,
      chart_height: 420,
      grid_bottom: 52,
      grid_left: 184,
      grid_right: 28,
      label_max_chars: 24,
      label_width: 170,
      show_legend: true,
    },
  }
}

function buildEducationChart(payload: QuestionPayload, selectedEducation: string): ChartSpec {
  const rows = payload.table_spec.rows
    .filter((row) => !selectedEducation || rowLabel(row) === selectedEducation)
    .sort((a, b) => numberValue(b.qtd_deputados) - numberValue(a.qtd_deputados))

  return {
    type: 'bar_vertical',
    title: 'Escolaridade dos deputados',
    description: 'Quantidade de deputados por nível de escolaridade na 57ª Legislatura.',
    x_field: 'escolaridade',
    y_fields: ['qtd_deputados'],
    categories: rows.map(rowLabel),
    series: [
      { name: 'Deputados', data: rows.map((row) => numberValue(row.qtd_deputados)) },
    ],
    options: { chart_height: 480 },
  }
}

function deputyListRows(
  payload: QuestionPayload,
  selectedEducation: string,
  selectedParty: string,
): DataRow[] {
  const deputyTable = payload.complement_tables.find((table) => {
    const columns = new Set(table.columns.map((column) => column.key))
    return columns.has('id_deputado') && columns.has('nome')
  })

  if (!deputyTable) return []

  return deputyTable.rows
    .filter((row) => {
      const matchesEducation = !selectedEducation || rowLabel(row) === selectedEducation
      const partyValue = String(row.sigla_partido ?? '').trim()
      const matchesParty = !selectedParty || !partyValue || partyValue === selectedParty
      return matchesEducation && matchesParty
    })
    .sort((a, b) =>
      String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR', { sensitivity: 'base' }),
    )
}

export function PerfilDashboardPage({ meta }: PerfilDashboardPageProps) {
  const q4Meta = meta.questions.find((question) => question.id === 'q4')
  const q6Meta = meta.questions.find((question) => question.id === 'q6')
  const filterCatalog = meta.available_filters

  const [selectedEducation, setSelectedEducation] = useState('')
  const [selectedParty, setSelectedParty] = useState('')
  const [q4Payload, setQ4Payload] = useState<QuestionPayload | null>(null)
  const [q6Payload, setQ6Payload] = useState<QuestionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q4Meta || !q6Meta) return undefined

    let active = true
    const q4State: FilterState = {
      anos: [],
      eixos: [],
      partidos: selectedParty ? [selectedParty] : [],
      ufs: [],
      deputados: [],
      escolaridade: selectedEducation ? [selectedEducation] : [],
      search: '',
    }
    const q6State: FilterState = {
      anos: [],
      eixos: [],
      partidos: [],
      ufs: [],
      deputados: [],
      escolaridade: selectedEducation ? [selectedEducation] : [],
      search: '',
    }
    const q6SupportedFilters = q6Meta.supported_filters.filter((filter) => filter !== 'anos')

    Promise.all([
      fetchQuestion('q4', q4State, TABLE_STATE, q4Meta.supported_filters),
      fetchQuestion('q6', q6State, TABLE_STATE, q6SupportedFilters),
    ])
      .then(([q4, q6]) => {
        if (!active) return
        setQ4Payload(q4)
        setQ6Payload(q6)
      })
      .catch((cause: Error) => {
        if (!active) return
        setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [q4Meta, q6Meta, selectedEducation, selectedParty])

  const charts = useMemo(() => {
    if (!q4Payload || !q6Payload) return null
    const education = buildEducationChart(q4Payload, selectedEducation)
    const partySource = q4Payload.chart_spec.options?.second_chart as ChartSpec | undefined
    const party = partySource
      ? {
          ...partySource,
          title: 'Escolaridade por partido',
          description: 'Composição dos partidos por nível de escolaridade declarado.',
          options: {
            ...partySource.options,
            legend_bottom: true,
            bar_max_width: 40,
            chart_height: 620,
          },
        }
      : undefined

    return {
      education,
      party,
      expenses: buildMetricChart(
        q6Payload,
        'media_gasto',
        'Gasto médio anual por escolaridade',
        'Para cada deputado, calcula-se a média anual dos anos com gasto positivo; depois essas médias individuais são agrupadas por escolaridade.',
        'Gasto médio (R$)',
        true,
      ),
      fidelity: buildMetricChart(
        q6Payload,
        'media_fidelidade',
        'Coincidência com a orientação partidária',
        'Percentual médio de votos que coincidem com orientações partidárias válidas.',
        'Coincidência (%)',
      ),
      proposals: buildMetricChart(
        q6Payload,
        'media_proposicoes',
        'Produção legislativa média por escolaridade',
        'Média anual de proposições de autoria por deputado, agrupada por escolaridade.',
        'Proposições por ano',
      ),
      presence: buildPresenceChart(q6Payload),
    }
  }, [q4Payload, q6Payload, selectedEducation])

  const filteredDeputies = useMemo(() => {
    if (!q4Payload) return []
    return deputyListRows(q4Payload, selectedEducation, selectedParty)
  }, [q4Payload, selectedEducation, selectedParty])

  if (!q4Meta || !q6Meta) {
    return (
      <main className="perfil-dashboard">
        <NoDataState message="Os dados necessários para este painel não estão disponíveis." />
      </main>
    )
  }

  if (loading && (!q4Payload || !q6Payload)) {
    return (
      <main className="perfil-dashboard">
        <p className="loading">Carregando o bloco de escolaridade e perfil...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="perfil-dashboard">
        <NoDataState message={`Falha ao carregar o bloco de perfil: ${error}`} />
      </main>
    )
  }

  if (!q4Payload || !q6Payload || !charts) {
    return (
      <main className="perfil-dashboard">
        <NoDataState message="Não há dados de escolaridade e atividade parlamentar disponíveis." />
      </main>
    )
  }

  const activeFilters: FilterState = {
    anos: [],
    eixos: [],
    partidos: selectedParty ? [selectedParty] : [],
    ufs: [],
    deputados: [],
    escolaridade: selectedEducation ? [selectedEducation] : [],
    search: '',
  }

  return (
    <main className="perfil-dashboard">
      <section className="perfil-hero stagger-item">
        <div>
          <span className="perfil-eyebrow">Visão integrada</span>
          <h1>Escolaridade e Perfil</h1>
          <p>
            Perfil educacional da 57ª Legislatura e comparação de indicadores de atividade
            parlamentar entre níveis de escolaridade.
          </p>
        </div>
      </section>

      <section className="perfil-filter-panel stagger-item" aria-label="Filtros do bloco de perfil">
        <div className="perfil-filter-heading">
          <div>
            <h2>Filtro global</h2>
            <p>A escolaridade continua sendo o único filtro compartilhado entre as duas seções.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setError(null)
              setSelectedEducation('')
              setSelectedParty('')
            }}
            disabled={!selectedEducation && !selectedParty}
          >
            Limpar filtros
          </button>
        </div>
        <div className="perfil-filter-grid">
          <div className="perfil-filter-group perfil-filter-group-shared">
            <span className="perfil-filter-scope">Filtro global</span>
            <p>Escolha uma escolaridade para comparar esse grupo em todos os gráficos.</p>
            <label>
              Escolaridade
              <select
                value={selectedEducation}
                onChange={(event) => {
                  setLoading(true)
                  setError(null)
                  setSelectedEducation(event.target.value)
                }}
              >
                <option value="">Todas as escolaridades</option>
                {filterCatalog.escolaridade.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {loading ? <span className="perfil-updating">Atualizando recorte...</span> : null}
      </section>

      <section className="perfil-section-heading stagger-item">
        <span aria-hidden="true">01</span>
        <div>
          <h2>Perfil educacional da legislatura</h2>
          <p>Distribuição dos deputados por escolaridade e composição educacional dos partidos.</p>
        </div>
      </section>
      <section className="perfil-section-toolbar stagger-item" aria-label="Filtro da seção de perfil">
        <div>
          <span className="perfil-filter-scope">Perfil da legislatura</span>
          <p>O partido altera somente os gráficos desta seção.</p>
        </div>
        <label>
          Partido
          <select
            value={selectedParty}
            onChange={(event) => {
              setLoading(true)
              setError(null)
              setSelectedParty(event.target.value)
            }}
          >
            <option value="">Todos os partidos</option>
            {filterCatalog.partidos.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="perfil-chart-grid perfil-chart-grid-q4">
        <ChartPanel spec={charts.education} activeFilters={activeFilters} />
        {charts.party ? <ChartPanel spec={charts.party} activeFilters={activeFilters} /> : null}
      </div>

      {selectedEducation || selectedParty ? (
        <section className="perfil-deputy-list stagger-item" aria-label="Deputados filtrados">
          <div className="perfil-deputy-list__header">
            <div>
              <h2>Deputados no recorte</h2>
              <p>
                Parlamentares identificados no recorte atual de escolaridade e partido.
              </p>
            </div>
            <strong>{filteredDeputies.length} nomes</strong>
          </div>
          {filteredDeputies.length ? (
            <div className="perfil-deputy-list__grid">
              {filteredDeputies.map((deputy) => (
                <article
                  key={String(deputy.id_deputado ?? deputy.nome)}
                  className="perfil-deputy-list__item"
                >
                  <strong>{String(deputy.nome ?? 'Nao informado')}</strong>
                  <span>
                    {rowLabel(deputy)}
                    {deputy.sigla_partido ? ` | ${String(deputy.sigla_partido)}` : ''}
                    {deputy.sigla_uf ? ` | ${String(deputy.sigla_uf)}` : ''}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="perfil-deputy-list__empty">
              Nenhum deputado foi encontrado para os filtros selecionados.
            </p>
          )}
        </section>
      ) : null}

      <section className="perfil-methodology stagger-item">
        <strong>Como interpretar</strong>
        <p>
          As comparações abaixo mostram médias agrupadas por escolaridade. Diferenças entre os
          grupos não provam que a escolaridade causou os resultados; o tamanho dos grupos e os
          anos com dados disponíveis também influenciam a leitura.
        </p>
      </section>

      <section className="perfil-section-heading stagger-item">
        <span aria-hidden="true">02</span>
        <div>
          <h2>Escolaridade e atividade parlamentar</h2>
          <p>Gastos, coincidência partidária, proposições e presenças são apresentados em escalas separadas.</p>
        </div>
      </section>
      <section className="perfil-section-toolbar perfil-section-toolbar-warning stagger-item" aria-label="Escopo da seção de atividade parlamentar">
        <div>
          <span className="perfil-filter-scope">Atividade parlamentar</span>
          <p>
            O filtro de ano foi removido desta subseção porque os arquivos locais desta análise trazem
            valores de produção legislativa incompatíveis em 2024 e 2025, o que tornava a leitura enganosa.
          </p>
        </div>
      </section>
      <div className="perfil-chart-grid">
        {charts.expenses ? <ChartPanel spec={charts.expenses} /> : <NoDataState message="Sem dados de gasto para a escolaridade selecionada." />}
        {charts.fidelity ? <ChartPanel spec={charts.fidelity} /> : <NoDataState message="Sem dados de fidelidade para a escolaridade selecionada." />}
        {charts.proposals ? <ChartPanel spec={charts.proposals} /> : <NoDataState message="Sem dados de produção legislativa para a escolaridade selecionada." />}
        {charts.presence ? <ChartPanel spec={charts.presence} /> : <NoDataState message="Sem dados de presença para a escolaridade selecionada." />}
      </div>

      <section className="perfil-source-note stagger-item">
        <p>
          Os valores de presença são médias anuais de registros, não percentuais de comparecimento.
          A base atual não informa o total de sessões em que cada deputado poderia comparecer.
        </p>
      </section>
    </main>
  )
}
