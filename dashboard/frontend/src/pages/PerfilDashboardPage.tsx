import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { NoDataState } from '../components/NoDataState'
import type {
  ChartSpec,
  FilterState,
  MetaResponse,
  QuestionPayload,
  SummaryCard,
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

function rowLabel(row: DataRow): string {
  return String(row.escolaridade ?? 'Nao informado')
}

function tableWithMetric(payload: QuestionPayload, metric: string): TableSpec | undefined {
  return payload.complement_tables.find((table) =>
    table.columns.some((column) => column.key === metric),
  )
}

function metricRows(
  payload: QuestionPayload,
  metric: string,
  selectedYear: string,
): DataRow[] {
  if (selectedYear) return payload.table_spec.rows
  return tableWithMetric(payload, metric)?.rows ?? []
}

function buildMetricChart(
  payload: QuestionPayload,
  metric: string,
  selectedYear: string,
  title: string,
  description: string,
  seriesName: string,
): ChartSpec {
  const rows = metricRows(payload, metric, selectedYear)
    .filter((row) => row[metric] !== null && row[metric] !== undefined)
    .sort((a, b) => numberValue(a[metric]) - numberValue(b[metric]))

  return {
    type: 'bar_horizontal',
    title,
    description,
    x_field: metric,
    y_fields: [metric],
    categories: rows.map(rowLabel),
    series: [{ name: seriesName, data: rows.map((row) => numberValue(row[metric])) }],
    options: {},
  }
}

function buildPresenceChart(payload: QuestionPayload, selectedYear: string): ChartSpec {
  let rows: DataRow[]

  if (selectedYear) {
    rows = payload.table_spec.rows
  } else {
    const eventRows = tableWithMetric(payload, 'media_presenca_eventos')?.rows ?? []
    const plenaryRows = tableWithMetric(payload, 'media_presenca_plenario')?.rows ?? []
    const plenaryByEducation = new Map(
      plenaryRows.map((row) => [rowLabel(row), numberValue(row.media_presenca_plenario)]),
    )
    rows = eventRows.map((row) => ({
      ...row,
      media_presenca_plenario: plenaryByEducation.get(rowLabel(row)) ?? 0,
    }))
  }

  const sortedRows = [...rows].sort(
    (a, b) => numberValue(a.media_presenca_eventos) - numberValue(b.media_presenca_eventos),
  )

  return {
    type: 'bar_horizontal',
    title: 'Média de presenças',
    description:
      'Média de registros de presença em eventos e em atividades identificadas como plenário.',
    x_field: 'escolaridade',
    y_fields: ['media_presenca_eventos', 'media_presenca_plenario'],
    categories: sortedRows.map(rowLabel),
    series: [
      {
        name: 'Eventos',
        data: sortedRows.map((row) => numberValue(row.media_presenca_eventos)),
      },
      {
        name: 'Plenário',
        data: sortedRows.map((row) => numberValue(row.media_presenca_plenario)),
      },
    ],
    options: {},
  }
}

function buildEducationChart(payload: QuestionPayload, selectedEducation: string): ChartSpec {
  const rows = payload.table_spec.rows
    .filter((row) => !selectedEducation || rowLabel(row) === selectedEducation)
    .sort((a, b) => numberValue(b.qtd_deputados) - numberValue(a.qtd_deputados))

  return {
    type: 'bar_vertical',
    title: 'Distribuição de escolaridade',
    description: 'Quantidade de deputados por nível de escolaridade na 57ª Legislatura.',
    x_field: 'escolaridade',
    y_fields: ['qtd_deputados'],
    categories: rows.map(rowLabel),
    series: [
      { name: 'Deputados', data: rows.map((row) => numberValue(row.qtd_deputados)) },
    ],
    options: {},
  }
}

function etaTable(payload: QuestionPayload): TableSpec | undefined {
  return payload.complement_tables.find((table) =>
    table.columns.some((column) => column.key === 'eta_quadrado'),
  )
}

export function PerfilDashboardPage({ meta }: PerfilDashboardPageProps) {
  const q4Meta = meta.questions.find((question) => question.id === 'q4')
  const q6Meta = meta.questions.find((question) => question.id === 'q6')
  const filterCatalog = meta.available_filters

  const [selectedYear, setSelectedYear] = useState('')
  const [selectedEducation, setSelectedEducation] = useState('')
  const [selectedParty, setSelectedParty] = useState('')
  const [q4Payload, setQ4Payload] = useState<QuestionPayload | null>(null)
  const [q6Payload, setQ6Payload] = useState<QuestionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q4Meta || !q6Meta) return undefined

    let active = true
    const sharedState: FilterState = {
      anos: selectedYear ? [selectedYear] : [],
      eixos: [],
      partidos: selectedParty ? [selectedParty] : [],
      ufs: [],
      deputados: [],
      escolaridade: selectedEducation ? [selectedEducation] : [],
      search: '',
    }

    Promise.all([
      fetchQuestion('q4', sharedState, TABLE_STATE, q4Meta.supported_filters),
      fetchQuestion('q6', sharedState, TABLE_STATE, q6Meta.supported_filters),
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
  }, [q4Meta, q6Meta, selectedEducation, selectedParty, selectedYear])

  const years = useMemo(
    () => [...filterCatalog.anos].sort((a, b) => Number(a.value) - Number(b.value)),
    [filterCatalog.anos],
  )

  const charts = useMemo(() => {
    if (!q4Payload || !q6Payload) return null
    const education = buildEducationChart(q4Payload, selectedEducation)
    const party = q4Payload.chart_spec.options?.second_chart as ChartSpec | undefined

    return {
      education,
      party,
      expenses: buildMetricChart(
        q6Payload,
        'media_gasto',
        selectedYear,
        'Gasto médio por escolaridade',
        'Valor médio de gastos parlamentares por registro deputado-ano, em reais.',
        'Gasto médio (R$)',
      ),
      fidelity: buildMetricChart(
        q6Payload,
        'media_fidelidade',
        selectedYear,
        'Fidelidade partidária média',
        'Percentual médio de votos coincidentes com orientações partidárias válidas.',
        'Fidelidade (%)',
      ),
      proposals: buildMetricChart(
        q6Payload,
        'media_proposicoes',
        selectedYear,
        'Média de proposições',
        'Quantidade média de proposições de autoria por registro deputado-ano.',
        'Proposições',
      ),
      presence: buildPresenceChart(q6Payload, selectedYear),
    }
  }, [q4Payload, q6Payload, selectedEducation, selectedYear])

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!q4Payload || !q6Payload || !charts) return []
    const totalDeputies = q4Payload.summary_cards.find((card) => card.id === 'total_deputados')
    const associationRows = etaTable(q6Payload)?.rows ?? []
    const strongestAssociation = [...associationRows].sort(
      (a, b) => numberValue(b.eta_quadrado) - numberValue(a.eta_quadrado),
    )[0]
    const period = selectedYear || (years.length ? `${years[0].value}–${years.at(-1)?.value}` : '-')

    return [
      {
        id: 'perfil_total_deputados',
        label: 'Deputados no recorte',
        value: totalDeputies?.value ?? '0',
        unit: 'deputados',
      },
      {
        id: 'perfil_niveis',
        label: 'Níveis de escolaridade',
        value: String(charts.education.categories.length),
        unit: 'categorias',
      },
      {
        id: 'perfil_periodo',
        label: 'Período da atividade',
        value: period,
      },
      {
        id: 'perfil_eta',
        label: 'Maior associação (η²)',
        value: strongestAssociation
          ? numberValue(strongestAssociation.eta_quadrado).toLocaleString('pt-BR', {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            })
          : '-',
        unit: strongestAssociation ? String(strongestAssociation.interpretacao ?? '') : undefined,
      },
    ]
  }, [charts, q4Payload, q6Payload, selectedYear, years])

  if (!q4Meta || !q6Meta) {
    return (
      <main className="perfil-dashboard">
        <NoDataState message="As questões Q4 e Q6 não estão disponíveis no registro." />
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
        <NoDataState message="Não há dados de Q4 e Q6 disponíveis." />
      </main>
    )
  }

  const activeFilters: FilterState = {
    anos: selectedYear ? [selectedYear] : [],
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
          <span className="perfil-eyebrow">Q4 + Q6</span>
          <h1>Escolaridade e Perfil</h1>
          <p>
            Distribuição educacional da 57ª Legislatura e associações exploratórias com
            indicadores de atividade parlamentar.
          </p>
        </div>
        <div className="perfil-question-links" aria-label="Questões de origem">
          <Link to="/q/q4">Abrir Q4</Link>
          <Link to="/q/q6">Abrir Q6</Link>
        </div>
      </section>

      <section className="perfil-filter-panel stagger-item" aria-label="Filtros do bloco de perfil">
        <div className="perfil-filter-heading">
          <div>
            <h2>Recorte da análise</h2>
            <p>Ano afeta Q6; partido afeta Q4; escolaridade é compartilhada pelas duas questões.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setError(null)
              setSelectedYear('')
              setSelectedEducation('')
              setSelectedParty('')
            }}
            disabled={!selectedYear && !selectedEducation && !selectedParty}
          >
            Limpar filtros
          </button>
        </div>
        <div className="perfil-filter-grid">
          <label>
            Ano da atividade (Q6)
            <select
              value={selectedYear}
              onChange={(event) => {
                setLoading(true)
                setError(null)
                setSelectedYear(event.target.value)
              }}
            >
              <option value="">Período completo</option>
              {years.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
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
          <label>
            Partido (Q4)
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
        </div>
        {loading ? <span className="perfil-updating">Atualizando recorte...</span> : null}
      </section>

      <ExecutiveCards cards={summaryCards} />

      <section className="perfil-section-heading stagger-item">
        <span>Q4</span>
        <div>
          <h2>Quem compõe a legislatura</h2>
          <p>Distribuição geral e composição educacional dos partidos.</p>
        </div>
      </section>
      <div className="perfil-chart-grid perfil-chart-grid-q4">
        <ChartPanel spec={charts.education} activeFilters={activeFilters} />
        {charts.party ? <ChartPanel spec={charts.party} activeFilters={activeFilters} /> : null}
      </div>

      <section className="perfil-methodology stagger-item">
        <strong>Como ler a Q6</strong>
        <p>
          As comparações abaixo descrevem médias agregadas por escolaridade. Elas apontam
          associação, não causalidade. Diferenças de tamanho dos grupos e de cobertura anual
          devem ser consideradas na interpretação.
        </p>
      </section>

      <section className="perfil-section-heading stagger-item">
        <span>Q6</span>
        <div>
          <h2>Escolaridade e atividade parlamentar</h2>
          <p>Cada indicador usa sua própria escala para preservar a leitura.</p>
        </div>
      </section>
      <div className="perfil-chart-grid">
        <ChartPanel spec={charts.expenses} />
        <ChartPanel spec={charts.fidelity} />
        <ChartPanel spec={charts.proposals} />
        <ChartPanel spec={charts.presence} />
      </div>

      <section className="perfil-source-note stagger-item">
        <p>
          Presenças são médias de registros, e não percentuais de comparecimento, porque os
          artefatos atuais não fornecem o total de sessões elegíveis como denominador.
        </p>
        <div>
          <Link to="/q/q4">Ver dados e SQL da Q4</Link>
          <Link to="/q/q6">Ver dados, η² e SQL da Q6</Link>
        </div>
      </section>
    </main>
  )
}
