import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DataTablePanel } from '../components/DataTablePanel'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { NoDataState } from '../components/NoDataState'
import { QueryDrawer } from '../components/QueryDrawer'
import { WarningBanner } from '../components/WarningBanner'
import { WordCloudGrid } from '../components/WordCloudGrid'
import type { FilterState, MetaResponse, QuestionPayload, TableState } from '../types'
import { isQuestionEnabled, isQuestionHidden } from '../utils/questionAvailability'
import { formatCellValue } from '../utils/format'

interface QuestionPageProps {
  meta: MetaResponse
  filters: FilterState
  onFiltersChange?: (next: FilterState) => void
}

const DEFAULT_TABLE_STATE: TableState = {
  page: 1,
  pageSize: 50,
  sortDir: 'desc',
}

function sortYears(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const numA = Number(a)
    const numB = Number(b)
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB
    }
    return a.localeCompare(b)
  })
}

export function QuestionPage({ meta, filters, onFiltersChange }: QuestionPageProps) {
  const { questionId } = useParams()
  const questionMeta = useMemo(
    () => meta.questions.find((question) => question.id === questionId),
    [meta.questions, questionId],
  )
  const isHiddenQuestion = Boolean(questionMeta && isQuestionHidden(questionMeta.id))
  const isEnabledQuestion = isQuestionEnabled(questionMeta?.id)
  const isUnderDevelopment = Boolean(questionMeta && !isEnabledQuestion)

  const [tableState, setTableState] = useState<TableState>(DEFAULT_TABLE_STATE)
  const [payload, setPayload] = useState<QuestionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetailedData, setShowDetailedData] = useState(false)

  useEffect(() => {
    setTableState(DEFAULT_TABLE_STATE)
    setShowDetailedData(false)
  }, [questionId])

  useEffect(() => {
    if (!questionMeta || isHiddenQuestion || isUnderDevelopment) {
      setPayload(null)
      setLoading(false)
      setError(null)
      return
    }
    let mounted = true
    setLoading(true)
    setError(null)
    fetchQuestion(questionMeta.id, filters, tableState, questionMeta.supported_filters)
      .then((result) => {
        if (!mounted) return
        setPayload(result)
      })
      .catch((cause: Error) => {
        if (!mounted) return
        setError(cause.message)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [questionMeta, isHiddenQuestion, isUnderDevelopment, filters, tableState])

  const yearLegend = useMemo(() => {
    if (!questionMeta || questionMeta.id.toLowerCase() !== 'q3') return []
    const fromSpec = payload?.chart_spec?.options?.year_order
    if (Array.isArray(fromSpec) && fromSpec.length > 0) {
      return fromSpec.map((value) => String(value))
    }
    const selectedYears = filters.anos.length
      ? filters.anos
      : meta.available_filters.anos.map((item) => item.value)
    const normalized = selectedYears.map((value) => value.trim()).filter(Boolean)
    return sortYears(normalized)
  }, [filters.anos, meta.available_filters.anos, payload, questionMeta])

  if (!questionMeta) {
    return (
      <main className="question-page">
        <NoDataState message="Pergunta nao encontrada no registro." />
      </main>
    )
  }

  if (isHiddenQuestion) {
    return (
      <main className="question-page">
        <NoDataState message="Pergunta nao encontrada no registro." />
      </main>
    )
  }

  if (isUnderDevelopment) {
    return (
      <main className="question-page">
        <section className="question-intro stagger-item">
          <h1>
            {questionMeta.id.toUpperCase()} - {questionMeta.title}
          </h1>
          <p>{questionMeta.description}</p>
        </section>

        <section className="maintenance-state stagger-item" aria-live="polite">
          <p className="maintenance-mark">X</p>
          <p className="maintenance-text">Esta questao ainda esta em desenvolvimento.</p>
        </section>
      </main>
    )
  }

  if (loading && !payload) {
    return (
      <main className="question-page">
        <p className="loading">Carregando dados...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="question-page">
        <NoDataState message={`Falha ao carregar dados: ${error}`} />
      </main>
    )
  }

  if (!payload) {
    return (
      <main className="question-page">
        <NoDataState message="Nenhum payload recebido da API." />
      </main>
    )
  }

  const isQ8 = questionMeta.id.toLowerCase() === 'q8'
  const isQ2 = questionMeta.id.toLowerCase() === 'q2'
  const isQ11 = questionMeta.id.toLowerCase() === 'q11'
  const isQ3 = questionMeta.id.toLowerCase() === 'q3'
  const hasWordClouds = isQ2 || isQ11
  const shouldShowChart = !hasWordClouds
  const tableStateView = isQ8 ? { ...tableState, pageSize: 50 } : tableState
  const mainTable = isQ8 ? { ...payload.table_spec, title: 'Tabela principal' } : payload.table_spec
  const complementTables = payload.complement_tables
  const handleTableChange = (next: TableState) => {
    if (isQ8) {
      setTableState({ ...next, pageSize: 50 })
      return
    }
    setTableState(next)
  }
  return (
    <main className="question-page">
      <section className="question-intro stagger-item">
        <h1>
          {questionMeta.id.toUpperCase()} - {questionMeta.title}
        </h1>
        <p>{questionMeta.description}</p>
      </section>

      <WarningBanner warnings={payload.warnings} />
      {!hasWordClouds && !isQ3 ? (
        <ExecutiveCards
          cards={
            questionMeta.id.toLowerCase() === 'q4'
              ? payload.summary_cards.filter((c) => c.unit !== 'contagem')
              : payload.summary_cards
          }
        />
      ) : null}

      {isQ2 && filters.eixos.length > 0 && (
        <div className="active-filter-banner stagger-item">
          <span>
            Filtrado por Tema: <strong>{filters.eixos[0]}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              if (onFiltersChange) {
                onFiltersChange({ ...filters, eixos: [] })
              }
            }}
          >
            Limpar Filtro
          </button>
        </div>
      )}

      {payload.empty_state.is_empty ? (
        <NoDataState message={payload.empty_state.message} />
      ) : isQ3 ? (
        <>
          <section className="q3-methodology stagger-item">
            <p>
              Os eixos tematicos sao inferidos a partir dos textos das proposicoes e objetos
              associados a votacao. Cada voto nominal e contado uma unica vez.
            </p>
          </section>
          {shouldShowChart ? (
            <ChartPanel
              spec={payload.chart_spec}
              activeFilters={undefined}
              onBarClick={undefined}
            />
          ) : null}
        </>
      ) : (
        <>
          {isQ2 ? (
            <WordCloudGrid 
              spec={payload.chart_spec} 
              selectedTheme={filters.eixos[0] || null}
              onWordClick={(word) => {
                if (onFiltersChange) {
                  onFiltersChange({ ...filters, eixos: [word] })
                }
              }}
            />
          ) : null}
          {shouldShowChart ? (
            <>
              <ChartPanel
                spec={payload.chart_spec}
                yearLabels={yearLegend}
                activeFilters={undefined}
                onBarClick={undefined}
              />
              {payload.chart_spec.options?.second_chart && (
                <ChartPanel
                  spec={payload.chart_spec.options.second_chart as any}
                  yearLabels={yearLegend}
                  activeFilters={filters}
                  onBarClick={
                    questionMeta.id.toLowerCase() === 'q4'
                      ? (category) => {
                          if (!onFiltersChange) return
                          const current = filters.partidos || []
                          const next = current.includes(category)
                            ? current.filter((item) => item !== category)
                            : [...current, category]
                          onFiltersChange({
                            ...filters,
                            partidos: next,
                          })
                        }
                      : undefined
                  }
                />
              )}
            </>
          ) : null}
          {isQ2 && (
            filters.eixos.length > 0 ? (
              <section className="deputies-grid-section stagger-item">
                <h2>Atuação no Eixo: {filters.eixos[0]}</h2>
                <div className="deputies-card-grid" data-testid="deputies-cards-grid">
                  {payload.table_spec.rows.map((row: any) => (
                    <article className="deputy-card" key={`${row.id_deputado}-${row.tema}-${row.sigla_partido}-${row.ano_dados || ''}`} data-testid="deputy-card">
                      <div className="deputy-card-header">
                        <h3>{row.nome}</h3>
                        <p className="deputy-civil-name">{row.nome_civil}</p>
                        <span className="deputy-badge">
                          {row.sigla_partido} / {row.sigla_uf}
                        </span>
                      </div>
                      <div className="deputy-card-body">
                        <div className="deputy-metric">
                          <span className="metric-label">Proposições:</span>
                          <span className="metric-value">{row.qtd_proposicoes}</span>
                        </div>
                        <div className="deputy-specialization">
                          <span className="specialization-label">Principal Eixo:</span>
                          <span className="specialization-value">{row.tema_mais_atuante_deputado}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <div className="q2-empty-selection stagger-item">
                <p>Selecione um tema na nuvem de palavras ou no painel de filtros para visualizar a atuação dos deputados.</p>
              </div>
            )
          )}
        </>
      )}

      {isQ11 ? (
        <WordCloudGrid 
          spec={payload.chart_spec} 
          selectedTheme={null}
          onWordClick={() => {}}
        />
      ) : null}

      {/* Seção recolhível de Dados Detalhados */}
      {!payload.empty_state.is_empty && ((!isQ2 && mainTable) || complementTables.length > 0) ? (
        <section className="stagger-item detailed-data-section">
          <button
            type="button"
            className="toggle-detailed-data-btn"
            onClick={() => setShowDetailedData(!showDetailedData)}
          >
            {showDetailedData ? '▲ Ocultar Dados Detalhados' : '▼ Visualizar Dados Detalhados (Tabelas)'}
          </button>
          
          <div className={`detailed-data-content stagger-item${showDetailedData ? '' : ' hidden'}`}>
              {!isQ2 && (
                <DataTablePanel
                  table={mainTable}
                  state={tableStateView}
                  onChange={handleTableChange}
                  lockPageSize={isQ8}
                  compact={isQ3}
                />
              )}
              
              {complementTables
                .filter((table) => !table.title.toLowerCase().includes('complementar'))
                .map((table) => (
                  table.title.toLowerCase().includes('ranking global') ? (
                    <DataTablePanel
                      key={table.title}
                      table={table}
                      state={tableStateView}
                      onChange={handleTableChange}
                    />
                  ) : (
                    <section key={table.title} className="complement-section">
                      <h2>{table.title}</h2>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              {table.columns.map((column) => (
                                <th key={column.key}>{column.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.slice(0, 30).map((row, rowIndex) => (
                              <tr key={`${table.title}-${rowIndex}`}>
                                {table.columns.map((column) => (
                                  <td key={`${column.key}-${rowIndex}`}>{formatCellValue(row[column.key])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                ))}
            </div>
        </section>
      ) : null}

      <QueryDrawer panel={payload.query_panel} />
    </main>
  )
}

