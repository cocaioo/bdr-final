import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import {
  IDEOLOGY_SCORE_MAX,
  IDEOLOGY_SCORE_MIN,
  fieldLabel,
  rangeColor,
  rangeLabel,
  type SpectrumParty,
} from '../utils/ideology'

export type { SpectrumParty } from '../utils/ideology'
export { toSpectrumParties } from '../utils/ideology'

interface IdeologySpectrumProps {
  parties: SpectrumParty[]
}

/**
 * Visual principal do painel: posiciona cada partido ao longo do espectro
 * ideologico (score 0-10). Cada ponto e colorido pela faixa e um leve
 * deslocamento vertical (jitter deterministico) evita sobreposicoes quando
 * varios partidos tem scores proximos.
 */
export function IdeologySpectrum({ parties }: IdeologySpectrumProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const option = useMemo<echarts.EChartsOption>(() => {
    // Agrupa por score arredondado para distribuir o jitter sem colisoes.
    const buckets = new Map<number, number>()
    const points = [...parties]
      .sort((a, b) => a.score - b.score)
      .map((party) => {
        const bucket = Math.round(party.score * 2) / 2
        const seen = buckets.get(bucket) ?? 0
        buckets.set(bucket, seen + 1)
        // Alterna acima/abaixo da linha central conforme acumula no bucket.
        const offset = seen === 0 ? 0 : Math.ceil(seen / 2) * (seen % 2 === 1 ? 1 : -1)
        return {
          value: [party.score, offset * 0.85],
          name: party.sigla,
          itemStyle: { color: rangeColor(party.faixa) },
          party,
        }
      })

    return {
      grid: { left: 24, right: 24, top: 28, bottom: 56, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(20, 26, 36, 0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (raw: unknown) => {
          const p = (raw as { data: { party: SpectrumParty } }).data.party
          return [
            `<strong style="font-size:13px">${p.sigla}</strong>`,
            `<div style="margin-top:6px;line-height:1.6">`,
            `Score ideologico: <strong>${p.score.toFixed(2)}</strong>`,
            `Faixa: <strong>${rangeLabel(p.faixa)}</strong>`,
            `Campo macro: <strong>${fieldLabel(p.campo)}</strong>`,
            `Fonte: ${p.fonte || '—'}`,
            `Tipo de match: ${p.tipoMatch || '—'}`,
            `</div>`,
          ].join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        min: IDEOLOGY_SCORE_MIN,
        max: IDEOLOGY_SCORE_MAX,
        interval: 1,
        name: 'Score ideologico (0 = esquerda · 10 = direita)',
        nameLocation: 'middle',
        nameGap: 34,
        nameTextStyle: { color: '#8a9ba8', fontSize: 12 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: '#8a9ba8' },
      },
      yAxis: {
        type: 'value',
        min: -4,
        max: 4,
        show: false,
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 16,
          data: points,
          label: {
            show: true,
            formatter: (raw: unknown) => (raw as { name: string }).name,
            position: 'top',
            color: '#f8fafc',
            textBorderColor: 'rgba(15, 23, 42, 0.9)',
            textBorderWidth: 3,
            fontSize: 10,
            fontWeight: 700,
            distance: 6,
          },
          emphasis: { scale: 1.35, focus: 'self' },
        },
      ],
    }
  }, [parties])

  useEffect(() => {
    if (!ref.current) return undefined
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  // Resumo textual acessivel das extremidades do espectro.
  const extremes = useMemo(() => {
    if (!parties.length) return null
    const sorted = [...parties].sort((a, b) => a.score - b.score)
    return { left: sorted[0], right: sorted[sorted.length - 1] }
  }, [parties])

  return (
    <div>
      <div
        ref={ref}
        className="ideology-spectrum__surface"
        role="img"
        aria-label="Espectro ideologico dos partidos por score"
      />
      {extremes ? (
        <p className="ideology-spectrum__hint">
          Mais a esquerda: <strong>{extremes.left.sigla}</strong> ({extremes.left.score.toFixed(2)}) ·
          {' '}Mais a direita: <strong>{extremes.right.sigla}</strong> ({extremes.right.score.toFixed(2)})
        </p>
      ) : null}
    </div>
  )
}
