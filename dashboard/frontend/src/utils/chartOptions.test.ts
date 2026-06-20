import type { EChartsOption } from 'echarts'

import type { ChartSpec } from '../types'
import { buildChartOption } from './chartOptions'

it('formats financial chart axes and tooltips in reais', () => {
  const spec: ChartSpec = {
    type: 'bar_horizontal',
    title: 'Categorias',
    description: 'Top categorias',
    y_fields: ['valor_total'],
    categories: ['Passagens'],
    series: [{ name: 'Valor total', data: [1_250_000] }],
    options: { currency: true, compact_axis: true, show_legend: false },
  }

  const option = buildChartOption(spec) as EChartsOption & {
    legend: { show: boolean }
    tooltip: { valueFormatter: (value: unknown) => string }
    xAxis: {
      splitNumber: number
      axisLabel: {
        formatter: (value: unknown) => string
        hideOverlap: boolean
      }
    }
  }

  expect(option.legend.show).toBe(false)
  expect(option.tooltip.valueFormatter(1_250_000).replace(/\s/, ' ')).toBe('R$ 1.250.000,00')
  expect(option.xAxis.axisLabel.formatter(1_250_000)).toBe('R$ 1,3 mi')
  expect(option.xAxis.splitNumber).toBe(3)
  expect(option.xAxis.axisLabel.hideOverlap).toBe(true)
})
