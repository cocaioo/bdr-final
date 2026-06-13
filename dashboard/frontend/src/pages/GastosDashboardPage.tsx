import { useState, useEffect, useMemo } from 'react'
import { fetchDeputiesCatalog, fetchQuestion } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { NoDataState } from '../components/NoDataState'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { VisualRanking } from '../components/VisualRanking'
import { SupplierCardGrid } from '../components/SupplierCardGrid'
import { DeputyFinancialProfile } from '../components/DeputyFinancialProfile'
import { formatCurrency } from '../utils/format'
import type { DeputyCatalogItem, FilterState, MetaResponse, QuestionPayload, TableState } from '../types'

const EMPTY_FILTER_STATE: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

const VISUAL_TABLE_STATE = {
  page: 1,
  pageSize: 200,
  sortDir: 'desc',
} satisfies TableState

interface GastosDashboardPageProps {
  meta: MetaResponse
}

export function GastosDashboardPage({ meta }: GastosDashboardPageProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE)
  const [selectedDeputy, setSelectedDeputy] = useState<{ id: string; nome: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [deputyCatalog, setDeputyCatalog] = useState<DeputyCatalogItem[]>([])

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

  useEffect(() => {
    let mounted = true
    fetchDeputiesCatalog()
      .then((items) => {
        if (mounted) setDeputyCatalog(items)
      })
      .catch(() => {
        if (mounted) setDeputyCatalog([])
      })
    return () => {
      mounted = false
    }
  }, [])

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

    fetchQuestion(id, filters, VISUAL_TABLE_STATE, supported)
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

  // Efeitos reativos individuais por bloco dependentes apenas de filters
  useEffect(() => {
    fetchBlock('q1', setQ1Data)
  }, [filters])

  useEffect(() => {
    fetchBlock('q5', setQ5Data)
  }, [filters])

  useEffect(() => {
    fetchBlock('q7', setQ7Data)
  }, [filters])

  useEffect(() => {
    fetchBlock('q12', setQ12Data)
  }, [filters])

  useEffect(() => {
    fetchBlock('q13', setQ13Data)
  }, [filters])

  // Obter lista única de deputados a partir de q1Data + meta.available_filters para autocomplete
  const searchOptions = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; partido?: string; uf?: string }>()

    deputyCatalog.forEach((deputy) => {
      map.set(deputy.id_deputado, {
        id: deputy.id_deputado,
        nome: deputy.nome,
      })
    })

    const collectRows = (payload: QuestionPayload | null) => {
      payload?.table_spec.rows.forEach((row) => {
        const id = String(row.id_deputado || '')
        const nome = String(row.nome || '')
        if (id && nome) {
          const current = map.get(id)
          map.set(id, {
            id,
            nome: current?.nome || nome,
            partido: current?.partido || String(row.sigla_partido || ''),
            uf: current?.uf || String(row.sigla_uf || ''),
          })
        }
      })
    }

    collectRows(q1Data)
    collectRows(q7Data)
    collectRows(q12Data)
    collectRows(q13Data)

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [deputyCatalog, q1Data, q7Data, q12Data, q13Data])

  const applyDeputySelection = (deputy: { id: string; nome: string }) => {
    setSelectedDeputy(deputy)
    setSearchQuery(deputy.nome)
    setIsSearchOpen(false)
    setFilters((prev) => ({ ...prev, deputados: [deputy.id], search: '' }))
  }

  const clearDeputySelection = () => {
    setSelectedDeputy(null)
    setSearchQuery('')
    setIsSearchOpen(false)
    setFilters((prev) => ({ ...prev, deputados: [] }))
  }

  const toggleFilterValue = (key: 'anos', value: string) => {
    setFilters((prev) => {
      const current = prev[key]
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  const setSingleFilterValue = (key: 'partidos' | 'ufs', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value ? [value] : [] }))
  }

  const clearDashboardFilters = () => {
    setFilters(EMPTY_FILTER_STATE)
    setSelectedDeputy(null)
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  const hasActiveDashboardFilters =
    filters.anos.length > 0 ||
    filters.partidos.length > 0 ||
    filters.ufs.length > 0 ||
    filters.deputados.length > 0

  // Filtragem dos deputados conforme digitação na busca
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const term = searchQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return searchOptions
      .filter((opt) => {
        const nameNorm = opt.nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
        return nameNorm.includes(term)
      })
      .slice(0, 10)
  }, [searchQuery, searchOptions])

  // 3 melhores e 3 piores custo-benefício de Q7 (filtrando nulos, zeros, NaN)
  const costBenefitRankings = useMemo(() => {
    if (!q7Data) return { best: [], worst: [] }
    const rows = q7Data.table_spec.rows.filter((row) => {
      const cb = Number(row.custo_beneficio)
      const gasto = Number(row.gasto_total)
      return (
        row.custo_beneficio !== null &&
        row.custo_beneficio !== undefined &&
        row.gasto_total !== null &&
        row.gasto_total !== undefined &&
        !Number.isNaN(cb) &&
        !Number.isNaN(gasto) &&
        cb > 0 &&
        gasto > 0
      )
    })

    const sorted = [...rows].sort((a, b) => Number(b.custo_beneficio) - Number(a.custo_beneficio))

    return {
      best: sorted.slice(0, 3),
      worst: sorted.slice(-3).reverse(),
    }
  }, [q7Data])

  const q7FormulaCard = (
    <>
      <h3>Fórmula do custo-benefício</h3>
      <div className="formula-layout" aria-label="Fórmula da métrica de custo-benefício">
        <p className="formula-heading">Benefício =</p>
        <p>(qtd_proposicoes * 1.5) + (proposicoes_aprovadas * 36) + (presenca_total * 0.1)</p>
        <p className="formula-heading">Custo-benefício =</p>
        <p>benefício / gasto_total</p>
      </div>
    </>
  )

  return (
    <main className="gastos-dashboard-premium">
      <section className="premium-hero stagger-item">
        <div className="premium-hero-content">
          <h1>Painel de Gastos e Fornecedores</h1>
          <p>
            Análise executiva de despesas parlamentares, principais fornecedores, correlações de custo-benefício e relações deputado-fornecedor.
          </p>
        </div>

        {/* Busca Autocomplete por Deputado */}
        <div className="premium-search-container">
          <label htmlFor="deputy-main-search">Buscar Deputado:</label>
          <div className="premium-search-input-wrapper">
            <input
              id="deputy-main-search"
              type="text"
              className="premium-search-input"
              placeholder="Pesquise por nome de um deputado..."
              value={searchQuery}
              onFocus={() => {
                if (!selectedDeputy) {
                  setIsSearchOpen(true)
                }
              }}
              onChange={(e) => {
                const nextQuery = e.target.value
                setSearchQuery(nextQuery)
                setIsSearchOpen(true)
                if (selectedDeputy && nextQuery !== selectedDeputy.nome) {
                  setSelectedDeputy(null)
                  setFilters((prev) => ({ ...prev, deputados: [] }))
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSearchOpen(false)
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={clearDeputySelection}
              >
                &times;
              </button>
            )}
            {isSearchOpen && filteredOptions.length > 0 && (
              <ul className="premium-search-suggestions">
                {filteredOptions.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyDeputySelection({ id: opt.id, nome: opt.nome })}
                    >
                      <DeputyAvatar id={opt.id} nome={opt.nome} size={24} />
                      <div className="suggestion-text">
                        <span className="suggestion-name">{opt.nome}</span>
                        {opt.partido && (
                          <span className="suggestion-meta">
                            {opt.partido} - {opt.uf}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isSearchOpen && searchQuery.trim() && filteredOptions.length === 0 && (
              <ul className="premium-search-suggestions">
                <li className="no-suggestions">Nenhum deputado encontrado</li>
              </ul>
            )}
          </div>
        </div>

        <div className="premium-inline-filters" aria-label="Filtros do painel de gastos">
          <div className="premium-year-chips" aria-label="Filtrar por ano">
            {(meta.available_filters.anos ?? []).map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`premium-filter-chip${filters.anos.includes(choice.value) ? ' active' : ''}`}
                onClick={() => toggleFilterValue('anos', choice.value)}
              >
                {choice.label}
              </button>
            ))}
          </div>

          <div className="premium-filter-selects">
            <label>
              <span>Partido</span>
              <select
                value={filters.partidos[0] ?? ''}
                onChange={(event) => setSingleFilterValue('partidos', event.target.value)}
              >
                <option value="">Todos</option>
                {(meta.available_filters.partidos ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>UF</span>
              <select
                value={filters.ufs[0] ?? ''}
                onChange={(event) => setSingleFilterValue('ufs', event.target.value)}
              >
                <option value="">Todas</option>
                {(meta.available_filters.ufs ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>

            {hasActiveDashboardFilters && (
              <button type="button" className="premium-clear-filters" onClick={clearDashboardFilters}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Perfil Expandido do Deputado Selecionado */}
      {selectedDeputy && (
        <DeputyFinancialProfile
          deputyId={selectedDeputy.id}
          deputyName={selectedDeputy.nome}
          q1Data={q1Data}
          q7Data={q7Data}
          q12Data={q12Data}
          q13Data={q13Data}
          onClose={clearDeputySelection}
        />
      )}

      {/* Bloco 1: Visão Geral de Indicadores */}
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

      <div className="premium-dashboard-grid">
        {/* Bloco 2: Ranking de Gastos por Deputado (Q1) */}
        <section className="premium-panel stagger-item">
          <h2>Deputados que mais gastaram (Q1)</h2>
          {loading.q1 && !q1Data ? (
            <p className="loading">Carregando dados de despesas...</p>
          ) : errors.q1 ? (
            <p className="error">Erro: {errors.q1}</p>
          ) : q1Data ? (
            <div className="premium-panel-content">
              <ChartPanel spec={q1Data.chart_spec} />
              <VisualRanking
                rows={q1Data.table_spec.rows}
                idField="id_deputado"
                labelField="nome"
                valueField="gasto_total"
                subtitleField="sigla_partido"
                secondarySubtitleField="sigla_uf"
                highlightValue={selectedDeputy?.id}
                limit={10}
              />
            </div>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 3: Fornecedores com maior total pago (Q5) */}
        <section className="premium-panel stagger-item">
          <h2>Fornecedores com maior total pago (Q5)</h2>
          {loading.q5 && !q5Data ? (
            <p className="loading">Carregando dados de fornecedores...</p>
          ) : errors.q5 ? (
            <p className="error">Erro: {errors.q5}</p>
          ) : q5Data ? (
            <div className="premium-panel-content">
              <ChartPanel spec={q5Data.chart_spec} />
              <SupplierCardGrid rows={q5Data.table_spec.rows} limit={6} />
            </div>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 4: Índice de Custo-Benefício (Q7) */}
        <section className="premium-panel stagger-item">
          <h2>Índice de Custo-Benefício (Q7)</h2>
          {loading.q7 && !q7Data ? (
            <p className="loading">Carregando custo-benefício...</p>
          ) : errors.q7 ? (
            <p className="error">Erro: {errors.q7}</p>
          ) : q7Data ? (
            <div className="premium-panel-content">
              <div className="custo-beneficio-row">
                <ExecutiveCards
                  cards={q7Data.summary_cards}
                  extraCard={q7FormulaCard}
                />
              </div>
              <ChartPanel spec={q7Data.chart_spec} />

              <div className="premium-cb-insights">
                <div className="insight-column">
                  <h4>Melhor Custo-Benefício</h4>
                  <VisualRanking
                    rows={costBenefitRankings.best}
                    idField="id_deputado"
                    labelField="nome"
                    valueField="custo_beneficio"
                    subtitleField="gasto_total"
                    isCurrency={false}
                    formatSubtitle={formatCurrency}
                    highlightValue={selectedDeputy?.id}
                    limit={3}
                  />
                </div>
                <div className="insight-column">
                  <h4>Pior Custo-Benefício</h4>
                  <VisualRanking
                    rows={costBenefitRankings.worst}
                    idField="id_deputado"
                    labelField="nome"
                    valueField="custo_beneficio"
                    subtitleField="gasto_total"
                    isCurrency={false}
                    formatSubtitle={formatCurrency}
                    highlightValue={selectedDeputy?.id}
                    limit={3}
                  />
                </div>
              </div>
            </div>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 5: Relação Deputado x Fornecedor (Q12) */}
        <section className="premium-panel stagger-item">
          <h2>Relação Deputado x Fornecedor (Q12)</h2>
          {loading.q12 && !q12Data ? (
            <p className="loading">Carregando relação...</p>
          ) : errors.q12 ? (
            <p className="error">Erro: {errors.q12}</p>
          ) : q12Data ? (
            <div className="premium-panel-content">
              <ChartPanel spec={q12Data.chart_spec} />
              <VisualRanking
                rows={q12Data.table_spec.rows}
                idField="id_deputado"
                labelField="nome"
                valueField="total_pago"
                subtitleField="fornecedor"
                highlightValue={selectedDeputy?.id}
                limit={10}
              />
            </div>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>

        {/* Bloco 6: Categorias de gasto por deputado (Q13) */}
        <section className="premium-panel stagger-item">
          <h2>Categorias de Gasto (Q13)</h2>
          {loading.q13 && !q13Data ? (
            <p className="loading">Carregando categorias...</p>
          ) : errors.q13 ? (
            <p className="error">Erro: {errors.q13}</p>
          ) : q13Data ? (
            <div className="premium-panel-content">
              <ChartPanel spec={q13Data.chart_spec} />
              <VisualRanking
                rows={q13Data.table_spec.rows}
                labelField="descricao_despesa"
                valueField="gasto_total"
                subtitleField="nome"
                extraLabelField="pct_total"
                highlightValue={selectedDeputy?.id}
                limit={10}
              />
            </div>
          ) : (
            <NoDataState message="Nenhum dado disponível." />
          )}
        </section>
      </div>
    </main>
  )
}
