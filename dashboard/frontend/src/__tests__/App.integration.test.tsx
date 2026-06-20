import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'

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
    escolaridade: [],
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
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.endsWith('/api/meta')) {
          return {
            ok: true,
            json: async () => metaMock,
          } as Response
        }

        if (url.endsWith('/deputados.csv')) {
          return {
            ok: true,
            text: async () =>
              'id_deputado;nome;nome_civil;escolaridade;id_legislatura_inicial;id_legislatura_final\n' +
              '220593;Abilio Brunini;ABILIO JACQUES BRUNINI MOUMER;Superior;57;57',
          } as Response
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({}),
          text: async () => '',
        } as Response
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads meta and renders home links', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('BDR Painéis Parlamentares')).toBeInTheDocument()
    })
    expect(screen.getByText('Painéis de análise parlamentar')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gastos parlamentares' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Escolaridade e perfil dos deputados' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Produção legislativa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Partidos e votações' })).toBeInTheDocument()
    expect(screen.queryByText(/Q1|Q13|quest[aã]o/i)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Pesquisar deputado...')).toBeInTheDocument()
  })

  it('destaca a pesquisa por deputado acima dos modulos analiticos na home', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    const searchHeading = await screen.findByRole('heading', { name: 'Pesquisar deputado' })
    const panelsHeading = screen.getByRole('heading', { name: /Explore os pain/i })

    expect(searchHeading.compareDocumentPosition(panelsHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('navigates to the deputy profile route', async () => {
    render(
      <MemoryRouter initialEntries={['/deputados/220593']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Abilio Brunini' })).toBeInTheDocument()
  })
})
