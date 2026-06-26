// Sistema de classificacao ideologica compartilhado pelo painel de
// Partidos, Ideologia e Votacao. Centraliza a ordem das faixas, as cores
// associadas e utilitarios de normalizacao para que todos os componentes
// (badges, legendas, espectro, distribuicao, rankings) leiam a mesma fonte.

export interface IdeologyRangeDef {
  /** Chave canonica usada internamente. */
  key: string
  /** Rotulo exibido ao usuario (pt-BR), igual ao valor vindo do backend. */
  label: string
  /** Cor principal da faixa. */
  color: string
  /** Campo macro ideologico associado por padrao. */
  field: 'esquerda' | 'centro' | 'direita'
}

// A progressao de cores comunica o deslocamento ao longo do espectro
// (esquerda -> centro -> direita). NAO indica juizo de valor (bom/ruim).
// Vai de um azul/indigo (esquerda) passando por um cinza-azulado neutro
// (centro) ate um ambar/vermelho-tijolo (direita).
export const IDEOLOGY_RANGES: IdeologyRangeDef[] = [
  { key: 'extrema_esquerda', label: 'Extrema esquerda', color: '#5363df', field: 'esquerda' },
  { key: 'esquerda', label: 'Esquerda', color: '#468bc7', field: 'esquerda' },
  { key: 'centro_esquerda', label: 'Centro-esquerda', color: '#3ea79f', field: 'esquerda' },
  { key: 'centro', label: 'Centro', color: '#8895a3', field: 'centro' },
  { key: 'centro_direita', label: 'Centro-direita', color: '#ce913d', field: 'direita' },
  { key: 'direita', label: 'Direita', color: '#cf673f', field: 'direita' },
  { key: 'extrema_direita', label: 'Extrema direita', color: '#bd4946', field: 'direita' },
]

const RANGE_ORDER = new Map(IDEOLOGY_RANGES.map((range, index) => [range.label, index]))

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function canonicalize(value: string): string {
  return stripDiacritics(value).toLowerCase().trim().replace(/[\s-]+/g, '_')
}

const RANGE_BY_CANONICAL = new Map(
  IDEOLOGY_RANGES.map((range) => [canonicalize(range.label), range]),
)

/** Resolve uma faixa ideologica a partir de qualquer variacao textual. */
export function resolveRange(raw: unknown): IdeologyRangeDef | undefined {
  if (raw === null || raw === undefined) return undefined
  return RANGE_BY_CANONICAL.get(canonicalize(String(raw)))
}

/** Cor da faixa; cinza neutro como fallback para valores desconhecidos. */
export function rangeColor(raw: unknown): string {
  return resolveRange(raw)?.color ?? '#7a8794'
}

/** Rotulo padronizado da faixa (preserva o texto original se nao reconhecido). */
export function rangeLabel(raw: unknown): string {
  const resolved = resolveRange(raw)
  if (resolved) return resolved.label
  const text = String(raw ?? '').trim()
  return text || 'Nao classificado'
}

/** Posicao da faixa no espectro (0 = extrema esquerda). */
export function rangeOrder(raw: unknown): number {
  const resolved = resolveRange(raw)
  if (!resolved) return Number.MAX_SAFE_INTEGER
  return RANGE_ORDER.get(resolved.label) ?? Number.MAX_SAFE_INTEGER
}

/** Campo macro ideologico associado a faixa. */
export function rangeField(raw: unknown): IdeologyRangeDef['field'] | 'indefinido' {
  return resolveRange(raw)?.field ?? 'indefinido'
}

export function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    esquerda: 'Esquerda',
    centro: 'Centro',
    direita: 'Direita',
  }
  return map[canonicalize(field)] ?? (String(field || '').trim() || 'Indefinido')
}

/** Limites teoricos do score ideologico (0 a 10). */
export const IDEOLOGY_SCORE_MIN = 0
export const IDEOLOGY_SCORE_MAX = 10

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface SpectrumParty {
  sigla: string
  score: number
  faixa: string
  campo: string
  fonte: string
  tipoMatch: string
}

/** Converte linhas cruas (table_spec do Q9) em pontos do espectro ideologico. */
export function toSpectrumParties(rows: Array<Record<string, unknown>>): SpectrumParty[] {
  return rows
    .filter((row) => row.sigla_partido)
    .map((row) => ({
      sigla: String(row.sigla_partido),
      score: toNumber(row.ideologia_score),
      faixa: String(row.ideologia_faixa ?? ''),
      campo: String(row.campo_ideologico ?? ''),
      fonte: String(row.fonte_ideologia ?? ''),
      tipoMatch: String(row.tipo_match_ideologia ?? ''),
    }))
    .sort((a, b) => rangeOrder(a.faixa) - rangeOrder(b.faixa) || a.score - b.score)
}
