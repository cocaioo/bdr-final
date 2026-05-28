import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import App from '../App'

const metaMock = {
  dataset_version: 'abc123',
  last_updated: '2026-05-25T10:00:00Z',
  legend: {},
  available_filters: {
    anos: [],
    eixos: [],
    partidos: [],
    ufs: [],
    deputados: [],
  },
  questions: [
    {
      id: 'q1',
      title: 'Gastos por deputado',
      route: '/q/q1',
      description: 'Descricao',
      chart_type: 'bar_horizontal',
      supported_filters: ['anos'],
    },
  ],
}

describe('App integration', () => {
  it('loads meta and renders home links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => metaMock,
      })),
    )

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('BDR Painel Q1-Q13')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Q1').length).toBeGreaterThan(0)
    expect(screen.getByText('Painel de Analise Parlamentar')).toBeInTheDocument()
  })
})
