import { describe, expect, it } from 'vitest'

import {
  IDEOLOGY_RANGES,
  fieldLabel,
  rangeColor,
  rangeField,
  rangeLabel,
  rangeOrder,
  resolveRange,
} from './ideology'

describe('ideology utils', () => {
  it('expoe exatamente as sete faixas ideologicas, na ordem do espectro', () => {
    expect(IDEOLOGY_RANGES.map((r) => r.label)).toEqual([
      'Extrema esquerda',
      'Esquerda',
      'Centro-esquerda',
      'Centro',
      'Centro-direita',
      'Direita',
      'Extrema direita',
    ])
  })

  it('resolve faixas ignorando acentos e caixa', () => {
    expect(resolveRange('extrema esquerda')?.label).toBe('Extrema esquerda')
    expect(resolveRange('Centro-Direita')?.label).toBe('Centro-direita')
    expect(resolveRange('CENTRO ESQUERDA')?.label).toBe('Centro-esquerda')
  })

  it('ordena faixas da esquerda para a direita', () => {
    expect(rangeOrder('Extrema esquerda')).toBeLessThan(rangeOrder('Centro'))
    expect(rangeOrder('Centro')).toBeLessThan(rangeOrder('Extrema direita'))
  })

  it('atribui cores distintas a cada faixa', () => {
    const colors = IDEOLOGY_RANGES.map((r) => rangeColor(r.label))
    expect(new Set(colors).size).toBe(IDEOLOGY_RANGES.length)
  })

  it('mapeia campo macro e rotulos de fallback', () => {
    expect(rangeField('Esquerda')).toBe('esquerda')
    expect(rangeField('Direita')).toBe('direita')
    expect(fieldLabel('direita')).toBe('Direita')
    expect(rangeLabel('faixa inexistente')).toBe('faixa inexistente')
    expect(rangeLabel('')).toBe('Nao classificado')
  })
})
