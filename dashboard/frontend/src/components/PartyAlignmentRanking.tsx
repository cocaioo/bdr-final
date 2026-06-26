import { useMemo } from 'react'

import { IdeologyBarChart, type IdeologyBar } from './IdeologyBarChart'
import { rangeColor, rangeLabel, toNumber } from '../utils/ideology'

interface PartyAlignmentRankingProps {
  rows: Array<Record<string, unknown>>
}

/** Ranking horizontal de alinhamento interno dos partidos (Q10). */
export function PartyAlignmentRanking({ rows }: PartyAlignmentRankingProps) {
  const bars = useMemo<IdeologyBar[]>(
    () =>
      rows
        .filter((row) => row.sigla_partido)
        .map((row) => {
          const faixa = String(row.ideologia_faixa ?? '')
          const pct = toNumber(row.pct_alinhamento)
          return {
            label: String(row.sigla_partido),
            value: pct,
            color: rangeColor(faixa),
            tooltip: [
              ['Faixa', rangeLabel(faixa)],
              ['Deputados', String(row.qtd_deputados ?? '—')],
              ['Votos com diretriz', toNumber(row.total_votos_com_diretriz).toLocaleString('pt-BR')],
              ['Votos alinhados', toNumber(row.votos_alinhados).toLocaleString('pt-BR')],
            ] as Array<[string, string]>,
          }
        })
        .sort((a, b) => b.value - a.value),
    [rows],
  )

  const height = Math.max(280, bars.length * 30 + 40)

  return (
    <div className="party-alignment">
      <IdeologyBarChart bars={bars} orientation="horizontal" valueSuffix="%" decimals={1} height={height} />
    </div>
  )
}
