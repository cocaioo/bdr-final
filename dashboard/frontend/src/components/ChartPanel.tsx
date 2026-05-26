import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'

import type { ChartSpec } from '../types'
import { buildChartOption } from '../utils/chartOptions'

interface ChartPanelProps {
  spec: ChartSpec
}

export function ChartPanel({ spec }: ChartPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const option = useMemo(() => buildChartOption(spec), [spec])

  useEffect(() => {
    if (!ref.current) return undefined
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    chart.setOption(option, true)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [option])

  return (
    <section className="chart-section stagger-item">
      <header>
        <h2>{spec.title}</h2>
        <p>{spec.description}</p>
      </header>
      <div ref={ref} className="chart-surface" role="img" aria-label={`Grafico ${spec.type}`} />
    </section>
  )
}

