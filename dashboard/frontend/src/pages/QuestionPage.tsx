import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DataTablePanel } from '../components/DataTablePanel'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { NoDataState } from '../components/NoDataState'
import { QueryDrawer } from '../components/QueryDrawer'
import { WarningBanner } from '../components/WarningBanner'
import type { FilterState, MetaResponse, QuestionPayload, TableState } from '../types'
import { isQuestionEnabled } from '../utils/questionAvailability'
import { formatCellValue } from '../utils/format'

interface QuestionPageProps {
  meta: MetaResponse
  filters: FilterState
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

export function QuestionPage({ meta, filters }: QuestionPageProps) {
  const { questionId } = useParams()
  const questionMeta = useMemo(
    () => meta.questions.find((question) => question.id === questionId),
    [meta.questions, questionId],
  )
  const isEnabledQuestion = isQuestionEnabled(questionMeta?.id)
  const isUnderDevelopment = Boolean(questionMeta && !isEnabledQuestion)

  const [tableState, setTableState] = useState<TableState>(DEFAULT_TABLE_STATE)
  const [payload, setPayload] = useState<QuestionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTableState(DEFAULT_TABLE_STATE)
  }, [questionId])

  useEffect(() => {
    if (!questionMeta || isUnderDevelopment) {
      setPayload(null)
      setLoading(false)
      setError(null)
      return
    }
    let mounted = true
    setLoading(true)
    setError(null)
    fetchQuestion(questionMeta.id, filters, tableState)
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
  }, [questionMeta, isUnderDevelopment, filters, tableState])

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

  const isQ7 = questionMeta.id.toLowerCase() === 'q7'
  const isQ8 = questionMeta.id.toLowerCase() === 'q8'
  const tableStateView = isQ8 ? { ...tableState, pageSize: 50 } : tableState
  const mainTable = isQ8 ? { ...payload.table_spec, title: 'Tabela principal' } : payload.table_spec
  const complementTables = isQ8 ? [] : payload.complement_tables
  const handleTableChange = (next: TableState) => {
    if (isQ8) {
      setTableState({ ...next, pageSize: 50 })
      return
    }
    setTableState(next)
  }
  const q7FormulaCard = isQ7 ? (
    <>
      <h3>Formula do custo-beneficio</h3>
      <div className="formula-layout" aria-label="Formula da metrica de custo-beneficio">
        <p className="formula-heading">Beneficio =</p>
        <p>(qtd_proposicoes * 2)</p>
        <p>+</p>
        <p>(proposicoes_aprovadas * 3)</p>
        <p>+</p>
        <p>(presenca_total * 0.1)</p>
        <p className="formula-heading">Custo-beneficio =</p>
        <p>beneficio / gasto_total</p>
      </div>
    </>
  ) : null

  return (
    <main className="question-page">
      <section className="question-intro stagger-item">
        <h1>
          {questionMeta.id.toUpperCase()} - {questionMeta.title}
        </h1>
        <p>{questionMeta.description}</p>
      </section>

      <WarningBanner warnings={payload.warnings} />
      <ExecutiveCards cards={payload.summary_cards} extraCard={q7FormulaCard} />

      {payload.empty_state.is_empty ? (
        <NoDataState message={payload.empty_state.message} />
      ) : (
        <>
          <ChartPanel spec={payload.chart_spec} yearLabels={yearLegend} />
          <DataTablePanel
            table={mainTable}
            state={tableStateView}
            onChange={handleTableChange}
            lockPageSize={isQ8}
          />
        </>
      )}

      {complementTables.map((table) => (
        table.title.toLowerCase().includes('ranking global') ? (
          <DataTablePanel
            key={table.title}
            table={table}
            state={tableStateView}
            onChange={handleTableChange}
          />
        ) : (
          <section key={table.title} className="complement-section stagger-item">
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

      <QueryDrawer panel={payload.query_panel} />
    </main>
  )
}

