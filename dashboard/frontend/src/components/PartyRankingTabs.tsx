import { useMemo, useState } from 'react'

import { IdeologyBarChart, type IdeologyBar } from './IdeologyBarChart'
import { IdeologyBadge } from './IdeologyBadge'
import { rangeColor, toNumber } from '../utils/ideology'

export interface Q11Tables {
  /** Q11.a — ranking por frequencia nas votacoes (table_spec principal). */
  voting: Array<Record<string, unknown>>
  /** Q11.b — ranking por proposicoes de projetos. */
  bills: Array<Record<string, unknown>>
  /** Q11.c — ranking por gastos. */
  spending: Array<Record<string, unknown>>
}

interface PartyRankingTabsProps {
  tables: Q11Tables
}

type TabKey = 'voting' | 'bills' | 'spending' | 'composite'

interface PartyMetric {
  sigla: string
  faixa: string
  value: number
  display: string
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'voting', label: 'Votações' },
  { key: 'bills', label: 'Proposições' },
  { key: 'spending', label: 'Gastos' },
  { key: 'composite', label: 'Score composto' },
]

function formatInt(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatBRL(value: number): string {
  if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
}

function buildMetric(
  rows: Array<Record<string, unknown>>,
  field: string,
  format: (v: number) => string,
): PartyMetric[] {
  return rows
    .filter((row) => row.sigla_partido)
    .map((row) => {
      const value = toNumber(row[field])
      return {
        sigla: String(row.sigla_partido),
        faixa: String(row.ideologia_faixa ?? ''),
        value,
        display: format(value),
      }
    })
    .sort((a, b) => b.value - a.value)
}

type SortKey = 'sigla' | 'faixa' | 'value'

export function PartyRankingTabs({ tables }: PartyRankingTabsProps) {
  const [active, setActive] = useState<TabKey>('voting')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' })

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'value' ? 'desc' : 'asc' },
    )

  const metrics = useMemo<Record<TabKey, PartyMetric[]>>(() => {
    const voting = buildMetric(tables.voting, 'votacoes_participadas', formatInt)
    const bills = buildMetric(tables.bills, 'total_proposicoes', formatInt)
    const spending = buildMetric(tables.spending, 'gasto_total', formatBRL)

    // Score composto: media das tres dimensoes normalizadas (min-max -> 0-100).
    const norm = (items: PartyMetric[]) => {
      const max = Math.max(1, ...items.map((i) => i.value))
      return new Map(items.map((i) => [i.sigla, (i.value / max) * 100]))
    }
    const nv = norm(voting)
    const nb = norm(bills)
    const ns = norm(spending)
    const faixaBySigla = new Map<string, string>()
    ;[...voting, ...bills, ...spending].forEach((m) => {
      if (!faixaBySigla.has(m.sigla)) faixaBySigla.set(m.sigla, m.faixa)
    })
    const composite: PartyMetric[] = [...faixaBySigla.keys()]
      .map((sigla) => {
        const parts = [nv.get(sigla), nb.get(sigla), ns.get(sigla)].filter(
          (v): v is number => typeof v === 'number',
        )
        const value = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0
        return {
          sigla,
          faixa: faixaBySigla.get(sigla) ?? '',
          value: Number(value.toFixed(1)),
          display: value.toFixed(1),
        }
      })
      .sort((a, b) => b.value - a.value)

    return { voting, bills, spending, composite }
  }, [tables])

  const current = metrics[active]

  const sortedRows = useMemo(() => {
    const rows = current.map((m, idx) => ({ ...m, rank: idx + 1 }))
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'value') return (a.value - b.value) * factor
      return a[sort.key].localeCompare(b[sort.key], 'pt-BR', { sensitivity: 'base' }) * factor
    })
  }, [current, sort])

  const sortIndicator = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  const valueHeader =
    active === 'voting'
      ? 'Votações participadas'
      : active === 'bills'
        ? 'Proposições'
        : active === 'spending'
          ? 'Gasto total'
          : 'Score (0-100)'

  const topBars = useMemo<IdeologyBar[]>(
    () =>
      current.slice(0, 10).map((m) => ({
        label: m.sigla,
        value: m.value,
        color: rangeColor(m.faixa),
        tooltip: [['Valor', m.display]] as Array<[string, string]>,
      })),
    [current],
  )

  return (
    <div className="ranking-tabs">
      <div className="ranking-tabs__controls" role="tablist" aria-label="Dimensoes de ranking">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            className={`ranking-tabs__tab${active === tab.key ? ' is-active' : ''}`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ranking-tabs__panel">
        <div className="ranking-tabs__chart">
          <IdeologyBarChart
            bars={topBars}
            orientation="horizontal"
            valueSuffix={active === 'spending' ? '' : ''}
            decimals={active === 'composite' ? 1 : 0}
            height={Math.max(260, topBars.length * 28 + 30)}
          />
          <p className="ranking-tabs__chart-note">Top 10 partidos nesta dimensão.</p>
        </div>

        <div className="ranking-tabs__table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('sigla')}>Partido{sortIndicator('sigla')}</button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('faixa')}>Faixa{sortIndicator('faixa')}</button>
                </th>
                <th scope="col" className="ranking-table__num">
                  <button type="button" onClick={() => toggleSort('value')}>{valueHeader}{sortIndicator('value')}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((m) => (
                <tr key={m.sigla}>
                  <td>{m.rank}</td>
                  <td><strong>{m.sigla}</strong></td>
                  <td><IdeologyBadge range={m.faixa} /></td>
                  <td className="ranking-table__num">{m.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
