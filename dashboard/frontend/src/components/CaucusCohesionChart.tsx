import { useMemo } from 'react'

import { IdeologyBarChart, type IdeologyBar } from './IdeologyBarChart'
import { rangeColor, rangeLabel } from '../utils/ideology'
import type { CaucusCohesion } from '../utils/q14'

interface CaucusCohesionChartProps {
  cohesion: CaucusCohesion[]
}

/**
 * Coesao interna das bancadas (Q14): barras horizontais ordenadas da bancada
 * mais coesa (menor desvio medio absoluto) para a menos coesa. Para que a
 * barra mais longa represente "mais coeso", invertemos a metrica em um indice
 * de coesao = max(0, 10 - desvio_medio_abs). Cor por faixa ideologica.
 */
export function CaucusCohesionChart({ cohesion }: CaucusCohesionChartProps) {
  const bars = useMemo<IdeologyBar[]>(() => {
    return cohesion
      .map((c) => {
        const cohesionIndex = Math.max(0, 10 - c.deviationMeanAbs)
        return {
          label: c.party,
          value: Number(cohesionIndex.toFixed(2)),
          color: rangeColor(c.partyBand),
          tooltip: [
            ['Faixa', rangeLabel(c.partyBand)],
            ['Deputados', String(c.numDeputies)],
            ['Desvio médio interno', c.deviationMeanAbs.toFixed(2)],
            ['Desvio máximo', c.deviationMaxAbs.toFixed(2)],
          ] as Array<[string, string]>,
        }
      })
      // Maior indice (mais coeso) primeiro; IdeologyBarChart inverte p/ topo.
      .sort((a, b) => b.value - a.value)
  }, [cohesion])

  const height = Math.max(280, bars.length * 26 + 40)

  if (!bars.length) return null

  return (
    <div className="caucus-cohesion">
      <IdeologyBarChart bars={bars} orientation="horizontal" decimals={1} height={height} />
      <p className="caucus-cohesion__hint">
        Índice de coesão (0–10): quanto maior a barra, mais a bancada vota de forma uniforme.
        Calculado como 10 menos o desvio médio interno absoluto. Bancadas com um único deputado
        são exibidas, mas devem ser interpretadas com cautela.
      </p>
    </div>
  )
}
