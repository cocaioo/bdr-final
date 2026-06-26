import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RevealedPositionScatter } from './RevealedPositionScatter'
import { toRevealedDeputy, type RevealedDeputy } from '../utils/q14'

// ECharts usa canvas (indisponivel no jsdom). Substituimos por um stub leve;
// a logica de classificacao e a lista de deputados nao dependem do grafico.
vi.mock('echarts', () => ({
  init: () => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
  }),
}))

function mk(name: string, party: string, deviation: number): RevealedDeputy {
  return toRevealedDeputy({
    deputy_id: name.replace(/\s/g, ''),
    deputy_name: name,
    party,
    party_ideology_score: 5,
    party_ideology_band: 'Centro',
    behavioral_score_calibrated: 5 + deviation,
    party_deviation: deviation,
    valid_votes: 500,
    confidence_band: 'alta',
  })
}

// Conjunto misto: 2 a esquerda, 2 alinhados, 3 a direita (por valor numerico).
const deputies = [
  mk('Esq Forte', 'PT', -3.0),
  mk('Esq Leve', 'PSB', -0.8),
  mk('Centro A', 'MDB', -0.2),
  mk('Centro B', 'PSD', 0.4),
  mk('Dir Leve', 'PP', 0.9),
  mk('Dir Media', 'PL', 2.1),
  mk('Dir Forte', 'PL', 3.4),
]

describe('RevealedPositionScatter', () => {
  it('computa left/aligned/right a partir do desvio numerico (sem colapsar)', () => {
    render(<RevealedPositionScatter deputies={deputies} />)
    // Botoes de resumo mostram contagem + rotulo curto.
    expect(screen.getByRole('button', { name: /À esquerda/i })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /Alinhados/i })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /À direita/i })).toHaveTextContent('3')
  })

  it('mostra o placeholder antes de qualquer clique', () => {
    render(<RevealedPositionScatter deputies={deputies} />)
    expect(screen.getByText(/Clique em uma barra para ver os deputados/i)).toBeInTheDocument()
  })

  it('ao clicar em um grupo, lista os deputados com nome, partido e desvio', async () => {
    render(<RevealedPositionScatter deputies={deputies} />)
    await userEvent.click(screen.getByRole('button', { name: /À direita/i }))

    expect(screen.getByRole('heading', { name: /Deputados mais à direita que o partido/i })).toBeInTheDocument()
    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    // Ordenado por |desvio| desc: Dir Forte (3.4) primeiro.
    expect(items[0]).toHaveTextContent('Dir Forte')
    expect(items[0]).toHaveTextContent('PL')
    expect(items[0]).toHaveTextContent('+3.40')
  })

  it('ordena por desvio absoluto decrescente dentro do grupo da esquerda', async () => {
    render(<RevealedPositionScatter deputies={deputies} />)
    await userEvent.click(screen.getByRole('button', { name: /À esquerda/i }))
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Esq Forte')
    expect(items[1]).toHaveTextContent('Esq Leve')
  })
})
