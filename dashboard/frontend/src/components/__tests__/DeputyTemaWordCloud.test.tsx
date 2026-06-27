import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DeputyTemaWordCloud } from '../DeputyTemaWordCloud'

const TEMAS = [
  { tema: 'Administração Pública', qtd_proposicoes: 1036 },
  { tema: 'Saúde', qtd_proposicoes: 973 },
  { tema: 'Educação', qtd_proposicoes: 1 },
]

describe('DeputyTemaWordCloud', () => {
  it('renders one word per tema with no zero-count entries', () => {
    render(<DeputyTemaWordCloud temas={TEMAS} />)

    expect(screen.getByText('Administração Pública')).toBeInTheDocument()
    expect(screen.getByText('Saúde')).toBeInTheDocument()
    expect(screen.getByText('Educação')).toBeInTheDocument()
    expect(screen.queryByText('Cultura')).not.toBeInTheDocument()
  })

  it('sizes words proportionally to proposal count', () => {
    render(<DeputyTemaWordCloud temas={TEMAS} />)

    const biggest = screen.getByText('Administração Pública')
    const smallest = screen.getByText('Educação')
    const biggestSize = Number.parseFloat(biggest.style.fontSize)
    const smallestSize = Number.parseFloat(smallest.style.fontSize)

    expect(biggestSize).toBeGreaterThan(smallestSize)
  })

  it('shows a tooltip with the exact proposal count on hover', async () => {
    const user = userEvent.setup()
    render(<DeputyTemaWordCloud temas={TEMAS} />)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(screen.getByText('Saúde'))

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Saúde')
    expect(tooltip).toHaveTextContent('973 proposições')
  })

  it('exposes the count via aria-label for accessibility', () => {
    render(<DeputyTemaWordCloud temas={TEMAS} />)

    expect(screen.getByLabelText('Administração Pública: 1036 proposições')).toBeInTheDocument()
  })
})
