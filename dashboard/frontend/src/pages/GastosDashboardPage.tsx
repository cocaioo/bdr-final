import { useEffect, useMemo, useState } from 'react'

import {
  fetchGastosAnomaliaDetalhes,
  fetchGastosAnomalias,
  fetchGastosCategorias,
  fetchGastosContexto,
  fetchGastosDeputados,
  fetchGastosFornecedores,
  fetchGastosResumo,
} from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { NoDataState } from '../components/NoDataState'
import { formatCellValue, formatCurrency } from '../utils/format'
import type {
  ChartSpec,
  GastoAnomaliaDetalhesPayload,
  GastoAnomaliaMotivo,
  GastoAnomaliasPayload,
  GastoCategoriaItem,
  GastoContextoPayload,
  GastoDeputadoItem,
  GastoFornecedorItem,
  GastosCollectionPayload,
  GastosSummary,
  MetaResponse,
} from '../types'

type GastosTab = 'resumo' | 'categorias' | 'deputados' | 'fornecedores' | 'contexto' | 'anomalias'

interface GastosDashboardPageProps {
  meta: MetaResponse
}

const TABS: Array<{ id: GastosTab; label: string; question: string }> = [
  { id: 'resumo', label: 'Resumo', question: 'Quanto foi gasto?' },
  { id: 'categorias', label: 'Categorias', question: 'Em que foi gasto?' },
  { id: 'deputados', label: 'Deputados', question: 'Quem gastou?' },
  { id: 'fornecedores', label: 'Fornecedores', question: 'Quem recebeu?' },
  { id: 'contexto', label: 'Partidos e UFs', question: 'Como os gastos variam?' },
  { id: 'anomalias', label: 'Gastos Atipicos', question: 'O que foge do padrao?' },
]

const TOP_LIMIT = 10

const MOTIVE_LABELS: Record<string, string> = {
  valor_extremo_categoria: 'valor extremo',
  valor_acima_percentil_95: 'acima do percentil 95',
  valor_acima_percentil_99: 'acima do percentil 99',
  fornecedor_pouco_frequente: 'fornecedor pouco frequente',
  fornecedor_baixa_dispersao: 'fornecedor com baixa dispersao',
  ticket_acima_padrao_deputado: 'ticket acima do padrao',
}

function formatPercent(value: unknown, digits = 2): string {
  return `${toNumber(value).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
}

function topRows<T>(rows: T[], limit = TOP_LIMIT): T[] {
  return rows.slice(0, limit)
}

function asRecords<T>(rows: T[]): Array<Record<string, unknown>> {
  return rows as unknown as Array<Record<string, unknown>>
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function sortByNumber<T>(rows: T[], field: keyof T): T[] {
  return [...rows].sort((a, b) => toNumber(b[field]) - toNumber(a[field]))
}

function rankInRows<T>(rows: T[], predicate: (row: T) => boolean): number | null {
  const index = rows.findIndex(predicate)
  return index >= 0 ? index + 1 : null
}

function splitList(value: unknown): string[] {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

function barChart(
  title: string,
  description: string,
  rows: Array<Record<string, unknown>>,
  labelField: string,
  valueField: string,
  type: 'bar_horizontal' | 'bar_vertical' = 'bar_horizontal',
): ChartSpec {
  const ordered = type === 'bar_horizontal' ? [...rows].reverse() : rows
  return {
    type,
    title,
    description,
    x_field: labelField,
    y_fields: [valueField],
    categories: ordered.map((row) => String(row[labelField] ?? '')),
    series: [{ name: title, data: ordered.map((row) => toNumber(row[valueField])) }],
    options: {},
  }
}

function lineChart(title: string, description: string, rows: Array<Record<string, unknown>>): ChartSpec {
  return {
    type: 'line',
    title,
    description,
    x_field: 'ano',
    y_fields: ['valor_total'],
    categories: rows.map((row) => String(row.ano)),
    series: [{ name: 'Valor total', data: rows.map((row) => toNumber(row.valor_total)) }],
    options: {},
  }
}

function scatterChart(rows: Array<Record<string, unknown>>): ChartSpec {
  return {
    type: 'scatter',
    title: 'Despesas atipicas filtradas',
    description: 'Amostra paginada: valor liquido no eixo X e score de atipicidade no eixo Y.',
    x_field: 'valor_liquido',
    y_fields: ['score_atipicidade'],
    categories: [],
    series: [
      {
        name: 'Despesas atipicas',
        data: rows.map((row) => [toNumber(row.valor_liquido), toNumber(row.score_atipicidade)]),
      },
    ],
    options: { x_name: 'Valor liquido', y_name: 'Score' },
  }
}

function parseMotivos(value: unknown): GastoAnomaliaMotivo[] {
  if (Array.isArray(value)) return value as GastoAnomaliaMotivo[]
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function motiveLabel(tipo: unknown): string {
  const key = String(tipo ?? '')
  return MOTIVE_LABELS[key] ?? key.replaceAll('_', ' ')
}

function MotiveBadges({ motivos }: { motivos: GastoAnomaliaMotivo[] }) {
  if (!motivos.length) {
    return <span className="gastos-badge gastos-badge-atipico">Atípico</span>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {motivos.map((motivo, index) => {
        let badgeClass = 'gastos-badge-atipico'
        let label = motiveLabel(motivo.tipo)
        if (motivo.tipo === 'valor_acima_percentil_95') {
          badgeClass = 'gastos-badge-p95'
          label = 'Percentil 95'
        } else if (motivo.tipo === 'valor_acima_percentil_99') {
          badgeClass = 'gastos-badge-p99'
          label = 'Percentil 99'
        } else if (motivo.tipo === 'fornecedor_pouco_frequente') {
          badgeClass = 'gastos-badge-raro'
          label = 'Fornecedor Raro'
        } else if (motivo.tipo === 'fornecedor_baixa_dispersao') {
          badgeClass = 'gastos-badge-concentrado'
          label = 'Fornecedor Concentrado'
        } else if (motivo.tipo === 'valor_extremo_categoria') {
          badgeClass = 'gastos-badge-atipico'
          label = 'Atípico'
        }
        return (
          <span className={`gastos-badge ${badgeClass}`} key={`${motivo.tipo}-${index}`}>
            {label}
          </span>
        )
      })}
    </div>
  )
}

function MotiveDetails({ motivos }: { motivos: GastoAnomaliaMotivo[] }) {
  if (!motivos.length) {
    return (
      <p className="gastos-motive-note">
        O modelo classificou a despesa como comportamento estatistico incomum, mas nenhum dos motivos explicativos
        desta fase atingiu os limiares definidos.
      </p>
    )
  }

  return (
    <ul className="gastos-motive-list">
      {motivos.map((motivo, index) => (
        <li key={`${motivo.tipo}-${index}`}>
          <strong>{motiveLabel(motivo.tipo)}</strong>
          <span>{motivo.descricao}</span>
        </li>
      ))}
    </ul>
  )
}

/* ==========================================
   Skeleton Loaders Components
   ========================================== */
function KpisSkeleton() {
  return (
    <div className="skeleton-kpis">
      <div className="skeleton skeleton-kpi" />
      <div className="skeleton skeleton-kpi" />
      <div className="skeleton skeleton-kpi" />
      <div className="skeleton skeleton-kpi" />
      <div className="skeleton skeleton-kpi" />
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="skeleton-insights" style={{ margin: '16px 0' }}>
      <div className="skeleton skeleton-insight" />
      <div className="skeleton skeleton-insight" />
      <div className="skeleton skeleton-insight" />
    </div>
  )
}

function ChartsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={count === 3 ? "skeleton-charts-3" : "skeleton-charts-2"} style={{ margin: '16px 0' }}>
      <div className="skeleton skeleton-chart" />
      <div className="skeleton skeleton-chart" />
      {count === 3 && <div className="skeleton skeleton-chart" />}
    </div>
  )
}

function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-cards" style={{ margin: '16px 0' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="skeleton skeleton-table" style={{ margin: '16px 0' }}>
      <div style={{ padding: '16px' }}>
        <div className="skeleton-text" style={{ width: '30%', height: '14px', marginBottom: '16px' }} />
        <div className="skeleton-text" style={{ width: '95%', height: '10px', marginBottom: '8px' }} />
        <div className="skeleton-text" style={{ width: '90%', height: '10px', marginBottom: '8px' }} />
        <div className="skeleton-text" style={{ width: '85%', height: '10px', marginBottom: '8px' }} />
        <div className="skeleton-text" style={{ width: '70%', height: '10px', marginBottom: '8px' }} />
      </div>
    </div>
  )
}

/* ==========================================
   Standardized KPI Grid Helper
   ========================================== */
function KpiGrid({ summary }: { summary: GastosSummary }) {
  const cards = [
    ['Valor total gasto', formatCurrency(summary.valor_total)],
    ['Quantidade de despesas', formatCellValue(summary.qtd_despesas)],
    ['Ticket medio', formatCurrency(summary.ticket_medio)],
    ['Deputados', formatCellValue(summary.qtd_deputados)],
    ['Fornecedores', formatCellValue(summary.qtd_fornecedores)],
  ]

  return (
    <div className="gastos-kpi-grid">
      {cards.map(([label, value]) => (
        <article className="gastos-kpi-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  )
}

function InsightGrid({ insights }: { insights: Array<{ title: string; body: string }> }) {
  return (
    <div className="gastos-insight-grid">
      {insights.map((insight) => (
        <article className="gastos-auto-insight" key={insight.title}>
          <span>{insight.title}</span>
          <p>{insight.body}</p>
        </article>
      ))}
    </div>
  )
}

/* ==========================================
   Refactored Deputy Cards with photo, name, party, UF, total, count, and average
   ========================================== */
function DeputyRankingCards({
  rows,
  selectedId,
  onSelect,
}: {
  rows: GastoDeputadoItem[]
  selectedId?: number
  onSelect?: (row: GastoDeputadoItem) => void
}) {
  if (!rows.length) return <NoDataState message="Nenhum deputado encontrado para os filtros atuais." />

  return (
    <div className="gastos-deputy-card-grid">
      {rows.map((row, index) => (
        <button
          type="button"
          className={`gastos-deputy-rank-card${selectedId === row.id_deputado ? ' selected' : ''}`}
          key={`${row.id_deputado}-${index}`}
          onClick={() => onSelect?.(row)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span className="rank-number" style={{ fontSize: '1rem', fontWeight: 'bold' }}>#{index + 1}</span>
            <DeputyAvatar id={row.id_deputado} nome={row.nome_parlamentar} size={52} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', marginTop: '4px' }}>
            <span className="rank-name" style={{ fontWeight: 'bold', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.nome_parlamentar}>
              {row.nome_parlamentar}
            </span>
            <span className="rank-meta" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              {row.sigla_partido} - {row.sigla_uf}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
            <span className="rank-label" style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold' }}>Valor Total</span>
            <strong style={{ fontSize: '1.15rem' }}>{formatCurrency(row.valor_total)}</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
              <span>{formatCellValue(row.qtd_despesas)} despesas</span>
              <span>méd. {formatCurrency(row.ticket_medio)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function CompactTable({
  columns,
  rows,
  onRowClick,
  selectedKey,
}: {
  columns: Array<{ key: string; label: string; format?: (value: unknown, row: Record<string, unknown>) => string }>
  rows: Array<Record<string, unknown>>
  onRowClick?: (row: Record<string, unknown>) => void
  selectedKey?: string
}) {
  if (!rows.length) return <NoDataState message="Nenhum registro retornado pela API." />

  return (
    <div className="gastos-table-wrap">
      <table className="gastos-compact-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = String(row.id_deputado ?? row.fornecedor ?? row.categoria ?? index)
            return (
              <tr
                key={`${key}-${index}`}
                className={selectedKey && selectedKey === key ? 'selected' : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.format
                      ? column.format(row[column.key], row)
                      : typeof row[column.key] === 'number'
                        ? formatCellValue(row[column.key])
                        : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function GastosDashboardPage({ meta }: GastosDashboardPageProps) {
  // Add light theme class on body when loaded
  useEffect(() => {
    document.body.classList.add('gastos-light-theme')
    return () => {
      document.body.classList.remove('gastos-light-theme')
    }
  }, [])

  const [activeTab, setActiveTab] = useState<GastosTab>('resumo')
  const [visitedTabs, setVisitedTabs] = useState<Record<GastosTab, boolean>>({
    resumo: true,
    categorias: false,
    deputados: false,
    fornecedores: false,
    contexto: false,
    anomalias: false,
  })

  // Set active tab as visited
  useEffect(() => {
    setVisitedTabs((prev) => ({ ...prev, [activeTab]: true }))
  }, [activeTab])

  // Data states
  const [summary, setSummary] = useState<GastosSummary | null>(null)
  const [categories, setCategories] = useState<GastosCollectionPayload<GastoCategoriaItem> | null>(null)
  const [deputies, setDeputies] = useState<GastosCollectionPayload<GastoDeputadoItem> | null>(null)
  const [suppliers, setSuppliers] = useState<GastosCollectionPayload<GastoFornecedorItem> | null>(null)
  const [contexto, setContexto] = useState<GastoContextoPayload | null>(null)
  const [anomalias, setAnomalias] = useState<GastoAnomaliasPayload | null>(null)
  const [anomaliaDetails, setAnomaliaDetails] = useState<GastoAnomaliaDetalhesPayload | null>(null)
  const [yearSeries, setYearSeries] = useState<Array<{ ano: string; valor_total: number }>>([])

  // Loading states per tab
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [loadingDeputados, setLoadingDeputados] = useState(false)
  const [loadingFornecedores, setLoadingFornecedores] = useState(false)
  const [loadingContexto, setLoadingContexto] = useState(false)
  const [loadingAnomalias, setLoadingAnomalias] = useState(false)

  // Filter states
  const [ano, setAno] = useState('')
  const [partido, setPartido] = useState('')
  const [uf, setUf] = useState('')
  const [buscaDeputado, setBuscaDeputado] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [selectedDeputy, setSelectedDeputy] = useState<GastoDeputadoItem | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<GastoFornecedorItem | null>(null)
  
  const [anomaliaFilters, setAnomaliaFilters] = useState({
    deputado: '',
    partido: '',
    uf: '',
    categoria: '',
  })
  const [anomaliaPage, setAnomaliaPage] = useState(1)
  const [anomaliaError, setAnomaliaError] = useState<string | null>(null)

  const availableYears = useMemo(
    () => (meta.available_filters.anos ?? []).map((choice) => choice.value).filter(Boolean).sort(),
    [meta.available_filters.anos],
  )

  // 1. Resumo Tab Loader
  useEffect(() => {
    if (!visitedTabs.resumo) return
    if (summary && categories && yearSeries.length > 0) return

    setLoadingResumo(true)
    const years = availableYears.length ? availableYears : ['2023', '2024', '2025', '2026']

    Promise.all([
      fetchGastosResumo(),
      fetchGastosCategorias(1, 200),
      Promise.all(years.map((year) => fetchGastosDeputados({ ano: year, pageSize: 1 })))
    ])
      .then(([summaryData, categoryData, payloads]) => {
        setSummary(summaryData)
        setCategories(categoryData)
        setYearSeries(payloads.map((payload, index) => ({ ano: years[index], valor_total: payload.summary.valor_total })))
      })
      .catch((err) => {
        console.error('Error fetching resumo data:', err)
      })
      .finally(() => {
        setLoadingResumo(false)
      })
  }, [visitedTabs.resumo, availableYears, summary, categories, yearSeries])

  // 2. Categorias Tab Loader
  useEffect(() => {
    if (!visitedTabs.categorias) return
    if (categories) return

    setLoadingCategorias(true)
    fetchGastosCategorias(1, 200)
      .then((data) => {
        setCategories(data)
      })
      .catch((err) => {
        console.error('Error fetching categories:', err)
      })
      .finally(() => {
        setLoadingCategorias(false)
      })
  }, [visitedTabs.categorias, categories])

  // 3. Deputados Tab Loader
  useEffect(() => {
    if (!visitedTabs.deputados) return

    setLoadingDeputados(true)
    Promise.all([
      fetchGastosDeputados({
        ano: ano || undefined,
        partido: partido || undefined,
        uf: uf || undefined,
        busca: buscaDeputado || undefined,
        pageSize: 100,
      }),
      anomalias ? Promise.resolve(anomalias) : fetchGastosAnomalias({ pageSize: 100 })
    ])
      .then(([payload, anomalyData]) => {
        setDeputies(payload)
        setAnomalias(anomalyData)
        if (selectedDeputy && !payload.items.some((item) => item.id_deputado === selectedDeputy.id_deputado)) {
          setSelectedDeputy(null)
        }
      })
      .catch((err) => {
        console.error('Error fetching deputies:', err)
      })
      .finally(() => {
        setLoadingDeputados(false)
      })
  }, [visitedTabs.deputados, ano, partido, uf, buscaDeputado, selectedDeputy, anomalias])

  // 4. Fornecedores Tab Loader
  useEffect(() => {
    if (!visitedTabs.fornecedores) return

    setLoadingFornecedores(true)
    fetchGastosFornecedores({
      categoria: categoriaFiltro || undefined,
      partido: partido || undefined,
      uf: uf || undefined,
      deputado: selectedDeputy ? String(selectedDeputy.id_deputado) : undefined,
      pageSize: 100,
    })
      .then((payload) => {
        setSuppliers(payload)
        if (selectedSupplier && !payload.items.some((item) => item.fornecedor === selectedSupplier.fornecedor)) {
          setSelectedSupplier(null)
        }
      })
      .catch((err) => {
        console.error('Error fetching suppliers:', err)
      })
      .finally(() => {
        setLoadingFornecedores(false)
      })
  }, [visitedTabs.fornecedores, categoriaFiltro, partido, uf, selectedDeputy, selectedSupplier])

  // 5. Contexto Tab Loader
  useEffect(() => {
    if (!visitedTabs.contexto) return
    if (contexto) return

    setLoadingContexto(true)
    fetchGastosContexto()
      .then((data) => {
        setContexto(data)
      })
      .catch((err) => {
        console.error('Error fetching context:', err)
      })
      .finally(() => {
        setLoadingContexto(false)
      })
  }, [visitedTabs.contexto, contexto])

  // 6. Anomalias Tab Loader
  useEffect(() => {
    if (!visitedTabs.anomalias) return
    if (anomalias) return

    setLoadingAnomalias(true)
    fetchGastosAnomalias({ pageSize: 100 })
      .then((data) => {
        setAnomalias(data)
      })
      .catch((err) => {
        console.error('Error fetching anomalies:', err)
      })
      .finally(() => {
        setLoadingAnomalias(false)
      })
  }, [visitedTabs.anomalias, anomalias])

  // Memoized lists and fields
  const topCategoriesByValue = useMemo(
    () => topRows(sortByNumber(categories?.items ?? [], 'valor_total')),
    [categories],
  )
  const topCategoriesByCount = useMemo(
    () => topRows(sortByNumber(categories?.items ?? [], 'qtd_despesas')),
    [categories],
  )
  const topCategoriesByTicket = useMemo(
    () => topRows(sortByNumber(categories?.items ?? [], 'ticket_medio')),
    [categories],
  )
  const topDeputies = useMemo(() => topRows(deputies?.items ?? []), [deputies])
  const topSuppliers = useMemo(() => topRows(suppliers?.items ?? []), [suppliers])
  const topParties = useMemo(
    () => topRows(sortByNumber(asRecords(contexto?.partidos ?? []), 'valor_total')),
    [contexto],
  )
  const topPartiesByAverage = useMemo(
    () => topRows(sortByNumber(asRecords(contexto?.partidos ?? []), 'valor_medio_por_deputado')),
    [contexto],
  )
  const topUfs = useMemo(
    () => topRows(sortByNumber(asRecords(contexto?.ufs ?? []), 'valor_total')),
    [contexto],
  )
  
  const anomalyRanking = anomalias?.ranking ?? []
  const hasAnomalyFilter = Object.values(anomaliaFilters).some((value) => value.trim())

  const loadAnomalyDetails = () => {
    setAnomaliaError(null)
    if (!hasAnomalyFilter) {
      setAnomaliaDetails(null)
      setAnomaliaError('Informe ao menos um filtro antes de carregar o detalhamento.')
      return
    }
    fetchGastosAnomaliaDetalhes({
      ...anomaliaFilters,
      page: anomaliaPage,
      pageSize: 50,
    })
      .then(setAnomaliaDetails)
      .catch((err) => {
        setAnomaliaDetails(null)
        setAnomaliaError(err instanceof Error ? err.message : 'Erro ao carregar detalhes.')
      })
  }

  useEffect(() => {
    if (activeTab === 'anomalias' && hasAnomalyFilter) {
      loadAnomalyDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anomaliaPage])

  const anomalySummary = anomalias?.summary ?? {}
  const anomalyTotal = toNumber(anomalySummary.total_despesas)
  const anomalyCount = toNumber(anomalySummary.qtd_despesas_atipicas)
  const anomalyPct = anomalyTotal ? (anomalyCount / anomalyTotal) * 100 : 0
  const topAnomalyDeputy = anomalyRanking[0]
  const topCategory = topCategoriesByValue[0]
  const mostFrequentCategory = topCategoriesByCount[0]
  const highestTicketCategory = topCategoriesByTicket[0]
  const topSupplier = topSuppliers[0]
  
  const selectedDeputyRank = selectedDeputy && deputies
    ? rankInRows(deputies.items, (item) => item.id_deputado === selectedDeputy.id_deputado)
    : null
  
  const selectedDeputyAnomaly = selectedDeputy
    ? anomalyRanking.find((item) => item.id_deputado === selectedDeputy.id_deputado)
    : undefined
  
  const topSupplierForSelectedDeputy = selectedDeputy ? topSupplier : undefined
  const topPartyByTotal = topParties[0]
  const topPartyByAverage = topPartiesByAverage[0]
  const totalPartyAverageRank = topPartyByTotal
    ? rankInRows(topPartiesByAverage, (item) => item.sigla_partido === topPartyByTotal.sigla_partido)
    : null

  // Auto Insights Generators
  const categoryInsights = [
    topCategory
      ? {
          title: 'Concentracao principal',
          body: `${topCategory.categoria} representa ${formatPercent(topCategory.pct_total)} do valor total analisado.`,
        }
      : null,
    mostFrequentCategory
      ? {
          title: 'Categoria mais frequente',
          body: `${mostFrequentCategory.categoria} aparece em ${formatCellValue(mostFrequentCategory.qtd_despesas)} despesas, mostrando recorrencia de uso.`,
        }
      : null,
    highestTicketCategory
      ? {
          title: 'Maior ticket medio',
          body: `${highestTicketCategory.categoria} tem ticket medio de ${formatCurrency(highestTicketCategory.ticket_medio)}, sinalizando despesas individuais mais altas.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>

  const resumoInsights = [
    topCategory
      ? {
          title: 'Destino predominante',
          body: `${topCategory.categoria} e a categoria com maior valor, concentrando ${formatPercent(topCategory.pct_total)} do total.`,
        }
      : null,
    yearSeries.length > 1
      ? {
          title: 'Ano de maior volume',
          body: `${sortByNumber(yearSeries, 'valor_total')[0]?.ano} aparece como o ano de maior valor agregado na serie disponivel.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>

  const supplierInsights = [
    topSupplier
      ? {
          title: 'Fornecedor de maior alcance',
          body: `${topSupplier.fornecedor} atende ${formatCellValue(topSupplier.qtd_deputados)} deputados e representa ${formatPercent(topSupplier.pct_total)} do total recebido no recorte.`,
        }
      : null,
    topSupplier?.categorias
      ? {
          title: 'Contexto de atuacao',
          body: `Categorias associadas: ${splitList(topSupplier.categorias).slice(0, 3).join(', ')}.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>

  const contextInsights = [
    topPartyByTotal
      ? {
          title: 'Volume x intensidade',
          body: `${topPartyByTotal.sigla_partido} lidera em valor total${totalPartyAverageRank ? ` e fica na posicao ${totalPartyAverageRank} por media/deputado` : ''}.`,
        }
      : null,
    topPartyByAverage
      ? {
          title: 'Maior media por deputado',
          body: `${topPartyByAverage.sigla_partido} lidera por gasto medio por parlamentar, com ${formatCurrency(topPartyByAverage.valor_medio_por_deputado)}.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>

  const anomalyInsights = [
    {
      title: 'Proporcao de atipicidade',
      body: `${formatPercent(anomalyPct)} das despesas analisadas foram classificadas como comportamento estatistico incomum.`,
    },
    topAnomalyDeputy
      ? {
          title: 'Maior concentracao individual',
          body: `${topAnomalyDeputy.nome_parlamentar} lidera o ranking com ${formatCellValue(topAnomalyDeputy.qtd_despesas_atipicas)} despesas atipicas.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>

  return (
    <main className="gastos-dashboard-premium gastos-story-dashboard">
      {/* Dynamic Header Section */}
      <section className="premium-hero stagger-item">
        <div className="premium-hero-content">
          <h1>Painel de Gastos Parlamentares</h1>
          <p>
            Uma jornada analitica: quanto foi gasto, em que categorias, por quais deputados, com quais fornecedores,
            em quais contextos politicos e quais despesas apresentam comportamento estatistico incomum.
          </p>
        </div>
        {summary ? <KpiGrid summary={summary} /> : <KpisSkeleton />}
      </section>

      {/* Tabs Navigation */}
      <nav className="gastos-tabs" aria-label="Abas do bloco de gastos">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? 'active' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.question}</small>
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      {/* 1. Resumo Tab */}
      {activeTab === 'resumo' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Visão Geral dos Gastos</h2>
            <p>Quanto foi gasto pelos deputados?</p>
          </header>
          {loadingResumo || !summary || !categories ? (
            <>
              <KpisSkeleton />
              <InsightsSkeleton />
              <ChartsSkeleton />
            </>
          ) : (
            <>
              <KpiGrid summary={summary} />
              <InsightGrid insights={resumoInsights} />
              <div className="gastos-chart-grid">
                {yearSeries.length > 0 && (
                  <ChartPanel
                    spec={lineChart(
                      'Evolucao temporal dos gastos',
                      'A base atual nao possui mes de emissao; a serie e apresentada por ano.',
                      yearSeries,
                    )}
                  />
                )}
                <ChartPanel
                  spec={barChart(
                    'Distribuicao por categoria',
                    'Categorias com maior valor total gasto.',
                    asRecords(topCategoriesByValue),
                    'categoria',
                    'valor_total',
                  )}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* 2. Categorias Tab */}
      {activeTab === 'categorias' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Categorias de Despesa</h2>
            <p>Em que categorias os recursos foram concentrados?</p>
          </header>
          {loadingCategorias || !categories ? (
            <>
              <KpisSkeleton />
              <InsightsSkeleton />
              <ChartsSkeleton />
              <TableSkeleton />
            </>
          ) : (
            <>
              <div className="gastos-kpi-grid">
                <article className="gastos-kpi-card">
                  <span>Categoria Principal</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topCategory?.categoria}>{topCategory?.categoria ?? '-'}</strong>
                  <small>{formatCurrency(topCategory?.valor_total ?? 0)}</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Mais Frequente</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mostFrequentCategory?.categoria}>{mostFrequentCategory?.categoria ?? '-'}</strong>
                  <small>{formatCellValue(mostFrequentCategory?.qtd_despesas ?? 0)} despesas</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Maior Ticket Médio</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={highestTicketCategory?.categoria}>{highestTicketCategory?.categoria ?? '-'}</strong>
                  <small>{formatCurrency(highestTicketCategory?.ticket_medio ?? 0)}/ticket</small>
                </article>
              </div>
              <InsightGrid insights={categoryInsights} />
              <div className="gastos-chart-grid">
                <ChartPanel spec={barChart('Top categorias por valor', 'Concentracao de recursos.', asRecords(topCategoriesByValue), 'categoria', 'valor_total')} />
                <ChartPanel spec={barChart('Ticket medio por categoria', 'Categorias com despesas individuais mais altas.', asRecords(topCategoriesByTicket), 'categoria', 'ticket_medio')} />
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Ranking de Categorias</h3>
              <div className="gastos-deputy-card-grid" style={{ marginBottom: '24px' }}>
                {topCategoriesByValue.slice(0, 4).map((cat, idx) => (
                  <div key={`${cat.categoria}-${idx}`} className="gastos-deputy-rank-card" style={{ cursor: 'default', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="rank-number">#{idx + 1}</span>
                    <span className="rank-name" style={{ fontWeight: 'bold' }}>{cat.categoria}</span>
                    <span className="rank-label">Valor total</span>
                    <strong>{formatCurrency(cat.valor_total)}</strong>
                    <small>{formatCellValue(cat.qtd_despesas)} despesas | ticket médio {formatCurrency(cat.ticket_medio)}</small>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabela Detalhada</h3>
              <CompactTable
                rows={asRecords(categories.items)}
                columns={[
                  { key: 'categoria', label: 'Categoria' },
                  { key: 'valor_total', label: 'Valor total', format: formatCurrency },
                  { key: 'qtd_despesas', label: 'Despesas' },
                  { key: 'ticket_medio', label: 'Ticket medio', format: formatCurrency },
                  { key: 'qtd_deputados', label: 'Deputados' },
                ]}
              />
            </>
          )}
        </section>
      )}

      {/* 3. Deputados Tab */}
      {activeTab === 'deputados' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Gastos por Deputado</h2>
            <p>Quem são os deputados que mais gastaram?</p>
          </header>
          
          <div className="gastos-filter-row" style={{ marginBottom: '16px' }}>
            <label>
              Ano
              <select value={ano} onChange={(event) => setAno(event.target.value)}>
                <option value="">Todos</option>
                {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label>
              Partido
              <select value={partido} onChange={(event) => setPartido(event.target.value)}>
                <option value="">Todos</option>
                {(meta.available_filters.partidos ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </select>
            </label>
            <label>
              UF
              <select value={uf} onChange={(event) => setUf(event.target.value)}>
                <option value="">Todas</option>
                {(meta.available_filters.ufs ?? []).map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </select>
            </label>
            <label>
              Busca
              <input value={buscaDeputado} onChange={(event) => setBuscaDeputado(event.target.value)} placeholder="Nome ou ID" />
            </label>
          </div>

          {loadingDeputados || !deputies ? (
            <>
              <KpisSkeleton />
              <CardsSkeleton />
              <TableSkeleton />
            </>
          ) : (
            <>
              <div className="gastos-kpi-grid">
                <article className="gastos-kpi-card">
                  <span>Destaque de Gastos</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topDeputies[0]?.nome_parlamentar}>{topDeputies[0]?.nome_parlamentar ?? '-'}</strong>
                  <small>{topDeputies[0] ? `${formatCurrency(topDeputies[0].valor_total)} (${topDeputies[0].sigla_partido})` : ''}</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Deputados Analisados</span>
                  <strong>{formatCellValue(deputies.summary.qtd_deputados)}</strong>
                </article>
                <article className="gastos-kpi-card">
                  <span>Média por Deputado</span>
                  <strong>{formatCurrency(deputies.summary.valor_total / Math.max(1, deputies.summary.qtd_deputados))}</strong>
                </article>
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Ranking de Deputados (Clique para Analisar)</h3>
              <DeputyRankingCards
                rows={topDeputies}
                selectedId={selectedDeputy?.id_deputado}
                onSelect={setSelectedDeputy}
              />

              {selectedDeputy && (
                <aside className="gastos-drilldown stagger-item" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <DeputyAvatar id={selectedDeputy.id_deputado} nome={selectedDeputy.nome_parlamentar} size={64} />
                      <div>
                        <small style={{ color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>Analisando deputado:</small>
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '1.4rem' }}>{selectedDeputy.nome_parlamentar}</h3>
                        <p style={{ margin: '2px 0 0 0', color: 'var(--muted)' }}>{selectedDeputy.sigla_partido} - {selectedDeputy.sigla_uf}</p>
                      </div>
                    </div>
                    <button type="button" className="gastos-clear-button" onClick={() => setSelectedDeputy(null)}>
                      Fechar Analise
                    </button>
                  </div>

                  <div className="gastos-drilldown-grid" style={{ marginTop: '12px' }}>
                    <span>Valor total: <strong>{formatCurrency(selectedDeputy.valor_total)}</strong></span>
                    <span>Posicao no ranking: <strong>{selectedDeputyRank ? `#${selectedDeputyRank}` : '-'}</strong></span>
                    <span>Ticket medio: <strong>{formatCurrency(selectedDeputy.ticket_medio)}</strong></span>
                    <span>% do grupo filtrado: <strong>{formatPercent(selectedDeputy.pct_total)}</strong></span>
                    <span>Categoria dominante: <strong>{selectedDeputy.categoria_principal ?? '-'}</strong></span>
                    <span>Fornecedor mais utilizado: <strong>{topSupplierForSelectedDeputy?.fornecedor ?? '-'}</strong></span>
                    <span>Fornecedores unicos: <strong>{formatCellValue(selectedDeputy.qtd_fornecedores)}</strong></span>
                    <span>Gastos atipicos: <strong>{formatCellValue(selectedDeputyAnomaly?.qtd_despesas_atipicas ?? 0)}</strong></span>
                  </div>
                </aside>
              )}

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabela Detalhada (Secundária)</h3>
              <CompactTable
                rows={asRecords(deputies.items)}
                selectedKey={selectedDeputy ? String(selectedDeputy.id_deputado) : undefined}
                onRowClick={(row) => setSelectedDeputy(row as unknown as GastoDeputadoItem)}
                columns={[
                  {
                    key: 'nome_parlamentar',
                    label: 'Deputado',
                    format: (value, row) => (
                      `${String(value)} (${String(row.sigla_partido)}-${String(row.sigla_uf)})`
                    ),
                  },
                  { key: 'valor_total', label: 'Valor total', format: formatCurrency },
                  { key: 'qtd_despesas', label: 'Despesas' },
                  { key: 'ticket_medio', label: 'Ticket medio', format: formatCurrency },
                  { key: 'categoria_principal', label: 'Categoria principal' },
                ]}
              />
            </>
          )}
        </section>
      )}

      {/* 4. Fornecedores Tab */}
      {activeTab === 'fornecedores' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Fornecedores e Alcance Parlamentar</h2>
            <p>Quem foram os principais fornecedores e qual seu alcance?</p>
          </header>
          
          <div className="gastos-filter-row" style={{ marginBottom: '16px' }}>
            <label>
              Filtrar por Categoria
              <input value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)} placeholder="Ex.: passagem" />
            </label>
            {selectedDeputy && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'bold' }}>Filtro de Deputado Ativo</span>
                <button type="button" className="gastos-clear-button" onClick={() => setSelectedDeputy(null)}>
                  Limpar ({selectedDeputy.nome_parlamentar})
                </button>
              </div>
            )}
          </div>

          {loadingFornecedores || !suppliers ? (
            <>
              <KpisSkeleton />
              <InsightsSkeleton />
              <CardsSkeleton />
              <TableSkeleton />
            </>
          ) : (
            <>
              <div className="gastos-kpi-grid">
                <article className="gastos-kpi-card">
                  <span>Fornecedor Principal</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topSupplier?.fornecedor}>{topSupplier?.fornecedor ?? '-'}</strong>
                  <small>{formatCurrency(topSupplier?.valor_total ?? 0)}</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Fornecedores no Recorte</span>
                  <strong>{formatCellValue(suppliers.summary.qtd_fornecedores)}</strong>
                </article>
                <article className="gastos-kpi-card">
                  <span>Maior Alcance</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topSupplier?.fornecedor}>{topSupplier?.fornecedor ?? '-'}</strong>
                  <small>atende {formatCellValue(topSupplier?.qtd_deputados ?? 0)} deputados</small>
                </article>
              </div>

              <InsightGrid insights={supplierInsights} />

              <div className="gastos-chart-grid">
                <ChartPanel spec={barChart('Top fornecedores por valor', 'Fornecedores com maior valor recebido.', asRecords(topSuppliers.slice(0, 5)), 'fornecedor', 'valor_total')} />
                <ChartPanel spec={barChart('Alcance por deputados atendidos', 'Quantidade de deputados atendidos por fornecedor.', asRecords(topSuppliers.slice(0, 5)), 'fornecedor', 'qtd_deputados')} />
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Ranking de Fornecedores (Clique para Analisar)</h3>
              <div className="gastos-deputy-card-grid">
                {topSuppliers.slice(0, 8).map((supplier, idx) => (
                  <button
                    type="button"
                    key={`${supplier.fornecedor}-${idx}`}
                    className={`gastos-deputy-rank-card${selectedSupplier?.fornecedor === supplier.fornecedor ? ' selected' : ''}`}
                    onClick={() => setSelectedSupplier(supplier)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '16px' }}
                  >
                    <span className="rank-number" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>#{idx + 1}</span>
                    <span className="rank-name" style={{ fontWeight: 'bold', fontSize: '0.95rem', height: '2.4em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textAlign: 'left' }} title={supplier.fornecedor}>
                      {supplier.fornecedor}
                    </span>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 'bold' }}>Valor total</span>
                      <strong style={{ fontSize: '1.1rem' }}>{formatCurrency(supplier.valor_total)}</strong>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                        <span>{formatCellValue(supplier.qtd_deputados)} deps</span>
                        <span>{formatCellValue(supplier.qtd_despesas)} despesas</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedSupplier && (
                <aside className="gastos-drilldown stagger-item" style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)' }}>Fornecedor: {selectedSupplier.fornecedor}</h3>
                    <button type="button" className="gastos-clear-button" onClick={() => setSelectedSupplier(null)}>Limpar Detalhes</button>
                  </div>
                  
                  <div className="gastos-drilldown-grid" style={{ marginTop: '12px' }}>
                    <span>Valor recebido: <strong>{formatCurrency(selectedSupplier.valor_total)}</strong></span>
                    <span>Deputados atendidos: <strong>{formatCellValue(selectedSupplier.qtd_deputados)}</strong></span>
                    <span>Qtd despesas: <strong>{formatCellValue(selectedSupplier.qtd_despesas)}</strong></span>
                    <span>Ticket medio: <strong>{formatCurrency(selectedSupplier.ticket_medio)}</strong></span>
                    <span>% do total: <strong>{formatPercent(selectedSupplier.pct_total)}</strong></span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    <div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 'bold' }}>Categorias relacionadas:</span>
                      <div className="gastos-chip-container">
                        {splitList(selectedSupplier.categorias).map((cat) => (
                          <span key={cat} className="gastos-chip gastos-chip-categoria">{cat}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 'bold' }}>Partidos relacionados:</span>
                      <div className="gastos-chip-container">
                        {splitList(selectedSupplier.partidos).map((partido) => (
                          <span key={partido} className="gastos-chip gastos-chip-partido">{partido}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 'bold' }}>Estados (UFs) relacionados:</span>
                      <div className="gastos-chip-container">
                        {splitList(selectedSupplier.ufs).map((uf) => (
                          <span key={uf} className="gastos-chip gastos-chip-uf">{uf}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>
              )}

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabela Detalhada (Secundária)</h3>
              <CompactTable
                rows={asRecords(suppliers.items)}
                selectedKey={selectedSupplier?.fornecedor}
                onRowClick={(row) => setSelectedSupplier(row as unknown as GastoFornecedorItem)}
                columns={[
                  { key: 'fornecedor', label: 'Fornecedor' },
                  { key: 'valor_total', label: 'Valor received', format: formatCurrency },
                  { key: 'qtd_despesas', label: 'Despesas' },
                  { key: 'qtd_deputados', label: 'Deputados atendidos' },
                  { key: 'ticket_medio', label: 'Ticket medio', format: formatCurrency },
                ]}
              />
            </>
          )}
        </section>
      )}

      {/* 5. Contexto Tab */}
      {activeTab === 'contexto' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Distribuição Política e Regional</h2>
            <p>Como os gastos variam por partido politico e unidade da federacao?</p>
          </header>
          {loadingContexto || !contexto ? (
            <>
              <KpisSkeleton />
              <InsightsSkeleton />
              <ChartsSkeleton count={3} />
              <TableSkeleton />
            </>
          ) : (
            <>
              <div className="gastos-kpi-grid">
                <article className="gastos-kpi-card">
                  <span>Partido Volume</span>
                  <strong>{String(topPartyByTotal?.sigla_partido ?? '-')}</strong>
                  <small>{formatCurrency(topPartyByTotal?.valor_total ?? 0)}</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Estado Volume</span>
                  <strong>{String(topUfs[0]?.sigla_uf ?? '-')}</strong>
                  <small>{formatCurrency(topUfs[0]?.valor_total ?? 0)}</small>
                </article>
                <article className="gastos-kpi-card">
                  <span>Partido Média</span>
                  <strong>{String(topPartyByAverage?.sigla_partido ?? '-')}</strong>
                  <small>{formatCurrency(topPartyByAverage?.valor_medio_por_deputado ?? 0)}/dep</small>
                </article>
              </div>

              <InsightGrid insights={contextInsights} />

              <div className="gastos-chart-grid three">
                <ChartPanel spec={barChart('Partidos por valor total', 'Volume de recursos.', topParties, 'sigla_partido', 'valor_total')} />
                <ChartPanel spec={barChart('Partidos por media/deputado', 'Intensidade por deputado.', topPartiesByAverage, 'sigla_partido', 'valor_medio_por_deputado')} />
                <ChartPanel spec={barChart('UFs por valor total', 'Volume por estado.', topUfs, 'sigla_uf', 'valor_total')} />
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Rankings de Contexto</h3>
              <div className="gastos-two-columns" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontWeight: 'bold' }}>Top Partidos (Volume de Gastos)</h4>
                  {topParties.slice(0, 5).map((party, idx) => (
                    <div key={String(party.sigla_partido)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                      <span>#{idx + 1} {String(party.sigla_partido)} ({formatCellValue(party.qtd_deputados)} deps)</span>
                      <strong>{formatCurrency(party.valor_total)}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontWeight: 'bold' }}>Top UFs (Volume de Gastos)</h4>
                  {topUfs.slice(0, 5).map((uf, idx) => (
                    <div key={String(uf.sigla_uf)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                      <span>#{idx + 1} {String(uf.sigla_uf)} ({formatCellValue(uf.qtd_deputados)} deps)</span>
                      <strong>{formatCurrency(uf.valor_total)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabelas Detalhadas</h3>
              <div className="gastos-two-columns">
                <CompactTable
                  rows={asRecords(contexto.partidos)}
                  columns={[
                    { key: 'sigla_partido', label: 'Partido' },
                    { key: 'qtd_deputados', label: 'Deputados' },
                    { key: 'valor_total', label: 'Valor total', format: formatCurrency },
                    { key: 'valor_medio_por_deputado', label: 'Media/deputado', format: formatCurrency },
                  ]}
                />
                <CompactTable
                  rows={asRecords(contexto.ufs)}
                  columns={[
                    { key: 'sigla_uf', label: 'UF' },
                    { key: 'qtd_deputados', label: 'Deputados' },
                    { key: 'valor_total', label: 'Valor total', format: formatCurrency },
                    { key: 'valor_medio_por_deputado', label: 'Media/deputado', format: formatCurrency },
                  ]}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* 6. Anomalias Tab */}
      {activeTab === 'anomalias' && (
        <section className="gastos-tab-panel">
          <header className="gastos-tab-heading">
            <h2>Detecção de Gastos Atípicos</h2>
            <p>Quais despesas apresentam comportamento estatístico incomum?</p>
          </header>
          
          {loadingAnomalias || !anomalias ? (
            <>
              <KpisSkeleton />
              <InsightsSkeleton />
              <ChartsSkeleton />
              <TableSkeleton />
            </>
          ) : (
            <>
              <div className="gastos-kpi-grid">
                <article className="gastos-kpi-card"><span>Despesas analisadas</span><strong>{formatCellValue(anomalyTotal)}</strong></article>
                <article className="gastos-kpi-card"><span>Despesas atipicas</span><strong>{formatCellValue(anomalyCount)}</strong></article>
                <article className="gastos-kpi-card"><span>Percentual</span><strong>{anomalyPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong></article>
                <article className="gastos-kpi-card"><span>Destaque de Anomalias</span><strong>{topAnomalyDeputy?.nome_parlamentar ?? '-'}</strong></article>
              </div>

              <InsightGrid insights={anomalyInsights} />

              <div className="gastos-chart-grid">
                <ChartPanel spec={barChart('Deputados por despesas atipicas', 'Ranking por quantidade de despesas fora do padrao estatistico.', asRecords(anomalyRanking.slice(0, 5)), 'nome_parlamentar', 'qtd_despesas_atipicas')} />
                
                <section className="gastos-interpretation-panel" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <h3>Como interpretar gastos atipicos</h3>
                  <p>
                    A classificacao aponta despesas fora do padrao estatistico com o modelo Isolation Forest. Ela nao representa
                    conclusao juridica, etica ou administrativa. Os motivos explicam quais caracteristicas apoiaram a classificacao.
                  </p>
                  <div className="gastos-motive-badges" style={{ marginTop: '8px' }}>
                    <span className="gastos-badge gastos-badge-atipico">Atípico</span>
                    <span className="gastos-badge gastos-badge-p95">Percentil 95</span>
                    <span className="gastos-badge gastos-badge-p99">Percentil 99</span>
                    <span className="gastos-badge gastos-badge-raro">Fornecedor Raro</span>
                    <span className="gastos-badge gastos-badge-concentrado">Fornecedor Concentrado</span>
                  </div>
                </section>
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Destaques no Ranking de Anomalias (Cards Visuais)</h3>
              <div className="gastos-deputy-card-grid anomaly" style={{ marginBottom: '24px' }}>
                {anomalyRanking.slice(0, 8).map((row, index) => (
                  <article className="gastos-deputy-rank-card" key={`${row.id_deputado}-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span className="rank-number">#{index + 1}</span>
                      <DeputyAvatar id={row.id_deputado} nome={row.nome_parlamentar} size={48} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                      <span className="rank-name" style={{ fontWeight: 'bold', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.nome_parlamentar}>
                        {row.nome_parlamentar}
                      </span>
                      <span className="rank-meta" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {row.sigla_partido}-{row.sigla_uf}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                      <span className="rank-label" style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--danger)', fontWeight: 'bold' }}>Despesas atípicas</span>
                      <strong style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>{formatCellValue(row.qtd_despesas_atipicas)}</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{formatCurrency(row.valor_atipico)} associados</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Score médio: {formatCellValue(row.score_atipicidade_medio)}</span>
                    </div>
                  </article>
                ))}
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Detalhamento Paginado</h3>
              <div className="gastos-detail-filter">
                <p style={{ margin: 0 }}>Por seguranca operacional, a base detalhada so e carregada com filtros.</p>
                
                <div className="gastos-filter-row" style={{ marginTop: '12px', marginBottom: '12px' }}>
                  <label>Deputado<input value={anomaliaFilters.deputado} onChange={(event) => setAnomaliaFilters((prev) => ({ ...prev, deputado: event.target.value }))} /></label>
                  <label>Partido<input value={anomaliaFilters.partido} onChange={(event) => setAnomaliaFilters((prev) => ({ ...prev, partido: event.target.value }))} /></label>
                  <label>UF<input value={anomaliaFilters.uf} onChange={(event) => setAnomaliaFilters((prev) => ({ ...prev, uf: event.target.value }))} /></label>
                  <label>Categoria<input value={anomaliaFilters.categoria} onChange={(event) => setAnomaliaFilters((prev) => ({ ...prev, categoria: event.target.value }))} /></label>
                  <button type="button" className="gastos-clear-button" onClick={() => { setAnomaliaPage(1); loadAnomalyDetails() }}>Carregar detalhes</button>
                </div>

                {anomaliaError && <p className="error">{anomaliaError}</p>}
                
                {anomaliaDetails && (
                  <div className="stagger-item" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    <ChartPanel spec={scatterChart(asRecords(anomaliaDetails.items))} />
                    
                    <h4 style={{ color: 'var(--primary)', margin: 0, fontWeight: 'bold' }}>Explicação das Despesas Classificadas</h4>
                    <div className="gastos-explanation-cards">
                      {anomaliaDetails.items.slice(0, 6).map((item, index) => {
                        const motivos = parseMotivos(item.motivos ?? item.motivos_json)
                        return (
                          <article className="gastos-explanation-card" key={`${item.id_gasto ?? index}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.nome_parlamentar}</span>
                              <strong style={{ color: 'var(--danger)' }}>{formatCurrency(item.valor_liquido)}</strong>
                            </header>
                            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>{item.descricao_despesa}</p>
                            
                            <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                              <MotiveBadges motivos={motivos} />
                            </div>
                            
                            <MotiveDetails motivos={motivos} />
                          </article>
                        )
                      })}
                    </div>

                    <div className="gastos-pagination">
                      <button type="button" disabled={anomaliaPage <= 1} onClick={() => setAnomaliaPage((prev) => Math.max(1, prev - 1))}>Anterior</button>
                      <span>Pagina {anomaliaDetails.summary.page} de {Math.max(1, Math.ceil(anomaliaDetails.summary.total / anomaliaDetails.summary.page_size))}</span>
                      <button
                        type="button"
                        disabled={anomaliaDetails.summary.page * anomaliaDetails.summary.page_size >= anomaliaDetails.summary.total}
                        onClick={() => setAnomaliaPage((prev) => prev + 1)}
                      >
                        Proxima
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabela Completa (Auditoria de Anomalias)</h3>
              <CompactTable
                rows={asRecords(anomalyRanking)}
                columns={[
                  { key: 'nome_parlamentar', label: 'Deputado' },
                  { key: 'qtd_despesas_atipicas', label: 'Anomalias' },
                  { key: 'valor_atipico', label: 'Valor associado', format: formatCurrency },
                  { key: 'score_atipicidade_medio', label: 'Score medio' },
                  { key: 'pct_despesas_atipicas', label: '% atipicas', format: (value) => `${formatCellValue(value)}%` },
                ]}
              />
            </>
          )}
        </section>
      )}
    </main>
  )
}
