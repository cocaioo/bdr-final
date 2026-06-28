export const EDUCATION_ORDER = [
  'doutorado',
  'doutorado incompleto',
  'mestrado',
  'mestrado incompleto',
  'pos-graduacao',
  'superior',
  'superior incompleto',
  'ensino medio',
  'ensino medio incompleto',
  'secundario',
  'secundario incompleto',
  'ensino fundamental',
  'primario incompleto',
  'nao informado'
]

export function normalizeEducation(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function getEducationRank(value: string): number {
  const norm = normalizeEducation(value)
  const idx = EDUCATION_ORDER.indexOf(norm)
  return idx !== -1 ? idx : EDUCATION_ORDER.length
}

export function sortEducationLevels<T>(items: T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((a, b) => getEducationRank(getLabel(a)) - getEducationRank(getLabel(b)))
}
