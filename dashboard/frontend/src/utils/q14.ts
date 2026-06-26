// Adaptador de leitura para a fonte Q14 ("Posição ideológica revelada por votos").
// O backend expõe cada campo em duas grafias (pt-BR e EN). Aqui padronizamos a
// leitura nos aliases EN — usados também nos helper arrays de chart_spec.options
// e nos testes de contrato — e isolamos a página de qualquer detalhe do payload.

import type { QuestionPayload } from '../types'
import { toNumber } from './ideology'

/** Direção do desvio de um deputado em relação ao próprio partido. */
export type DeviationDirection = 'mais a esquerda' | 'mais a direita' | 'alinhado'

/**
 * Tolerância (±) em torno de zero para considerar um deputado "alinhado" ao
 * partido. Mesma documentada na metodologia de Q14 (±0.5 sobre a escala
 * calibrada 0-10): desvio_partido = score_calibrado_0_10 - ideologia_score_partido.
 */
export const ALIGNMENT_TOLERANCE = 0.5

/**
 * Classifica um deputado pela direção do desvio usando o VALOR NUMÉRICO como
 * fonte de verdade (mais robusto que rótulos textuais que variam de idioma):
 *   desvio < -tol  -> mais a esquerda que o partido
 *   |desvio| <= tol -> alinhado
 *   desvio >  tol  -> mais a direita que o partido
 */
export function classifyDeviation(
  deviation: number,
  tolerance: number = ALIGNMENT_TOLERANCE,
): DeviationDirection {
  if (!Number.isFinite(deviation)) return 'alinhado'
  if (deviation < -tolerance) return 'mais a esquerda'
  if (deviation > tolerance) return 'mais a direita'
  return 'alinhado'
}

/** Linha por deputado da tabela principal de Q14. */
export interface RevealedDeputy {
  deputyId: string
  name: string
  party: string
  /** Score ideológico do partido (Bolognesi), eixo X do scatter. */
  partyScore: number
  partyBand: string
  /** Score comportamental calibrado (W-NOMINATE, 0-10), eixo Y do scatter. */
  calibratedScore: number
  /** Desvio em relação ao partido (assinado). */
  partyDeviation: number
  partyDeviationDirection: DeviationDirection
  caucusDeviation: number
  caucusDeviationDirection: string
  validVotes: number
  confidence: number
  confidenceBand: string
}

/** Item de coesão por bancada (complemento 1 de Q14). */
export interface CaucusCohesion {
  party: string
  numDeputies: number
  partyBand: string
  /** Score médio da bancada (0-10). */
  caucusScore: number
  /** Desvio médio absoluto interno — menor = mais coeso. */
  deviationMeanAbs: number
  deviationMaxAbs: number
  deviationStd: number
}

/** Bloco de metodologia pré-formatado pelo backend. */
export interface MethodologyBlock {
  source: string
  summary: string
  text: string
}

export interface Q14Data {
  deputies: RevealedDeputy[]
  /** Deputados mais à direita do que o partido (helper topRightDeviation). */
  outliersRight: RevealedDeputy[]
  /** Deputados mais à esquerda do que o partido (helper topLeftDeviation). */
  outliersLeft: RevealedDeputy[]
  /** Deputados mais alinhados ao partido (helper mostAligned). */
  mostAligned: RevealedDeputy[]
  cohesion: CaucusCohesion[]
  methodology: MethodologyBlock | null
}

type Row = Record<string, unknown>

function str(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function num(row: Row, ...keys: string[]): number {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return toNumber(row[key])
  }
  return 0
}

function normalizeDirection(raw: string): DeviationDirection {
  const value = raw.toLowerCase()
  if (value.includes('esquerda')) return 'mais a esquerda'
  if (value.includes('direita')) return 'mais a direita'
  return 'alinhado'
}

/** Converte uma linha crua (pt-BR/EN) em um deputado tipado do Q14. */
export function toRevealedDeputy(row: Row): RevealedDeputy {
  return {
    deputyId: str(row, 'deputy_id', 'id_deputado'),
    name: str(row, 'deputy_name', 'name', 'nome'),
    party: str(row, 'party', 'sigla_partido'),
    partyScore: num(row, 'party_ideology_score', 'ideologia_score_partido'),
    partyBand: str(row, 'party_ideology_band', 'ideologia_faixa_partido'),
    calibratedScore: num(row, 'behavioral_score_calibrated', 'score_calibrado_0_10'),
    partyDeviation: num(row, 'party_deviation', 'desvio_partido'),
    partyDeviationDirection: normalizeDirection(
      str(row, 'party_deviation_direction', 'direcao_desvio_partido'),
    ),
    caucusDeviation: num(row, 'caucus_deviation', 'desvio_bancada'),
    caucusDeviationDirection: str(row, 'caucus_deviation_direction', 'direcao_desvio_bancada'),
    validVotes: num(row, 'valid_votes', 'qtd_votos_validos'),
    confidence: num(row, 'confidence', 'confianca'),
    confidenceBand: str(row, 'confidence_band', 'confidence_range', 'confianca_faixa'),
  }
}

function toCaucusCohesion(row: Row, bandByParty: Map<string, string>): CaucusCohesion {
  const party = str(row, 'party', 'sigla_partido')
  // O helper de coesão e o complemento não trazem a faixa ideológica; ela é
  // recuperada do mapa partido->faixa montado a partir das demais fontes de Q14.
  const inlineBand = str(row, 'party_ideology_band', 'ideologia_faixa_partido')
  return {
    party,
    numDeputies: num(row, 'num_deputados', 'num_deputies'),
    partyBand: inlineBand || bandByParty.get(party) || '',
    caucusScore: num(row, 'caucus_score', 'score_bancada_0_10'),
    deviationMeanAbs: num(row, 'caucus_deviation_mean_abs', 'desvio_bancada_medio_abs'),
    deviationMaxAbs: num(row, 'caucus_deviation_max_abs', 'desvio_bancada_max_abs'),
    deviationStd: num(row, 'caucus_deviation_std', 'desvio_bancada_std'),
  }
}

function readHelperArray(options: Row, key: string): RevealedDeputy[] {
  const raw = options[key]
  if (!Array.isArray(raw)) return []
  return raw.map((item) => toRevealedDeputy(item as Row))
}

/** Localiza o complemento de coesão pelo trecho do título. */
function findCohesionTable(payload: QuestionPayload): Row[] {
  const match = payload.complement_tables.find((t) => t.title.toLowerCase().includes('coesão') || t.title.toLowerCase().includes('coesao'))
  return (match?.rows ?? []) as Row[]
}

/** Lê o payload bruto de Q14 e devolve estruturas tipadas para a UI. */
export function parseQ14(payload: QuestionPayload | null): Q14Data | null {
  if (!payload) return null

  const deputies = (payload.table_spec.rows as Row[]).map(toRevealedDeputy)

  const options = (payload.chart_spec?.options ?? {}) as Row
  const outliersRight = readHelperArray(options, 'topRightDeviation')
  const outliersLeft = readHelperArray(options, 'topLeftDeviation')
  const mostAligned = readHelperArray(options, 'mostAligned')

  // Coesão: o helper partyCohesionRanking traz os campos prontos; caímos para o
  // complemento de tabela apenas se o helper não estiver presente.
  // Mapa partido -> faixa ideológica, montado a partir dos deputados e do
  // complemento de desvio por partido (ambos trazem a faixa); usado para
  // preencher a coesão, cujo payload não inclui a faixa.
  const bandByParty = new Map<string, string>()
  const registerBand = (party: string, band: string) => {
    if (party && band && !bandByParty.has(party)) bandByParty.set(party, band)
  }
  deputies.forEach((d) => registerBand(d.party, d.partyBand))
  payload.complement_tables.forEach((table) => {
    ;(table.rows as Row[]).forEach((row) => {
      registerBand(str(row, 'party', 'sigla_partido'), str(row, 'party_ideology_band', 'ideologia_faixa_partido'))
    })
  })

  const helperCohesion = options['partyCohesionRanking']
  const cohesionRows = Array.isArray(helperCohesion) && helperCohesion.length
    ? (helperCohesion as Row[])
    : findCohesionTable(payload)
  const cohesion = cohesionRows.map((row) => toCaucusCohesion(row, bandByParty))

  const methodologyRaw = options['methodology'] as Row | undefined
  const methodology: MethodologyBlock | null = methodologyRaw
    ? {
        source: String(methodologyRaw.source ?? ''),
        summary: String(methodologyRaw.summary ?? ''),
        text: String(methodologyRaw.text ?? ''),
      }
    : null

  return { deputies, outliersRight, outliersLeft, mostAligned, cohesion, methodology }
}

/**
 * Correlação de Pearson entre a ideologia atribuída ao partido (Bolognesi)
 * e o comportamento de voto calibrado (W-NOMINATE) dos deputados. Mede o
 * quanto a posição revelada acompanha a posição do partido. Retorna null
 * quando não há dados suficientes ou variância nula.
 */
export function behavioralPartyCorrelation(deputies: RevealedDeputy[]): number | null {
  const pairs = deputies.filter(
    (d) => Number.isFinite(d.partyScore) && Number.isFinite(d.calibratedScore) && d.calibratedScore !== 0,
  )
  const n = pairs.length
  if (n < 3) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const d of pairs) {
    sx += d.partyScore
    sy += d.calibratedScore
    sxx += d.partyScore * d.partyScore
    syy += d.calibratedScore * d.calibratedScore
    sxy += d.partyScore * d.calibratedScore
  }
  const cov = n * sxy - sx * sy
  const varX = n * sxx - sx * sx
  const varY = n * syy - sy * sy
  const denom = Math.sqrt(varX * varY)
  if (denom === 0) return null
  return cov / denom
}

/**
 * Coesão média geral das bancadas: índice de coesão (10 - desvio médio
 * absoluto) ponderado pelo número de deputados de cada bancada. Retorna
 * null quando não há bancadas.
 */
export function averageCaucusCohesion(cohesion: CaucusCohesion[]): number | null {
  const valid = cohesion.filter((c) => c.numDeputies > 0)
  if (!valid.length) return null
  let weighted = 0
  let weight = 0
  for (const c of valid) {
    const index = Math.max(0, 10 - c.deviationMeanAbs)
    weighted += index * c.numDeputies
    weight += c.numDeputies
  }
  return weight ? weighted / weight : null
}
