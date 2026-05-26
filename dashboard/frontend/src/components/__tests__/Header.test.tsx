import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { Header } from '../Header'

describe('Header', () => {
  it('renders Q2 as disabled navigation when it is under development', () => {
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
              chart_type: 'heatmap_wordcloud',
              supported_filters: [],
            },
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Q1' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Q2' })).not.toBeInTheDocument()
    expect(screen.getByText('Q2')).toHaveAttribute('aria-disabled', 'true')
  })

  it('hides Q7 and re-enables Q10 in the navigation', () => {
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

    expect(screen.queryByText('Q7')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Q10' })).toBeInTheDocument()
  })
})
