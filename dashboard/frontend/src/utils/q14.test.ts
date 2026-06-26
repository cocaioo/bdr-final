import { describe, expect, it } from 'vitest'

import {
  ALIGNMENT_TOLERANCE,
  averageCaucusCohesion,
  behavioralPartyCorrelation,
  classifyDeviation,
  parseQ14,
  toRevealedDeputy,
} from './q14'
import type { QuestionPayload } from '../types'

function payload(partial: Partial<QuestionPayload>): QuestionPayload {
  return {
    question_id: 'q14',
    title: 'Posição ideológica revelada por votos',
    description: '',
    filters_supported: [],
    filters_applied: {},
    summary_cards: [],
    chart_spec: { type: 'scatter', title: '', description: '', y_fields: [], categories: [], series: [], options: {} },
    table_spec: { title: 'Q14', columns: [], rows: [], total: 0, page: 1, page_size: 1000, sort_dir: 'desc' },
    complement_tables: [],
    query_panel: { sql_path: '', sql_text: '', explanation: '' },
    warnings: [],
    empty_state: { is_empty: false, message: '' },
    dataset_version: '1',
    generated_at: '',
    ...partial,
  }
}

describe('toRevealedDeputy', () => {
  it('lê os aliases EN e normaliza a direção do desvio', () => {
    const d = toRevealedDeputy({
      deputy_id: 1,
      deputy_name: 'Fulano',
      party: 'PT',
      party_ideology_score: 2.6,
      party_ideology_band: 'Esquerda',
      behavioral_score_calibrated: 5.1,
      party_deviation: 2.5,
      party_deviation_direction: 'mais a direita',
      valid_votes: 700,
      confidence_band: 'alta',
    })
    expect(d.name).toBe('Fulano')
    expect(d.partyScore).toBeCloseTo(2.6)
    expect(d.calibratedScore).toBeCloseTo(5.1)
    expect(d.partyDeviationDirection).toBe('mais a direita')
  })

  it('aceita as grafias pt-BR como fallback', () => {
    const d = toRevealedDeputy({
      id_deputado: 9,
      nome: 'Beltrano',
      sigla_partido: 'PL',
      ideologia_score_partido: 8.8,
      score_calibrado_0_10: 7.0,
      desvio_partido: -1.8,
      direcao_desvio_partido: 'mais a esquerda',
    })
    expect(d.party).toBe('PL')
    expect(d.partyDeviationDirection).toBe('mais a esquerda')
  })
})

describe('parseQ14', () => {
  it('retorna null quando não há payload', () => {
    expect(parseQ14(null)).toBeNull()
  })

  it('extrai deputados, outliers, coesão e metodologia dos helper arrays', () => {
    const data = parseQ14(
      payload({
        table_spec: {
          title: 'Q14',
          columns: [],
          rows: [{ deputy_id: 1, deputy_name: 'A', party: 'PT', party_ideology_band: 'Esquerda', party_deviation: 0.1, party_deviation_direction: 'alinhado' }],
          total: 1,
          page: 1,
          page_size: 1000,
          sort_dir: 'desc',
        },
        chart_spec: {
          type: 'scatter',
          title: '',
          description: '',
          y_fields: [],
          categories: [],
          series: [],
          options: {
            topRightDeviation: [{ deputy_name: 'R', party: 'PT', party_deviation: 3.2, party_deviation_direction: 'mais a direita' }],
            topLeftDeviation: [{ deputy_name: 'L', party: 'PL', party_deviation: -3.0, party_deviation_direction: 'mais a esquerda' }],
            mostAligned: [{ deputy_name: 'M', party: 'PT', party_deviation: 0.0 }],
            partyCohesionRanking: [{ party: 'PT', num_deputados: 12, caucus_deviation_mean_abs: 0.8 }],
            methodology: { source: 'W-NOMINATE', summary: 'resumo', text: 'um texto de metodologia bem longo aqui' },
          },
        },
      }),
    )
    expect(data).not.toBeNull()
    expect(data!.deputies).toHaveLength(1)
    expect(data!.outliersRight[0].name).toBe('R')
    expect(data!.outliersLeft[0].name).toBe('L')
    expect(data!.cohesion[0].party).toBe('PT')
    expect(data!.cohesion[0].deviationMeanAbs).toBeCloseTo(0.8)
    expect(data!.cohesion[0].partyBand).toBe('Esquerda')
    expect(data!.methodology?.source).toBe('W-NOMINATE')
  })
})

describe('behavioralPartyCorrelation', () => {
  const mk = (partyScore: number, calibratedScore: number) =>
    toRevealedDeputy({ deputy_name: 'x', party: 'P', party_ideology_score: partyScore, behavioral_score_calibrated: calibratedScore })

  it('retorna ~1 para relação perfeitamente linear crescente', () => {
    const r = behavioralPartyCorrelation([mk(1, 2), mk(2, 4), mk(3, 6), mk(4, 8)])
    expect(r).not.toBeNull()
    expect(r as number).toBeCloseTo(1, 5)
  })

  it('retorna null com poucos dados', () => {
    expect(behavioralPartyCorrelation([mk(1, 2)])).toBeNull()
  })
})

describe('averageCaucusCohesion', () => {
  it('pondera o índice de coesão pelo número de deputados', () => {
    const avg = averageCaucusCohesion([
      { party: 'A', numDeputies: 10, partyBand: '', caucusScore: 0, deviationMeanAbs: 1, deviationMaxAbs: 0, deviationStd: 0 },
      { party: 'B', numDeputies: 30, partyBand: '', caucusScore: 0, deviationMeanAbs: 3, deviationMaxAbs: 0, deviationStd: 0 },
    ])
    // indices: A=9 (peso 10), B=7 (peso 30) -> (90 + 210) / 40 = 7.5
    expect(avg).toBeCloseTo(7.5, 5)
  })

  it('retorna null sem bancadas', () => {
    expect(averageCaucusCohesion([])).toBeNull()
  })
})

describe('classifyDeviation', () => {
  it('usa o limiar de ±0.5 documentado em Q14', () => {
    expect(ALIGNMENT_TOLERANCE).toBe(0.5)
    expect(classifyDeviation(-2.8)).toBe('mais a esquerda')
    expect(classifyDeviation(-0.51)).toBe('mais a esquerda')
    expect(classifyDeviation(-0.5)).toBe('alinhado')
    expect(classifyDeviation(0)).toBe('alinhado')
    expect(classifyDeviation(0.5)).toBe('alinhado')
    expect(classifyDeviation(0.51)).toBe('mais a direita')
    expect(classifyDeviation(3.61)).toBe('mais a direita')
  })

  it('não colapsa para uma única direção com dados mistos', () => {
    const deviations = [-3, -1, -0.6, -0.2, 0, 0.3, 0.7, 2, 3]
    const counts = { 'mais a esquerda': 0, alinhado: 0, 'mais a direita': 0 }
    deviations.forEach((v) => {
      counts[classifyDeviation(v)] += 1
    })
    expect(counts['mais a esquerda']).toBe(3)
    expect(counts.alinhado).toBe(3)
    expect(counts['mais a direita']).toBe(3)
  })
})
