import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { Header } from '../Header'

describe('Header', () => {
  it('renders Q2 as an enabled navigation link', () => {
    render(
      <MemoryRouter>
        <Header
          datasetVersion="test-version"
          questions={[
            {
              id: 'q1',
              title: 'Gastos por deputado',
              route: '/q/q1',
              description: 'Descricao',
              chart_type: 'bar_horizontal',
              supported_filters: [],
            },
            {
              id: 'q2',
              title: 'Eixos e nuvem de palavras',
              route: '/q/q2',
              description: 'Descricao',
              chart_type: 'wordcloud_images',
              supported_filters: [],
            },
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Q1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Q2' })).toHaveAttribute('href', '/q/q2')
  })

  it('renders Q7 and Q10 as enabled navigation links', () => {
    render(
      <MemoryRouter>
        <Header
          datasetVersion="test-version"
          questions={[
            {
              id: 'q7',
              title: 'Indice de custo-beneficio',
              route: '/q/q7',
              description: 'Descricao',
              chart_type: 'scatter',
              supported_filters: [],
            },
            {
              id: 'q10',
              title: 'Alinhamento interno de partidos',
              route: '/q/q10',
              description: 'Descricao',
              chart_type: 'radar',
              supported_filters: [],
            },
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Q7' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Q10' })).toBeInTheDocument()
  })
})
