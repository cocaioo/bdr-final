import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'

import {
  fetchDeputyExpenseBreakdown,
  fetchGastosCategorias,
  fetchGastosContexto,
  fetchGastosDeputados,
  fetchGastosFornecedores,
  fetchGastosResumo,
  fetchQuestion,
} from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { NoDataState } from '../components/NoDataState'
import { formatCellValue, formatCurrency } from '../utils/format'
import type {
  ChartSpec,
  GastoCategoriaItem,
  GastoContextoPayload,
  GastoDeputadoItem,
  GastoFornecedorItem,
  GastosCollectionPayload,
  GastosSummary,
  MetaResponse,
  QuestionPayload,
} from '../types'
import type { DeputyExpenseBreakdown } from '../api'

type GastosTab = 'resumo' | 'categorias' | 'deputados' | 'fornecedores' | 'contexto'

interface GastosDashboardPageProps {
  meta: MetaResponse
}

const TABS: Array<{ id: GastosTab; label: string; question: string }> = [
  { id: 'resumo', label: 'Resumo', question: 'Quanto foi gasto?' },
  { id: 'categorias', label: 'Categorias', question: 'Em que foi gasto?' },
  { id: 'deputados', label: 'Deputados', question: 'Quem gastou?' },
  { id: 'fornecedores', label: 'Fornecedores', question: 'Quem recebeu?' },
  { id: 'contexto', label: 'Partidos e UFs', question: 'Como os gastos variam?' },
]

const TOP_LIMIT = 10
const CATEGORY_CHART_LIMIT = 8
const SUPPLIER_CHART_LIMIT = 6
const DEPUTY_BREAKDOWN_LIMIT = 6
const CATEGORY_CHART_OPTIONS = {
  bar_category_gap: '34%',
  bar_max_width: 18,
  chart_height: 460,
  compact_tooltip: true,
  grid_bottom: 56,
  grid_left: 220,
  grid_right: 32,
  label_max_chars: 30,
  label_width: 210,
}
const SUPPLIER_CHART_OPTIONS = {
  bar_category_gap: '38%',
  bar_max_width: 18,
  chart_height: 420,
  compact_tooltip: true,
  grid_bottom: 52,
  grid_left: 196,
  grid_right: 28,
  label_max_chars: 28,
  label_width: 186,
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
  extraOptions: Record<string, unknown> = {},
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
    options: {
      currency: valueField === 'valor_total' || valueField === 'ticket_medio' || valueField === 'valor_medio_por_deputado',
      compact_axis: true,
      show_legend: false,
      ...extraOptions,
    },
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
    options: { currency: true, compact_axis: true, show_legend: false },
  }
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

function SelectionSkeleton({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <aside className="gastos-drilldown gastos-selection-skeleton" aria-live="polite">
      <div className="gastos-selection-skeleton__header">
        <div className="skeleton gastos-selection-skeleton__avatar" />
        <div className="gastos-selection-skeleton__title">
          <span>{subtitle}</span>
          <div className="skeleton skeleton-text" style={{ width: '18rem', height: '1rem' }} />
        </div>
      </div>
      <div className="gastos-selection-skeleton__grid">
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '2.9rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '2.9rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '2.9rem' }} />
        <div className="skeleton skeleton-text" style={{ width: '100%', height: '2.9rem' }} />
      </div>
      <p className="gastos-selection-skeleton__copy">{title}</p>
    </aside>
  )
}

/* ==========================================
   Standardized KPI Grid Helper
   ========================================== */
function KpiGrid({ summary }: { summary: GastosSummary }) {
  const cards = [
    ['Valor total gasto', formatCurrency(summary.valor_total)],
    ['Quantidade de despesas', formatCellValue(summary.qtd_despesas)],
    ['Despesa média', formatCurrency(summary.ticket_medio)],
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
              <span>média {formatCurrency(row.ticket_medio)}</span>
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
  columns: Array<{ key: string; label: string; format?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>
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
  const [yearSeries, setYearSeries] = useState<Array<{ ano: string; valor_total: number }>>([])

  // Loading states per tab
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [loadingDeputados, setLoadingDeputados] = useState(false)
  const [loadingFornecedores, setLoadingFornecedores] = useState(false)
  const [loadingContexto, setLoadingContexto] = useState(false)

  // Filter states
  const [ano, setAno] = useState('')
  const [partido, setPartido] = useState('')
  const [uf, setUf] = useState('')
  const [buscaDeputado, setBuscaDeputado] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [selectedDeputy, setSelectedDeputy] = useState<GastoDeputadoItem | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<GastoFornecedorItem | null>(null)
  const [selectedDeputyBreakdown, setSelectedDeputyBreakdown] = useState<{
    deputyId?: number
    data: DeputyExpenseBreakdown | null
    error: string | null
  }>({ data: null, error: null })
  const deferredBuscaDeputado = useDeferredValue(buscaDeputado)
  const deferredSelectedDeputy = useDeferredValue(selectedDeputy)
  const deferredSelectedSupplier = useDeferredValue(selectedSupplier)
  const [loadingSelectedDeputyBreakdown, setLoadingSelectedDeputyBreakdown] = useState(false)

  // Q7 - Custo-beneficio states
  const [q7Expanded, setQ7Expanded] = useState(false)
  const [q7Data, setQ7Data] = useState<QuestionPayload | null>(null)
  const [q7Loading, setQ7Loading] = useState(false)
  const [q7Error, setQ7Error] = useState<string | null>(null)

  const [q7Escopo, setQ7Escopo] = useState<'global' | 'anual'>('global')
  const [q7Ano, setQ7Ano] = useState('2023')
  const [q7Uf, setQ7Uf] = useState('')
  const [q7Partido, setQ7Partido] = useState('')
  const [q7Search, setQ7Search] = useState('')
  const [q7Page, setQ7Page] = useState(1)
  const q7PageSize = 10

  // Manual debounce for Q7 search — useDeferredValue was not reliably
  // triggering the effect in React 19, so we use an explicit timer.
  const [debouncedQ7Search, setDebouncedQ7Search] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ7Search(q7Search), 300)
    return () => clearTimeout(timer)
  }, [q7Search])


  const changeTab = (tab: GastosTab) => {
    if (tab === activeTab) return

    // Clear tab-specific filters when leaving
    if (activeTab === 'deputados') {
      setBuscaDeputado('')
    }
    if (activeTab === 'fornecedores') {
      setCategoriaFiltro('')
      setSelectedSupplier(null)
    }

    setSelectedDeputy(null)
    setActiveTab(tab)
  }

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
    fetchGastosDeputados({
      ano: ano || undefined,
      partido: partido || undefined,
      uf: uf || undefined,
      busca: deferredBuscaDeputado || undefined,
      pageSize: 100,
    })
      .then((payload) => {
        setDeputies(payload)
        setSelectedDeputy((current) => (
          current && !payload.items.some((item) => item.id_deputado === current.id_deputado)
            ? null
            : current
        ))
      })
      .catch((err) => {
        console.error('Error fetching deputies:', err)
      })
      .finally(() => {
        setLoadingDeputados(false)
      })
  }, [visitedTabs.deputados, ano, deferredBuscaDeputado, partido, uf])

  useEffect(() => {
    if (!selectedDeputy) {
      setSelectedDeputyBreakdown({ data: null, error: null })
      setLoadingSelectedDeputyBreakdown(false)
      return
    }

    let active = true
    setLoadingSelectedDeputyBreakdown(true)
    setSelectedDeputyBreakdown((current) => (
      current.deputyId === selectedDeputy.id_deputado
        ? { ...current, error: null }
        : { deputyId: selectedDeputy.id_deputado, data: null, error: null }
    ))

    fetchDeputyExpenseBreakdown(String(selectedDeputy.id_deputado), {
      ano: ano || undefined,
      partido: partido || undefined,
      uf: uf || undefined,
    })
      .then((data) => {
        if (active) {
          setSelectedDeputyBreakdown({
            deputyId: selectedDeputy.id_deputado,
            data,
            error: null,
          })
        }
      })
      .catch((err: Error) => {
        if (active) {
          setSelectedDeputyBreakdown({
            deputyId: selectedDeputy.id_deputado,
            data: null,
            error: err.message,
          })
        }
      })
      .finally(() => {
        if (active) setLoadingSelectedDeputyBreakdown(false)
      })

    return () => {
      active = false
    }
  }, [selectedDeputy, ano, partido, uf])

  // 4. Fornecedores Tab Loader
  useEffect(() => {
    if (!visitedTabs.fornecedores) return

    setLoadingFornecedores(true)
    fetchGastosFornecedores({
      categoria: categoriaFiltro || undefined,
      partido: partido || undefined,
      uf: uf || undefined,
      pageSize: 100,
    })
      .then((payload) => {
        setSuppliers(payload)
        setSelectedSupplier((current) => (
          current && !payload.items.some((item) => item.fornecedor === current.fornecedor)
            ? null
            : current
        ))
      })
      .catch((err) => {
        console.error('Error fetching suppliers:', err)
      })
      .finally(() => {
        setLoadingFornecedores(false)
      })
  }, [visitedTabs.fornecedores, categoriaFiltro, partido, uf])

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

  // Q7 - Custo-beneficio Loader
  useEffect(() => {
    let active = true
    setQ7Loading(true)
    setQ7Error(null)

    const anos = q7Expanded ? (q7Escopo === 'anual' ? [q7Ano] : []) : []
    const ufs = q7Expanded && q7Uf ? [q7Uf] : []
    const partidos = q7Expanded && q7Partido ? [q7Partido] : []
    const search = q7Expanded ? debouncedQ7Search : ''
    const page = q7Expanded ? q7Page : 1
    const pageSize = q7Expanded ? q7PageSize : 5

    fetchQuestion(
      'q7',
      {
        anos,
        eixos: [],
        partidos,
        ufs,
        deputados: [],
        escolaridade: [],
        search,
      },
      {
        page,
        pageSize,
        sortBy: 'indice_custo_beneficio',
        sortDir: 'desc',
      },
      ['anos', 'partidos', 'ufs', 'deputados']
    )
      .then((data) => {
        if (active) {
          setQ7Data(data)
          setQ7Loading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setQ7Error(err.message || 'Erro ao carregar ranking de custo-benefício')
          setQ7Loading(false)
        }
      })

    return () => {
      active = false
    }
  }, [q7Expanded, q7Escopo, q7Ano, q7Uf, q7Partido, debouncedQ7Search, q7Page, q7PageSize])

  // Reset pagination when filters change
  useEffect(() => {
    setQ7Page(1)
  }, [q7Escopo, q7Ano, q7Uf, q7Partido, debouncedQ7Search])


  // Memoized lists and fields
  const sortedCategoriesByValue = useMemo(
    () => sortByNumber(categories?.items ?? [], 'valor_total'),
    [categories],
  )
  const topCategoriesByValue = useMemo(
    () => topRows(sortedCategoriesByValue, CATEGORY_CHART_LIMIT),
    [sortedCategoriesByValue],
  )
  const categoryRankingRows = useMemo(
    () => topRows(sortedCategoriesByValue, 6),
    [sortedCategoriesByValue],
  )
  const topCategoriesByCount = useMemo(
    () => topRows(sortByNumber(categories?.items ?? [], 'qtd_despesas'), CATEGORY_CHART_LIMIT),
    [categories],
  )
  const topCategoriesByTicket = useMemo(
    () => topRows(sortByNumber(categories?.items ?? [], 'ticket_medio'), CATEGORY_CHART_LIMIT),
    [categories],
  )
  const topDeputies = useMemo(() => topRows(deputies?.items ?? []), [deputies])
  const topSuppliers = useMemo(() => topRows(suppliers?.items ?? [], SUPPLIER_CHART_LIMIT), [suppliers])
  const selectedDeputyExpenseBreakdown = useMemo(
    () => (
      deferredSelectedDeputy && selectedDeputyBreakdown.deputyId === deferredSelectedDeputy.id_deputado
        ? selectedDeputyBreakdown.data
        : null
    ),
    [deferredSelectedDeputy, selectedDeputyBreakdown],
  )
  const selectedDeputyBreakdownError = useMemo(
    () => (
      deferredSelectedDeputy && selectedDeputyBreakdown.deputyId === deferredSelectedDeputy.id_deputado
        ? selectedDeputyBreakdown.error
        : null
    ),
    [deferredSelectedDeputy, selectedDeputyBreakdown],
  )
  const topSelectedDeputySuppliers = useMemo(
    () => topRows(selectedDeputyExpenseBreakdown?.suppliers ?? [], DEPUTY_BREAKDOWN_LIMIT),
    [selectedDeputyExpenseBreakdown],
  )
  const topSelectedDeputyCategories = useMemo(
    () => topRows(selectedDeputyExpenseBreakdown?.categories ?? [], DEPUTY_BREAKDOWN_LIMIT),
    [selectedDeputyExpenseBreakdown],
  )
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
  
  const topCategory = topCategoriesByValue[0]
  const mostFrequentCategory = topCategoriesByCount[0]
  const highestTicketCategory = topCategoriesByTicket[0]
  const topSupplier = topSuppliers[0]
  
  const selectedDeputyRank = selectedDeputy && deputies
    ? rankInRows(deputies.items, (item) => item.id_deputado === selectedDeputy.id_deputado)
    : null
  const selectedDeputyShare = deferredSelectedDeputy && deputies?.summary.valor_total
    ? (deferredSelectedDeputy.valor_total / deputies.summary.valor_total) * 100
    : 0
  const isDeputyProfileUpdating =
    selectedDeputy !== deferredSelectedDeputy ||
    (Boolean(deferredSelectedDeputy) && (
      loadingSelectedDeputyBreakdown ||
      selectedDeputyBreakdown.deputyId !== deferredSelectedDeputy?.id_deputado
    ))
  const isSupplierProfileUpdating = selectedSupplier !== deferredSelectedSupplier
  
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
          title: 'Maior valor médio por despesa',
          body: `${highestTicketCategory.categoria} tem valor médio por despesa de ${formatCurrency(highestTicketCategory.ticket_medio)}, sinalizando despesas individuais mais altas.`,
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

  return (
    <main className="gastos-dashboard-premium gastos-story-dashboard">
      {/* Dynamic Header Section */}
      <section className="premium-hero stagger-item">
        <div className="premium-hero-content">
          <h1>Painel de Gastos Parlamentares</h1>
          <p>
            Uma jornada analitica: quanto foi gasto, em que categorias, por quais deputados, com quais fornecedores,
            e em quais contextos politicos.
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
            onClick={() => changeTab(tab.id)}
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
                    'Top 8 categorias com maior valor total gasto. Passe o cursor para ver o nome completo.',
                    asRecords(topCategoriesByValue),
                    'categoria',
                    'valor_total',
                    'bar_horizontal',
                    CATEGORY_CHART_OPTIONS,
                  )}
                />
              </div>

              {/* Seção Custo-benefício parlamentar (Q7) */}
              <section className="gastos-q7-section premium-card" style={{ marginTop: '32px', padding: '24px' }}>
                <header className="gastos-tab-heading" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        Custo-beneficio parlamentar (Q7)
                      </h3>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
                        Indice comparativo que pondera a producao legislativa e o gasto total do deputado.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="gastos-clear-button"
                      style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => {
                        setQ7Expanded(!q7Expanded)
                        // Reset Q7 filters when collapsing/expanding
                        setQ7Escopo('global')
                        setQ7Ano('2023')
                        setQ7Uf('')
                        setQ7Partido('')
                        setQ7Search('')
                      }}
                    >
                      {q7Expanded ? 'Recolher analise' : 'Ver analise completa'}
                    </button>
                  </div>
                  <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                    <strong>Metodologia curta:</strong> Pondera proposicoes por tipo (ex: PEC tem peso 10, PL tem peso 6), status de tramitacao e autoria (peso maior para autor principal), aplicando suavizacao de potencia 0.75 nos gastos e score para evitar distorcoes de valores extremos. Apenas deputados elegiveis aparecem no ranking principal (gasto &gt;= R$ 10.000, score proposicoes &gt;= 5, total proposicoes &gt;= 2, sendo pelo menos 1 substantiva).
                  </p>
                </header>

                {q7Loading && !q7Data ? (
                  <TableSkeleton />
                ) : q7Error ? (
                  <p style={{ color: 'var(--danger)' }}>{q7Error}</p>
                ) : q7Data ? (
                  <>
                    {q7Expanded && (
                      <div className="gastos-filter-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px', background: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 120px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Escopo</span>
                          <select
                            aria-label="Escopo"
                            value={q7Escopo}
                            onChange={(e) => setQ7Escopo(e.target.value as 'global' | 'anual')}
                            style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                          >
                            <option value="global">Global</option>
                            <option value="anual">Anual</option>
                          </select>
                        </label>

                        {q7Escopo === 'anual' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 100px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Ano</span>
                            <select
                              aria-label="Ano"
                              value={q7Ano}
                              onChange={(e) => setQ7Ano(e.target.value)}
                              style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                            >
                              <option value="2023">2023</option>
                              <option value="2024">2024</option>
                              <option value="2025">2025</option>
                              <option value="2026">2026</option>
                            </select>
                          </label>
                        )}

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Partido</span>
                          <select value={q7Partido} onChange={(e) => setQ7Partido(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                            <option value="">Todos</option>
                            {(meta.available_filters.partidos ?? []).map((choice) => (
                              <option key={choice.value} value={choice.value}>{choice.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>UF</span>
                          <select value={q7Uf} onChange={(e) => setQ7Uf(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                            <option value="">Todas</option>
                            {(meta.available_filters.ufs ?? []).map((choice) => (
                              <option key={choice.value} value={choice.value}>{choice.label}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Busca por Nome</span>
                          <input
                            type="text"
                            value={q7Search}
                            onChange={(e) => setQ7Search(e.target.value)}
                            placeholder="Digite o nome do deputado..."
                            style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                          />
                        </label>
                      </div>
                    )}

                    <CompactTable
                      rows={asRecords(q7Data.table_spec.rows)}
                      columns={[
                        {
                          key: 'posicao',
                          label: 'Posição',
                          format: (val, row) => {
                            const hasGeoPartyFilter = !!(q7Uf || q7Partido)
                            const posFiltro = row.posicao_no_filtro !== undefined && row.posicao_no_filtro !== null ? String(row.posicao_no_filtro) : ''
                            const posGeral = String(row.posicao_geral ?? val ?? '')

                            if (hasGeoPartyFilter && posFiltro) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>#{posFiltro} no filtro</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>#{posGeral} geral</span>
                                </div>
                              )
                            }
                            return <strong style={{ fontSize: '1.1rem' }}>#{posGeral}</strong>
                          }
                        },
                        {
                          key: 'nome_parlamentar',
                          label: 'Deputado',
                          format: (val, row) => {
                            const nameStr = String(val || '')
                            const partidoStr = String(row.sigla_partido || '')
                            const ufStr = String(row.sigla_uf || '')
                            const isPartial = !!row.ano_parcial
                            const idDep = String(row.id_deputado || '')

                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <DeputyAvatar id={Number(idDep)} nome={nameStr} size={40} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 'bold' }}>{nameStr}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                    {partidoStr} - {ufStr}
                                    {isPartial && (
                                      <span className="badge-2026-parcial" style={{ marginLeft: '6px', background: 'var(--primary-light, #e0f2fe)', color: 'var(--primary, #0284c7)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        2026 parcial
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            )
                          }
                        },
                        {
                          key: 'indice_custo_beneficio',
                          label: 'Índice custo-benefício',
                          format: (val) => {
                            const numVal = Number(val || 0)
                            return <strong style={{ color: 'var(--primary)' }}>{numVal.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}</strong>
                          }
                        },
                        {
                          key: 'gasto_total',
                          label: 'Gasto total',
                          format: (val) => formatCurrency(val)
                        },
                        {
                          key: 'total_proposicoes',
                          label: 'Proposições',
                          format: (val, row) => {
                            const total = Number(val || 0)
                            const substantivas = Number(row.total_proposicoes_substantivas || 0)
                            const aprovadas = Number(row.total_proposicoes_aprovadas || 0)
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                                <span>Total: {total}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Substantivas: {substantivas}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Aprovadas: {aprovadas}</span>
                              </div>
                            )
                          }
                        }
                      ]}
                    />

                    {q7Expanded && q7Data.table_spec.total > q7PageSize && (
                      <div className="gastos-pagination-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                          Mostrando {((q7Page - 1) * q7PageSize) + 1} - {Math.min(q7Page * q7PageSize, q7Data.table_spec.total)} de {q7Data.table_spec.total} deputados
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={q7Page <= 1}
                            onClick={() => setQ7Page(q7Page - 1)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', cursor: q7Page <= 1 ? 'not-allowed' : 'pointer', opacity: q7Page <= 1 ? 0.5 : 1 }}
                          >
                            Anterior
                          </button>
                          <button
                            type="button"
                            disabled={q7Page * q7PageSize >= q7Data.table_spec.total}
                            onClick={() => setQ7Page(q7Page + 1)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', cursor: q7Page * q7PageSize >= q7Data.table_spec.total ? 'not-allowed' : 'pointer', opacity: q7Page * q7PageSize >= q7Data.table_spec.total ? 0.5 : 1 }}
                          >
                            Próxima
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </section>
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
                  <span>Maior valor médio por despesa</span>
                  <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={highestTicketCategory?.categoria}>{highestTicketCategory?.categoria ?? '-'}</strong>
                  <small>{formatCurrency(highestTicketCategory?.ticket_medio ?? 0)}/despesa</small>
                </article>
              </div>
              <InsightGrid insights={categoryInsights} />
              <div className="gastos-chart-grid">
                <ChartPanel
                  spec={barChart(
                    'Top categorias por valor',
                    'Concentracao de recursos nas categorias mais relevantes do recorte.',
                    asRecords(topCategoriesByValue),
                    'categoria',
                    'valor_total',
                    'bar_horizontal',
                    CATEGORY_CHART_OPTIONS,
                  )}
                />
                <ChartPanel
                  spec={barChart(
                    'Valor médio por despesa por categoria',
                    'Categorias com despesas individuais mais altas no Top 8.',
                    asRecords(topCategoriesByTicket),
                    'categoria',
                    'ticket_medio',
                    'bar_horizontal',
                    CATEGORY_CHART_OPTIONS,
                  )}
                />
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Ranking de Categorias</h3>
              <div className="gastos-category-card-grid" style={{ marginBottom: '24px' }}>
                {categoryRankingRows.map((cat, idx) => (
                  <div key={`${cat.categoria}-${idx}`} className="gastos-category-rank-card" style={{ cursor: 'default', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="rank-number">#{idx + 1}</span>
                    <span className="gastos-category-rank-card__title" title={cat.categoria}>{cat.categoria}</span>
                    <span className="rank-label">Valor total</span>
                    <strong>{formatCurrency(cat.valor_total)}</strong>
                    <small>{formatCellValue(cat.qtd_despesas)} despesas | valor médio por despesa {formatCurrency(cat.ticket_medio)}</small>
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
                  { key: 'ticket_medio', label: 'Valor médio por despesa', format: formatCurrency },
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
                onSelect={(row) => {
                  startTransition(() => {
                    setSelectedDeputy(row)
                  })
                }}
              />

              {selectedDeputy && isDeputyProfileUpdating ? (
                <SelectionSkeleton
                  subtitle="Carregando detalhe"
                  title="Preparando o drilldown do deputado a partir das fontes canônicas Q12 e Q13."
                />
              ) : null}

              {deferredSelectedDeputy && !isDeputyProfileUpdating && (
                <aside className="gastos-drilldown gastos-deputy-profile stagger-item" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <DeputyAvatar id={deferredSelectedDeputy.id_deputado} nome={deferredSelectedDeputy.nome_parlamentar} size={64} />
                      <div>
                        <small style={{ color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem' }}>Analisando deputado:</small>
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '1.4rem' }}>{deferredSelectedDeputy.nome_parlamentar}</h3>
                        <p style={{ margin: '2px 0 0 0', color: 'var(--muted)' }}>{deferredSelectedDeputy.sigla_partido} - {deferredSelectedDeputy.sigla_uf}</p>
                      </div>
                    </div>
                    <button type="button" className="gastos-clear-button" onClick={() => setSelectedDeputy(null)}>
                      Fechar Analise
                    </button>
                  </div>

                  <div className="gastos-drilldown-grid" style={{ marginTop: '12px' }}>
                    <span>Valor total: <strong>{formatCurrency(deferredSelectedDeputy.valor_total)}</strong></span>
                    <span>Posicao no ranking: <strong>{selectedDeputyRank ? `#${selectedDeputyRank}` : '-'}</strong></span>
                    <span>Valor médio por despesa: <strong>{formatCurrency(deferredSelectedDeputy.ticket_medio)}</strong></span>
                    <span>% do grupo filtrado: <strong>{formatPercent(selectedDeputyShare)}</strong></span>
                    <span>Categoria dominante: <strong>{deferredSelectedDeputy.categoria_principal ?? '-'}</strong></span>
                    <span>Fornecedores unicos: <strong>{formatCellValue(deferredSelectedDeputy.qtd_fornecedores)}</strong></span>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <small style={{ color: 'var(--muted)' }}>
                      Detalhamento do deputado selecionado. Fonte canônica: Q12 e Q13, com percentuais calculados sobre o total do próprio deputado.
                    </small>
                  </div>

                  {selectedDeputyBreakdownError ? (
                    <p style={{ marginTop: '12px' }}>Não foi possível carregar o drilldown do deputado agora.</p>
                  ) : null}

                  {selectedDeputyExpenseBreakdown ? (
                    <>
                      <div className="gastos-kpi-grid" style={{ marginTop: '16px' }}>
                        <article className="gastos-kpi-card">
                          <span>Fonte do drilldown</span>
                          <strong>{selectedDeputyExpenseBreakdown.source.toUpperCase()}</strong>
                          <small>{formatCurrency(selectedDeputyExpenseBreakdown.total)} no recorte do deputado</small>
                        </article>
                        <article className="gastos-kpi-card">
                          <span>Top fornecedor do deputado</span>
                          <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topSelectedDeputySuppliers[0]?.fornecedor}>
                            {topSelectedDeputySuppliers[0]?.fornecedor ?? '-'}
                          </strong>
                          <small>
                            {topSelectedDeputySuppliers[0]
                              ? `${formatCurrency(topSelectedDeputySuppliers[0].valor_total)} (${formatPercent(topSelectedDeputySuppliers[0].pct_total)})`
                              : ''}
                          </small>
                        </article>
                        <article className="gastos-kpi-card">
                          <span>Top categoria do deputado</span>
                          <strong style={{ fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topSelectedDeputyCategories[0]?.categoria}>
                            {topSelectedDeputyCategories[0]?.categoria ?? '-'}
                          </strong>
                          <small>
                            {topSelectedDeputyCategories[0]
                              ? `${formatCurrency(topSelectedDeputyCategories[0].valor_total)} (${formatPercent(topSelectedDeputyCategories[0].pct_total)})`
                              : ''}
                          </small>
                        </article>
                      </div>

                      <div className="gastos-two-columns" style={{ marginTop: '20px' }}>
                        <div>
                          <h4 style={{ marginBottom: '12px' }}>Top fornecedores do deputado (Q12)</h4>
                          <CompactTable
                            rows={asRecords(topSelectedDeputySuppliers)}
                            columns={[
                              { key: 'fornecedor', label: 'Fornecedor' },
                              { key: 'valor_total', label: 'Valor do deputado', format: formatCurrency },
                              { key: 'pct_total', label: '% do deputado', format: (value) => formatPercent(value) },
                              { key: 'qtd_despesas', label: 'Despesas' },
                            ]}
                          />
                        </div>
                        <div>
                          <h4 style={{ marginBottom: '12px' }}>Top categorias do deputado (Q13)</h4>
                          <CompactTable
                            rows={asRecords(topSelectedDeputyCategories)}
                            columns={[
                              { key: 'categoria', label: 'Categoria' },
                              { key: 'valor_total', label: 'Valor do deputado', format: formatCurrency },
                              { key: 'pct_total', label: '% do deputado', format: (value) => formatPercent(value) },
                              { key: 'qtd_despesas', label: 'Despesas' },
                            ]}
                          />
                        </div>
                      </div>

                      {selectedDeputyExpenseBreakdown.partialErrors.length ? (
                        <p style={{ marginTop: '12px' }}>
                          Alguns recortes do drilldown não puderam ser carregados: {selectedDeputyExpenseBreakdown.partialErrors.join(', ')}.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </aside>
              )}

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Tabela Detalhada (Secundária)</h3>
              <CompactTable
                rows={asRecords(deputies.items)}
                selectedKey={selectedDeputy ? String(selectedDeputy.id_deputado) : undefined}
                onRowClick={(row) => {
                  startTransition(() => {
                    setSelectedDeputy(row as unknown as GastoDeputadoItem)
                  })
                }}
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
                  { key: 'ticket_medio', label: 'Valor médio por despesa', format: formatCurrency },
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
                <ChartPanel
                  spec={barChart(
                    'Top fornecedores por valor',
                    'Fornecedores com maior valor recebido no recorte.',
                    asRecords(topSuppliers),
                    'fornecedor',
                    'valor_total',
                    'bar_horizontal',
                    SUPPLIER_CHART_OPTIONS,
                  )}
                />
                <ChartPanel
                  spec={barChart(
                    'Alcance por deputados atendidos',
                    'Quantidade de deputados atendidos por fornecedor.',
                    asRecords(topSuppliers),
                    'fornecedor',
                    'qtd_deputados',
                    'bar_horizontal',
                    SUPPLIER_CHART_OPTIONS,
                  )}
                />
              </div>

              <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Ranking de Fornecedores (Clique para Analisar)</h3>
              <div className="gastos-deputy-card-grid">
                {topSuppliers.map((supplier, idx) => (
                  <button
                    type="button"
                    key={`${supplier.fornecedor}-${idx}`}
                    className={`gastos-deputy-rank-card${selectedSupplier?.fornecedor === supplier.fornecedor ? ' selected' : ''}`}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedSupplier(supplier)
                      })
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '16px' }}
                  >
                    <span className="rank-number" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>#{idx + 1}</span>
                    <span className="rank-name gastos-supplier-rank-name" title={supplier.fornecedor}>
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

              {selectedSupplier && isSupplierProfileUpdating ? (
                <SelectionSkeleton
                  subtitle="Carregando fornecedor"
                  title="Preparando o perfil do fornecedor com contraste e métricas legíveis."
                />
              ) : null}

              {deferredSelectedSupplier && !isSupplierProfileUpdating && (
                <aside className="gastos-drilldown gastos-supplier-profile stagger-item" style={{ marginTop: '20px' }}>
                  <div className="gastos-supplier-profile__header">
                    <h3 className="gastos-supplier-profile__title">Fornecedor: {deferredSelectedSupplier.fornecedor}</h3>
                    <button type="button" className="gastos-clear-button" onClick={() => setSelectedSupplier(null)}>Limpar Detalhes</button>
                  </div>
                  
                  <div className="gastos-drilldown-grid" style={{ marginTop: '12px' }}>
                    <span>Valor recebido: <strong>{formatCurrency(deferredSelectedSupplier.valor_total)}</strong></span>
                    <span>Deputados atendidos: <strong>{formatCellValue(deferredSelectedSupplier.qtd_deputados)}</strong></span>
                    <span>Qtd despesas: <strong>{formatCellValue(deferredSelectedSupplier.qtd_despesas)}</strong></span>
                    <span>Valor médio por despesa: <strong>{formatCurrency(deferredSelectedSupplier.ticket_medio)}</strong></span>
                    <span>% do total: <strong>{formatPercent(deferredSelectedSupplier.pct_total)}</strong></span>
                  </div>

                  <div className="gastos-supplier-profile__groups">
                    <div>
                      <span className="gastos-supplier-profile__label">Categorias relacionadas:</span>
                      <div className="gastos-chip-container">
                        {splitList(deferredSelectedSupplier.categorias).map((cat) => (
                          <span key={cat} className="gastos-chip gastos-chip-categoria">{cat}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="gastos-supplier-profile__label">Partidos relacionados:</span>
                      <div className="gastos-chip-container">
                        {splitList(deferredSelectedSupplier.partidos).map((partido) => (
                          <span key={partido} className="gastos-chip gastos-chip-partido">{partido}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="gastos-supplier-profile__label">Estados (UFs) relacionados:</span>
                      <div className="gastos-chip-container">
                        {splitList(deferredSelectedSupplier.ufs).map((uf) => (
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
                onRowClick={(row) => {
                  startTransition(() => {
                    setSelectedSupplier(row as unknown as GastoFornecedorItem)
                  })
                }}
                columns={[
                  { key: 'fornecedor', label: 'Fornecedor' },
                  { key: 'valor_total', label: 'Valor received', format: formatCurrency },
                  { key: 'qtd_despesas', label: 'Despesas' },
                  { key: 'qtd_deputados', label: 'Deputados atendidos' },
                  { key: 'ticket_medio', label: 'Valor médio por despesa', format: formatCurrency },
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

    </main>
  )
}
