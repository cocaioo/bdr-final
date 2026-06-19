import type { EChartsOption } from 'echarts'

import type { ChartSpec, FilterState } from '../types'

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function buildChartOption(spec: ChartSpec, activeFilters?: FilterState): EChartsOption {
  return applyTheme(buildChartOptionInternal(spec, activeFilters))
}

function buildChartOptionInternal(spec: ChartSpec, activeFilters?: FilterState): EChartsOption {
  const series = spec.series as Array<Record<string, unknown>>

  if (spec.type === 'bar_horizontal') {
    return {
      tooltip: { trigger: 'axis' },
      legend: {},
      grid: { left: 80, right: 20, top: 60, bottom: 40, containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: spec.categories },
      series: series.map((entry) => ({
        type: 'bar',
        name: String(entry.name ?? ''),
        data: (entry.data as unknown[]) ?? [],
        barMaxWidth: 24,
      })),
    } as EChartsOption
  }

  if (spec.type === 'bar_vertical' || spec.type === 'composite') {
    const hasEscolaridadeFilter = Boolean(activeFilters?.escolaridade && activeFilters.escolaridade.length > 0)
    return {
      tooltip: { trigger: 'axis' },
      legend: {},
      grid: { left: 45, right: 20, top: 60, bottom: 80, containLabel: true },
      xAxis: { type: 'category', data: spec.categories, axisLabel: { rotate: 25 } },
      yAxis: { type: 'value' },
      series: series.map((entry) => ({
        type: 'bar',
        name: String(entry.name ?? ''),
        data: ((entry.data as unknown[]) ?? []).map((val, idx) => {
          const category = spec.categories[idx]
          if (hasEscolaridadeFilter) {
            const isSelected = activeFilters?.escolaridade?.includes(category)
            return {
              value: val,
              itemStyle: {
                opacity: isSelected ? 1.0 : 0.35,
                borderWidth: isSelected ? 2 : 0,
                borderColor: isSelected ? '#1E293B' : 'transparent',
              }
            }
          }
          return val
        }),
        barMaxWidth: 28,
      })),
    } as EChartsOption
  }

  if (spec.type === 'line') {
    return {
      tooltip: { trigger: 'axis' },
      legend: {},
      grid: { left: 60, right: 20, top: 50, bottom: 50, containLabel: true },
      xAxis: { type: 'category', data: spec.categories },
      yAxis: { type: 'value' },
      series: series.map((entry) => ({
        type: 'line',
        name: String(entry.name ?? ''),
        data: (entry.data as unknown[]) ?? [],
        smooth: true,
        symbolSize: 8,
        areaStyle: { opacity: 0.12 },
      })),
    } as EChartsOption
  }

  if (spec.type === 'stacked_bar') {
    const hasPartidoFilter = Boolean(activeFilters?.partidos && activeFilters.partidos.length > 0)
    return {
      tooltip: { trigger: 'axis' },
      legend: {},
      grid: { left: 45, right: 20, top: 60, bottom: 80, containLabel: true },
      xAxis: { type: 'category', data: spec.categories, axisLabel: { rotate: 25 } },
      yAxis: { type: 'value' },
      series: series.map((entry) => ({
        type: 'bar',
        stack: 'total',
        name: String(entry.name ?? ''),
        data: ((entry.data as unknown[]) ?? []).map((val, idx) => {
          if (hasPartidoFilter) {
            const category = spec.categories[idx]
            const isSelected = activeFilters?.partidos?.includes(category)
            return {
              value: val,
              itemStyle: {
                opacity: isSelected ? 1.0 : 0.35,
                borderWidth: isSelected ? 2 : 0,
                borderColor: isSelected ? '#1E293B' : 'transparent',
              }
            }
          }
          return val
        }),
      })),
    } as EChartsOption
  }

  if (spec.type === 'scatter') {
    const first = series[0] ?? {}
    return {
      tooltip: { trigger: 'item' },
      grid: { left: 60, right: 20, top: 40, bottom: 50 },
      xAxis: { type: 'value', name: String(spec.options.x_name ?? 'X') },
      yAxis: { type: 'value', name: String(spec.options.y_name ?? 'Y') },
      series: [
        {
          type: 'scatter',
          data: (first.data as unknown[]) ?? [],
          symbolSize: 10,
        },
      ],
    } as EChartsOption
  }

  if (spec.type === 'radar') {
    const indicators =
      (spec.options.indicators as Array<{ name: string }> | undefined)?.map((item) => ({
        name: item.name,
        max: 1000000,
      })) ?? []
    return {
      tooltip: {},
      legend: {},
      radar: { indicator: indicators },
      series: [
        {
          type: 'radar',
          data: series.map((entry) => ({
            name: String(entry.name ?? ''),
            value: (entry.value as number[]) ?? [],
          })),
        },
      ],
    } as EChartsOption
  }

  if (spec.type === 'sankey') {
    const first = series[0] ?? {}
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          data: (first.nodes as unknown[]) ?? [],
          links: (first.links as unknown[]) ?? [],
          lineStyle: { color: 'source', curveness: 0.5 },
          emphasis: { focus: 'adjacency' },
        },
      ],
    } as EChartsOption
  }

  if (spec.type === 'treemap') {
    const first = series[0] ?? {}
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'treemap',
          data: (first.data as unknown[]) ?? [],
          breadcrumb: { show: false },
          label: { formatter: '{b}' },
        },
      ],
    } as EChartsOption
  }

  if (spec.type === 'heatmap_wordcloud') {
    const heatmapSeries = series.find((entry) => entry.name === 'heatmap')
    const wordSeries = series.find((entry) => entry.name === 'wordcloud')
    const heatmapData = (heatmapSeries?.data as Array<[number, number, number]>) ?? []
    const heatmapValues = heatmapData.map((item) => toNumber(item[2]))
    const heatmapMin = heatmapValues.length ? Math.min(...heatmapValues) : 0
    const heatmapMax = heatmapValues.length ? Math.max(...heatmapValues) : 0
    const words = ((wordSeries?.data as unknown[]) ?? [])
      .map((item) => item as { name: string; value: number })
      .sort((a, b) => toNumber(b.value) - toNumber(a.value))
      .slice(0, 20)

    return {
      tooltip: { position: 'top' },
      visualMap: {
        min: heatmapMin,
        max: heatmapMax,
        calculable: true,
        orient: 'vertical',
        right: 20,
        top: 'middle',
      },
      grid: [
        { left: 60, right: '55%', bottom: 50, top: 50 },
        { left: '55%', right: 20, bottom: 50, top: 50 },
      ],
      xAxis: [
        {
          type: 'category',
          data: (heatmapSeries?.x_categories as string[]) ?? [],
          splitArea: { show: true },
          axisLabel: { show: false },
        },
        {
          gridIndex: 1,
          type: 'value',
        },
      ],
      yAxis: [
        {
          type: 'category',
          data: (heatmapSeries?.y_categories as string[]) ?? [],
          splitArea: { show: true },
        },
        {
          gridIndex: 1,
          type: 'category',
          data: words.map((item) => item.name),
        },
      ],
      series: [
        {
          name: 'Atuacao',
          type: 'heatmap',
          data: heatmapData,
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.35)' } },
        },
        {
          name: 'Tokens',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: words.map((item) => toNumber(item.value)),
          barMaxWidth: 18,
        },
      ],
    } as EChartsOption
  }

  return {
    legend: {},
    xAxis: { type: 'category', data: spec.categories },
    yAxis: { type: 'value' },
    series: series.map((entry) => ({
      type: 'bar',
      data: (entry.data as unknown[]) ?? [],
    })),
  } as EChartsOption
}

function applyTheme(option: any): EChartsOption {
  const isLightTheme = typeof document !== 'undefined' && document.body.classList.contains('gastos-light-theme')

  const textInk = isLightTheme ? '#17202A' : '#e2e8f0'
  const textMuted = isLightTheme ? '#5D6B7A' : '#8a9ba8'
  const borderLight = isLightTheme ? '#D8E1EA' : 'rgba(255, 255, 255, 0.08)'
  const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(22, 28, 38, 0.95)'
  const tooltipBorder = isLightTheme ? '#D8E1EA' : 'rgba(255, 255, 255, 0.12)'

  if (!option) return {} as EChartsOption

  if (isLightTheme) {
    option.color = [
      '#2563EB', // Série 1
      '#0F766E', // Série 2
      '#7C3AED', // Série 3
      '#64748B', // Série 4
    ]
  } else {
    // Custom premium color palette matching our CSS variables
    option.color = [
      '#5b84a2', // primary: soft slate blue
      '#b39ddb', // accent: soft lavender
      '#66bb6a', // ok: soft sage green
      '#ffb74d', // warn: soft orange/gold
      '#ef9a9a', // danger: soft rose/coral
      '#80deea', // light cyan
      '#ffcc80', // light orange
      '#c5e1a5', // light sage
    ]
  }

  if (!option.textStyle) {
    option.textStyle = {}
  }
  option.textStyle.color = textInk
  option.textStyle.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  if (option.legend) {
    if (!option.legend.textStyle) option.legend.textStyle = {}
    option.legend.textStyle.color = textInk
  }

  if (option.tooltip) {
    option.tooltip.backgroundColor = tooltipBg
    option.tooltip.borderColor = tooltipBorder
    option.tooltip.borderWidth = 1
    if (!option.tooltip.textStyle) option.tooltip.textStyle = {}
    option.tooltip.textStyle.color = textInk
  }

  const configureAxis = (axis: any) => {
    if (!axis) return
    if (!axis.axisLabel) axis.axisLabel = {}
    if (axis.axisLabel.color === undefined) axis.axisLabel.color = textMuted

    if (!axis.axisLine) axis.axisLine = {}
    if (!axis.axisLine.lineStyle) axis.axisLine.lineStyle = {}
    if (axis.axisLine.lineStyle.color === undefined) axis.axisLine.lineStyle.color = borderLight

    if (!axis.splitLine) axis.splitLine = {}
    if (!axis.splitLine.lineStyle) axis.splitLine.lineStyle = {}
    if (axis.splitLine.lineStyle.color === undefined) {
      axis.splitLine.lineStyle.color = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)'
    }
  }

  if (Array.isArray(option.xAxis)) {
    option.xAxis.forEach(configureAxis)
  } else if (option.xAxis) {
    configureAxis(option.xAxis)
  }

  if (Array.isArray(option.yAxis)) {
    option.yAxis.forEach(configureAxis)
  } else if (option.yAxis) {
    configureAxis(option.yAxis)
  }

  if (option.visualMap) {
    option.visualMap.textStyle = { color: textInk }
  }

  if (option.radar) {
    if (!option.radar.axisName) option.radar.axisName = {}
    option.radar.axisName.color = textInk
  }

  return option as EChartsOption
}
