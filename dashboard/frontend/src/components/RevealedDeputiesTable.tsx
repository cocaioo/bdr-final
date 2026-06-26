import { useMemo, useState } from 'react'

import { IdeologyBadge } from './IdeologyBadge'
import type { RevealedDeputy } from '../utils/q14'

interface RevealedDeputiesTableProps {
  deputies: RevealedDeputy[]
  /** Começa recolhida por padrão para manter a interface limpa. */
  defaultOpen?: boolean
}

type SortKey = 'name' | 'party' | 'partyScore' | 'calibratedScore' | 'partyDeviation'

/**
 * Tabela completa dos deputados de Q14 — colapsável e fechada por padrão.
 * Aparece apenas ao final do bloco, depois das visualizações e resumos.
 */
export function RevealedDeputiesTable({ deputies, defaultOpen = false }: RevealedDeputiesTableProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'partyDeviation',
    dir: 'desc',
  })

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: typeof deputies[0]?.[key] === 'number' ? 'desc' : 'asc' },
    )

  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...deputies].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' }) * factor
    })
  }, [deputies, sort])

  const indicator = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <div className="revealed-table">
      <button
        type="button"
        className="revealed-table__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▼' : '►'} Tabela completa de deputados ({deputies.length.toLocaleString('pt-BR')})
      </button>

      {open ? (
        <div className="revealed-table__wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('name')}>Deputado{indicator('name')}</button>
                </th>
                <th scope="col">
                  <button type="button" onClick={() => toggleSort('party')}>Partido{indicator('party')}</button>
                </th>
                <th scope="col">Faixa</th>
                <th scope="col" className="ranking-table__num">
                  <button type="button" onClick={() => toggleSort('partyScore')}>Score partido{indicator('partyScore')}</button>
                </th>
                <th scope="col" className="ranking-table__num">
                  <button type="button" onClick={() => toggleSort('calibratedScore')}>Score calibrado{indicator('calibratedScore')}</button>
                </th>
                <th scope="col" className="ranking-table__num">
                  <button type="button" onClick={() => toggleSort('partyDeviation')}>Desvio{indicator('partyDeviation')}</button>
                </th>
                <th scope="col">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, index) => (
                <tr key={d.deputyId || `${d.name}-${index}`}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.party}</td>
                  <td><IdeologyBadge range={d.partyBand} /></td>
                  <td className="ranking-table__num">{d.partyScore.toFixed(2)}</td>
                  <td className="ranking-table__num">{d.calibratedScore.toFixed(2)}</td>
                  <td className="ranking-table__num">{d.partyDeviation.toFixed(2)}</td>
                  <td>{d.confidenceBand || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
