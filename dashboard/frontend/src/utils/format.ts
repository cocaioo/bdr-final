export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString('pt-BR')
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao'
  return String(value)
}

