import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import type { ChartSpec } from '../types'
import { buildChartOption } from '../utils/chartOptions'

interface ChartPanelProps {
  spec: ChartSpec
  yearLabels?: string[]
}

export function ChartPanel({ spec, yearLabels }: ChartPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const option = useMemo(() => buildChartOption(spec), [spec])

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
    if (chartRef.current) {
      chartRef.current.setOption(option, true)
    }
  }, [option])

  return (
    <section className="chart-section stagger-item">
      <header>
        <h2>{spec.title}</h2>
        <p>{spec.description}</p>
      </header>
      {yearLabels && yearLabels.length > 0 ? (
        <div
          className="chart-year-legend"
          style={{ gridTemplateColumns: `repeat(${yearLabels.length}, minmax(0, 1fr))` }}
        >
          {yearLabels.map((year) => (
            <span key={year}>{year}</span>
          ))}
        </div>
      ) : null}
      <div ref={ref} className="chart-surface" role="img" aria-label={`Grafico ${spec.type}`} />
    </section>
  )
}

