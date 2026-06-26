import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchAllQuestionRows } from '../api'
import type { FilterState } from '../types'

const EMPTY_FILTERS: FilterState = {
  anos: [], eixos: [], partidos: [], ufs: [], deputados: [], escolaridade: [], search: '',
}

// Simula o backend de Q14 que limita page_size em 200, com 634 deputados no
// total, distribuidos por direcao de desvio (esquerda < -0.5, direita > 0.5).
const TOTAL = 634
const PAGE_SIZE = 200

function makeRow(i: number) {
  // -3..+3 distribuido para gerar mix de esquerda/alinhado/direita.
  const deviation = ((i % 13) - 6) / 2
  return { deputy_id: i, deputy_name: `Dep ${i}`, party: 'PX', party_deviation: deviation }
}

const allRows = Array.from({ length: TOTAL }, (_unused, i) => makeRow(i))

function pagePayload(page: number) {
  const startIdx = (page - 1) * PAGE_SIZE
  const rows = allRows.slice(startIdx, startIdx + PAGE_SIZE)
  return {
    question_id: 'q14',
    title: 'Q14',
    description: '',
    filters_supported: [],
    filters_applied: {},
    summary_cards: [],
    chart_spec: { type: 'scatter', title: '', description: '', y_fields: [], categories: [], series: [], options: {} },
    table_spec: { title: 'Q14', columns: [], rows, total: TOTAL, page, page_size: PAGE_SIZE, sort_dir: 'desc' },
    complement_tables: [],
    query_panel: { sql_path: '', sql_text: '', explanation: '' },
    warnings: [],
    empty_state: { is_empty: false, message: '' },
    dataset_version: '1',
    generated_at: '',
  }
}

describe('fetchAllQuestionRows (paginacao de Q14)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost')
        const page = Number(url.searchParams.get('page') ?? '1')
        return { ok: true, json: async () => pagePayload(page) } as Response
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('agrega todas as paginas ate atingir o total (634), nao apenas as 200 primeiras', async () => {
    const payload = await fetchAllQuestionRows('q14', EMPTY_FILTERS, { page: 1, pageSize: 200, sortDir: 'desc' })
    expect(payload.table_spec.rows).toHaveLength(TOTAL)
    // Deve haver as tres direcoes presentes (nao colapsa para uma so).
    const devs = payload.table_spec.rows.map((r) => Number(r.party_deviation))
    expect(devs.some((d) => d < -0.5)).toBe(true)
    expect(devs.some((d) => Math.abs(d) <= 0.5)).toBe(true)
    expect(devs.some((d) => d > 0.5)).toBe(true)
  })
})
