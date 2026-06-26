import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

export interface IdeologyBar {
  label: string
  value: number
  color: string
  /** Linhas extras exibidas no tooltip (rotulo: valor). */
  tooltip?: Array<[string, string]>
}

interface IdeologyBarChartProps {
  bars: IdeologyBar[]
  orientation?: 'horizontal' | 'vertical'
  /** Sufixo do valor (ex.: '%'). */
  valueSuffix?: string
  height?: number
  /** Casas decimais do rotulo de valor. */
  decimals?: number
}

/**
 * Grafico de barras reutilizavel com cores por faixa ideologica. Cobre a
 * distribuicao e o ranking de alinhamento, evitando
 * duplicacao de configuracao do ECharts.
 */
export function IdeologyBarChart({
  bars,
  orientation = 'vertical',
  valueSuffix = '',
  height = 320,
  decimals = 0,
}: IdeologyBarChartProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const option = useMemo<echarts.EChartsOption>(() => {
    const isHorizontal = orientation === 'horizontal'
    // No modo horizontal o ECharts desenha de baixo para cima; invertemos para
    // que o maior valor (primeiro da lista) apareca no topo.
    const ordered = isHorizontal ? [...bars].reverse() : bars
    const categories = ordered.map((bar) => bar.label)
    const fmt = (value: number) => `${value.toFixed(decimals)}${valueSuffix}`

    const categoryAxis = {
      type: 'category' as const,
      data: categories,
      axisLabel: {
        color: '#aab4c0',
        interval: 0,
        rotate: isHorizontal ? 0 : 18,
        width: isHorizontal ? 110 : undefined,
        overflow: 'truncate' as const,
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
    }
    const valueAxis = {
      type: 'value' as const,
      axisLabel: { color: '#8a9ba8', formatter: (v: number) => `${v}${valueSuffix}` },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    }

    return {
      grid: {
        left: isHorizontal ? 16 : 12,
        right: 24,
        top: 16,
        bottom: isHorizontal ? 24 : 60,
        containLabel: true,
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(20, 26, 36, 0.96)',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (raw: unknown) => {
          const idx = (raw as { dataIndex: number }).dataIndex
          const bar = ordered[idx]
          const head = `<strong>${bar.label}</strong><br/>${fmt(bar.value)}`
          if (!bar.tooltip?.length) return head
          const extra = bar.tooltip.map(([k, v]) => `${k}: <strong>${v}</strong>`).join('<br/>')
          return `${head}<div style="margin-top:6px;line-height:1.6">${extra}</div>`
        },
      },
      xAxis: isHorizontal ? valueAxis : categoryAxis,
      yAxis: isHorizontal ? categoryAxis : valueAxis,
      series: [
        {
          type: 'bar',
          data: ordered.map((bar) => ({ value: bar.value, itemStyle: { color: bar.color, borderRadius: 4 } })),
          barMaxWidth: 30,
          label: {
            show: true,
            position: isHorizontal ? 'right' : 'top',
            color: '#cbd5e1',
            fontSize: 11,
            formatter: (raw: unknown) => fmt((raw as { value: number }).value),
          },
        },
      ],
    }
  }, [bars, orientation, valueSuffix, decimals])

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

  return (
    <div
      ref={ref}
      className="ideology-bar-chart"
      style={{ height: `${height}px` }}
      role="img"
      aria-label="Grafico de barras por faixa ideologica"
    />
  )
}
