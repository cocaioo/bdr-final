import { useState, useEffect } from 'react'
import { fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DataTablePanel } from '../components/DataTablePanel'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { NoDataState } from '../components/NoDataState'
import { GlobalFilters } from '../components/GlobalFilters'
import type { FilterState, MetaResponse, QuestionPayload, TableState } from '../types'


const EMPTY_FILTER_STATE: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

interface GastosDashboardPageProps {
  meta: MetaResponse
}

export function GastosDashboardPage({ meta }: GastosDashboardPageProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE)
  // Configurações e estados de tabelas separados para cada bloco
  const [tableStates, setTableStates] = useState<Record<string, TableState>>({
    q1: { page: 1, pageSize: 10, sortDir: 'desc' },
    q5: { page: 1, pageSize: 10, sortDir: 'desc' },
    q7: { page: 1, pageSize: 10, sortDir: 'desc' },
    q12: { page: 1, pageSize: 10, sortDir: 'desc' },
    q13: { page: 1, pageSize: 10, sortDir: 'desc' },
  })

  // Estado de visibilidade individual de cada tabela
  const [showTables, setShowTables] = useState<Record<string, boolean>>({
    q1: false,
    q5: false,
    q7: false,
    q12: false,
    q13: false,
  })

  const [q1Data, setQ1Data] = useState<QuestionPayload | null>(null)
  const [q5Data, setQ5Data] = useState<QuestionPayload | null>(null)
  const [q7Data, setQ7Data] = useState<QuestionPayload | null>(null)
  const [q12Data, setQ12Data] = useState<QuestionPayload | null>(null)
  const [q13Data, setQ13Data] = useState<QuestionPayload | null>(null)

  const [loading, setLoading] = useState<Record<string, boolean>>({
    q1: false,
    q5: false,
    q7: false,
    q12: false,
    q13: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Carregamento independente de cada bloco
  const fetchBlock = (id: string, setData: (data: QuestionPayload) => void) => {
    const qMeta = meta.questions.find((q) => q.id === id)
    if (!qMeta) return

    setLoading((prev) => ({ ...prev, [id]: true }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    const supported = qMeta.supported_filters || []
    const tState = tableStates[id] || { page: 1, pageSize: 10, sortDir: 'desc' }

    fetchQuestion(id, filters, tState, supported)
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        setErrors((prev) => ({ ...prev, [id]: err.message }))
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, [id]: false }))
      })
  }

  // Efeitos reativos individuais por bloco e por tableState correspondente
  useEffect(() => {
    fetchBlock('q1', setQ1Data)
  }, [filters, tableStates.q1])

  useEffect(() => {
    fetchBlock('q5', setQ5Data)
  }, [filters, tableStates.q5])

  useEffect(() => {
    fetchBlock('q7', setQ7Data)
  }, [filters, tableStates.q7])

  useEffect(() => {
    fetchBlock('q12', setQ12Data)
  }, [filters, tableStates.q12])

  useEffect(() => {
    fetchBlock('q13', setQ13Data)
  }, [filters, tableStates.q13])

  const handleTableChange = (id: string, next: TableState) => {
    setTableStates((prev) => ({ ...prev, [id]: next }))
  }

  const toggleTable = (id: string) => {
    setShowTables((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const q7FormulaCard = (
    <>
      <h3>Fórmula do custo-benefício</h3>
      <div className="formula-layout" aria-label="Fórmula da métrica de custo-benefício">
        <p className="formula-heading">Benefício =</p>
        <p>(qtd_proposicoes * 2) + (proposicoes_aprovadas * 3) + (presenca_total * 0.1)</p>
        <p className="formula-heading">Custo-benefício =</p>
        <p>benefício / gasto_total</p>
      </div>
    </>
  )

  // Filtros suportados pelo grupo de Gastos
  const gastosSupportedFilters = ['anos', 'partidos', 'ufs', 'deputados']

  return (
    <main className="gastos-dashboard">
      <section className="hero-card stagger-item">
        <h1>Painel de Gastos e Fornecedores</h1>
        <p>
          Visão executiva consolidada das despesas parlamentares, fornecedores mais pagos,
          relação deputado-fornecedor e índice de custo-benefício estimado.
        </p>
      </section>

      {/* Painel de Filtros Interno */}
      <GlobalFilters
        catalog={meta.available_filters}
        value={filters}
        onChange={setFilters}
        supportedFilters={gastosSupportedFilters}
      />

      {/* Bloco 1: Visão Geral de Indicadores (SummaryCards de Q1/Q7) */}
      <section className="dashboard-section stagger-item">
        <h2>Visão Geral de Indicadores</h2>
        {loading.q1 && !q1Data ? (
          <p className="loading">Carregando indicadores...</p>
        ) : errors.q1 ? (
          <p className="error">Erro ao carregar indicadores: {errors.q1}</p>
        ) : q1Data ? (
          <ExecutiveCards cards={q1Data.summary_cards} />
        ) : (
          <NoDataState message="Nenhum dado disponível." />
        )}
      </section>

      <div className="dashboard-grid">
        {/* Bloco 2: Ranking de Gastos por Deputado */}
        <section className="dashboard-block stagger-item">
          <h2>Deputados que mais gastaram (Q1)</h2>
          {loading.q1 && !q1Data ? (
            <p className="loading">Carregando dados de gastos...</p>
          ) : errors.q1 ? (
            <p className="error">Erro: {errors.q1}</p>
          ) : q1Data ? (
            <>
              <ChartPanel spec={q1Data.chart_spec} />
              <div className="detailed-data-section">
                <button
                  type="button"
                  className="toggle-detailed-data-btn"
                  onClick={() => toggleTable('q1')}
                >
                  {showTables.q1 ? '▲ Ocultar dados detalhados' : '▼ Ver dados detalhados'}
                </button>
                <div className={`detailed-data-content${showTables.q1 ? '' : ' hidden'}`}>
                  <DataTablePanel
                    table={q1Data.table_spec}
                    state={tableStates.q1}
                    onChange={(next) => handleTableChange('q1', next)}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 3: Fornecedores com maior total pago */}
        <section className="dashboard-block stagger-item">
          <h2>Fornecedores com maior total pago (Q5)</h2>
          {loading.q5 && !q5Data ? (
            <p className="loading">Carregando dados de fornecedores...</p>
          ) : errors.q5 ? (
            <p className="error">Erro: {errors.q5}</p>
          ) : q5Data ? (
            <>
              <ChartPanel spec={q5Data.chart_spec} />
              <div className="detailed-data-section">
                <button
                  type="button"
                  className="toggle-detailed-data-btn"
                  onClick={() => toggleTable('q5')}
                >
                  {showTables.q5 ? '▲ Ocultar dados detalhados' : '▼ Ver dados detalhados'}
                </button>
                <div className={`detailed-data-content${showTables.q5 ? '' : ' hidden'}`}>
                  <DataTablePanel
                    table={q5Data.table_spec}
                    state={tableStates.q5}
                    onChange={(next) => handleTableChange('q5', next)}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 4: Índice de custo-benefício */}
        <section className="dashboard-block stagger-item">
          <h2>Índice de Custo-Benefício (Q7)</h2>
          {loading.q7 && !q7Data ? (
            <p className="loading">Carregando custo-benefício...</p>
          ) : errors.q7 ? (
            <p className="error">Erro: {errors.q7}</p>
          ) : q7Data ? (
            <>
              <ExecutiveCards
                cards={q7Data.summary_cards}
                extraCard={q7FormulaCard}
              />
              <ChartPanel spec={q7Data.chart_spec} />
              <div className="detailed-data-section">
                <button
                  type="button"
                  className="toggle-detailed-data-btn"
                  onClick={() => toggleTable('q7')}
                >
                  {showTables.q7 ? '▲ Ocultar dados detalhados' : '▼ Ver dados detalhados'}
                </button>
                <div className={`detailed-data-content${showTables.q7 ? '' : ' hidden'}`}>
                  <DataTablePanel
                    table={q7Data.table_spec}
                    state={tableStates.q7}
                    onChange={(next) => handleTableChange('q7', next)}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 5: Deputado x fornecedor */}
        <section className="dashboard-block stagger-item">
          <h2>Relação Deputado x Fornecedor (Q12)</h2>
          {loading.q12 && !q12Data ? (
            <p className="loading">Carregando relação...</p>
          ) : errors.q12 ? (
            <p className="error">Erro: {errors.q12}</p>
          ) : q12Data ? (
            <>
              <ChartPanel spec={q12Data.chart_spec} />
              <div className="detailed-data-section">
                <button
                  type="button"
                  className="toggle-detailed-data-btn"
                  onClick={() => toggleTable('q12')}
                >
                  {showTables.q12 ? '▲ Ocultar dados detalhados' : '▼ Ver dados detalhados'}
                </button>
                <div className={`detailed-data-content${showTables.q12 ? '' : ' hidden'}`}>
                  <DataTablePanel
                    table={q12Data.table_spec}
                    state={tableStates.q12}
                    onChange={(next) => handleTableChange('q12', next)}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 6: Categorias de gasto por deputado */}
        <section className="dashboard-block stagger-item">
          <h2>Categorias de Gasto por Deputado (Q13)</h2>
          {loading.q13 && !q13Data ? (
            <p className="loading">Carregando categorias...</p>
          ) : errors.q13 ? (
            <p className="error">Erro: {errors.q13}</p>
          ) : q13Data ? (
            <>
              <ChartPanel spec={q13Data.chart_spec} />
              <div className="detailed-data-section">
                <button
                  type="button"
                  className="toggle-detailed-data-btn"
                  onClick={() => toggleTable('q13')}
                >
                  {showTables.q13 ? '▲ Ocultar dados detalhados' : '▼ Ver dados detalhados'}
                </button>
                <div className={`detailed-data-content${showTables.q13 ? '' : ' hidden'}`}>
                  <DataTablePanel
                    table={q13Data.table_spec}
                    state={tableStates.q13}
                    onChange={(next) => handleTableChange('q13', next)}
                  />
                </div>
              </div>
            </>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>
      </div>
    </main>
  )
}
