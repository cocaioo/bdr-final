import type { EChartsOption } from 'echarts'

import type { ChartSpec } from '../types'

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function buildChartOption(spec: ChartSpec): EChartsOption {
  const series = spec.series as Array<Record<string, unknown>>

  if (spec.type === 'bar_horizontal') {
    return {
      tooltip: { trigger: 'axis' },
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
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 45, right: 20, top: 60, bottom: 80, containLabel: true },
      xAxis: { type: 'category', data: spec.categories, axisLabel: { rotate: 25 } },
      yAxis: { type: 'value' },
      series: series.map((entry) => ({
        type: 'bar',
        name: String(entry.name ?? ''),
        data: (entry.data as unknown[]) ?? [],
        barMaxWidth: 28,
      })),
    } as EChartsOption
  }

  if (spec.type === 'stacked_bar') {
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
        data: (entry.data as unknown[]) ?? [],
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
    xAxis: { type: 'category', data: spec.categories },
    yAxis: { type: 'value' },
    series: series.map((entry) => ({
      type: 'bar',
      data: (entry.data as unknown[]) ?? [],
    })),
  } as EChartsOption
}

