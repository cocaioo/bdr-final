import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'

import { DeputyAvatar } from './DeputyAvatar'
import { IdeologyBadge } from './IdeologyBadge'
import { ALIGNMENT_TOLERANCE, classifyDeviation, type DeviationDirection, type RevealedDeputy } from '../utils/q14'

interface RevealedPositionScatterProps {
  deputies: RevealedDeputy[]
  height?: number
}

// Cores das tres situacoes de desvio. Sobrias e distintas, alinhadas a paleta
// ideologica do app (azul = esquerda, cinza = alinhado, vermelho-tijolo = direita).
const DEVIATION_STYLE: Record<DeviationDirection, { color: string; label: string; short: string; title: string }> = {
  'mais a esquerda': {
    color: '#468bc7',
    label: 'Mais à esquerda que o partido',
    short: 'À esquerda',
    title: 'Deputados mais à esquerda que o partido',
  },
  alinhado: {
    color: '#8895a3',
    label: 'Alinhado ao partido',
    short: 'Alinhados',
    title: 'Deputados alinhados ao partido',
  },
  'mais a direita': {
    color: '#cf673f',
    label: 'Mais à direita que o partido',
    short: 'À direita',
    title: 'Deputados mais à direita que o partido',
  },
}

const ORDER: DeviationDirection[] = ['mais a esquerda', 'alinhado', 'mais a direita']

// Histograma de desvio: largura de cada faixa e limite simetrico dos eixos.
const BIN_WIDTH = 0.5
const BIN_LIMIT = 6
const INITIAL_VISIBLE = 10
const STEP_VISIBLE = 20

function formatScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—'
}

export function RevealedPositionScatter({ deputies, height = 420 }: RevealedPositionScatterProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const [selected, setSelected] = useState<DeviationDirection | null>(null)
  const [visible, setVisible] = useState(INITIAL_VISIBLE)

  // Classificacao numerica (fonte de verdade): desvio em relacao ao partido.
  const byCategory = useMemo(() => {
    const groups: Record<DeviationDirection, RevealedDeputy[]> = {
      'mais a esquerda': [],
      alinhado: [],
      'mais a direita': [],
    }
    deputies.forEach((d) => {
      groups[classifyDeviation(d.partyDeviation)].push(d)
    })
    // Ordena cada grupo por |desvio| decrescente.
    ORDER.forEach((key) => {
      groups[key].sort((a, b) => Math.abs(b.partyDeviation) - Math.abs(a.partyDeviation))
    })
    return groups
  }, [deputies])

  const summary = useMemo(() => {
    const total = deputies.length || 1
    return ORDER.map((key) => ({
      key,
      count: byCategory[key].length,
      pct: (byCategory[key].length / total) * 100,
    }))
  }, [byCategory, deputies.length])

  const selectDirection = (key: DeviationDirection | null) => {
    setSelected(key)
    setVisible(INITIAL_VISIBLE)
  }

  const option = useMemo<echarts.EChartsOption>(() => {
    const binCount = Math.round((BIN_LIMIT * 2) / BIN_WIDTH)
    const start = -BIN_LIMIT
    const centers: number[] = []
    const leftCounts: number[] = []
    const alignedCounts: number[] = []
    const rightCounts: number[] = []

    for (let b = 0; b < binCount; b += 1) {
      const lo = start + b * BIN_WIDTH
      centers.push(Number((lo + BIN_WIDTH / 2).toFixed(2)))
      leftCounts.push(0)
      alignedCounts.push(0)
      rightCounts.push(0)
    }

    deputies.forEach((d) => {
      const clamped = Math.max(-BIN_LIMIT, Math.min(BIN_LIMIT - 1e-6, d.partyDeviation))
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor((clamped - start) / BIN_WIDTH)))
      const category = classifyDeviation(d.partyDeviation)
      if (category === 'alinhado') alignedCounts[idx] += 1
      else if (category === 'mais a esquerda') leftCounts[idx] += 1
      else rightCounts[idx] += 1
    })

    const mkSeries = (key: DeviationDirection, data: number[]): echarts.BarSeriesOption => ({
      name: DEVIATION_STYLE[key].label,
      type: 'bar',
      stack: 'desvio',
      barCategoryGap: '12%',
      cursor: 'pointer',
      itemStyle: { color: DEVIATION_STYLE[key].color },
      // Realca a categoria selecionada esmaecendo as demais.
      emphasis: { itemStyle: { opacity: 1 } },
      data: data.map((value) => ({
        value,
        itemStyle: {
          opacity: !selected || selected === key ? 0.92 : 0.28,
        },
      })),
    })

    return {
      grid: { left: 16, right: 24, top: 24, bottom: 76, containLabel: true },
      legend: {
        bottom: 0,
        textStyle: { color: '#aab4c0', fontSize: 12 },
        data: ORDER.map((key) => DEVIATION_STYLE[key].label),
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        backgroundColor: 'rgba(20, 26, 36, 0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (raw: unknown) => {
          const items = raw as Array<{ axisValue: string; seriesName: string; value: number; color: string }>
          if (!items.length) return ''
          const center = Number(items[0].axisValue)
          const lo = (center - BIN_WIDTH / 2).toFixed(1)
          const hi = (center + BIN_WIDTH / 2).toFixed(1)
          const lines = items
            .filter((it) => it.value > 0)
            .map(
              (it) =>
                `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${it.color};margin-right:6px"></span>${it.seriesName}: <strong>${it.value}</strong>`,
            )
          return [
            `<strong>Desvio entre ${lo} e ${hi}</strong>`,
            `<div style="margin-top:6px;line-height:1.7">${lines.join('<br/>') || 'Sem deputados'}</div>`,
            `<div style="margin-top:6px;color:#aab4c0">Clique para ver os deputados</div>`,
          ].join('')
        },
      },
      xAxis: {
        type: 'category',
        data: centers.map((c) => c.toFixed(1)),
        name: '← mais à esquerda que o partido  ·  alinhado  ·  mais à direita que o partido →',
        nameLocation: 'middle',
        nameGap: 36,
        nameTextStyle: { color: '#8a9ba8', fontSize: 12 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
        axisLabel: {
          color: '#8a9ba8',
          interval: (index: number) => centers[index] % 1 === 0,
        },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Deputados',
        nameTextStyle: { color: '#8a9ba8', fontSize: 12 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: '#8a9ba8' },
      },
      series: [
        mkSeries('mais a esquerda', leftCounts),
        mkSeries('alinhado', alignedCounts),
        mkSeries('mais a direita', rightCounts),
        {
          name: 'Alinhamento',
          type: 'line',
          silent: true,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255,255,255,0.35)', type: 'dashed', width: 1.5 },
            label: { show: true, formatter: 'alinhado', color: '#aab4c0', fontSize: 10 },
            data: [{ xAxis: '0.0' }],
          },
          data: [],
        },
      ],
    }
  }, [deputies, selected])

  useEffect(() => {
    if (!ref.current) return undefined
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    // Clique em qualquer barra seleciona a categoria (serie) correspondente.
    chart.on('click', (params: { seriesName?: string }) => {
      const match = ORDER.find((key) => DEVIATION_STYLE[key].label === params.seriesName)
      if (match) selectDirection(match)
    })
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  const selectedList = selected ? byCategory[selected] : []
  const shown = selectedList.slice(0, visible)

  return (
    <div className="revealed-position">
      <div className="revealed-position__summary" role="group" aria-label="Distribuição por desvio">
        {summary.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`revealed-position__stat${selected === item.key ? ' is-active' : ''}`}
            onClick={() => selectDirection(selected === item.key ? null : item.key)}
            aria-pressed={selected === item.key}
          >
            <span className="revealed-position__swatch" style={{ backgroundColor: DEVIATION_STYLE[item.key].color }} aria-hidden="true" />
            <span className="revealed-position__stat-value">{item.count.toLocaleString('pt-BR')}</span>
            <span className="revealed-position__stat-label">
              {DEVIATION_STYLE[item.key].short} · {item.pct.toFixed(0)}%
            </span>
          </button>
        ))}
      </div>

      <div
        ref={ref}
        className="revealed-position__surface"
        style={{ height: `${height}px` }}
        role="img"
        aria-label="Distribuição do desvio dos deputados em relação ao próprio partido"
      />

      <p className="revealed-position__hint">
        Cada barra agrupa deputados por quanto seu comportamento de voto calibrado (W-NOMINATE) se
        afasta da posição ideológica do partido (Bolognesi). O centro (desvio até ±{ALIGNMENT_TOLERANCE})
        marca o alinhamento; à esquerda votam mais à esquerda que o partido e à direita, mais à direita.
      </p>

      <div className="revealed-position__detail">
        {!selected ? (
          <p className="revealed-position__placeholder">
            Clique em uma barra para ver os deputados deste grupo.
          </p>
        ) : (
          <>
            <div className="revealed-position__detail-head">
              <h3>{DEVIATION_STYLE[selected].title}</h3>
              <span className="revealed-position__detail-count">
                {selectedList.length.toLocaleString('pt-BR')} deputados
              </span>
              <button type="button" className="revealed-position__clear" onClick={() => selectDirection(null)}>
                Limpar
              </button>
            </div>

            {selectedList.length ? (
              <>
                <ul className="revealed-position__cards">
                  {shown.map((d, index) => (
                    <li key={d.deputyId || `${d.name}-${index}`} className="deputy-deviation-card">
                      <span className="deputy-deviation-card__rank">{index + 1}</span>
                      <DeputyAvatar id={d.deputyId} nome={d.name} size={40} />
                      <div className="deputy-deviation-card__info">
                        <strong className="deputy-deviation-card__name">{d.name}</strong>
                        <span className="deputy-deviation-card__party">
                          {d.party} <IdeologyBadge range={d.partyBand} compact />
                        </span>
                      </div>
                      <div className="deputy-deviation-card__metrics">
                        <span
                          className="deputy-deviation-card__deviation"
                          style={{ color: DEVIATION_STYLE[selected].color }}
                        >
                          {d.partyDeviation > 0 ? '+' : ''}
                          {d.partyDeviation.toFixed(2)}
                        </span>
                        <span className="deputy-deviation-card__detail">
                          Partido {formatScore(d.partyScore)} · Calibrado {formatScore(d.calibratedScore)}
                        </span>
                        <span className="deputy-deviation-card__detail">
                          {d.partyDeviationDirection} · {d.confidenceBand || 'confiança —'} · {d.validVotes.toLocaleString('pt-BR')} votos
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                {visible < selectedList.length ? (
                  <button
                    type="button"
                    className="revealed-position__more"
                    onClick={() => setVisible((v) => v + STEP_VISIBLE)}
                  >
                    Ver mais ({selectedList.length - visible} restantes)
                  </button>
                ) : null}
              </>
            ) : (
              <p className="revealed-position__placeholder">Nenhum deputado neste grupo.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
