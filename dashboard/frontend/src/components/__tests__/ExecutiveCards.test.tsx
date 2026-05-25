import { render, screen } from '@testing-library/react'

import { ExecutiveCards } from '../ExecutiveCards'

describe('ExecutiveCards', () => {
  it('renders summary cards content', () => {
    render(
      <ExecutiveCards
        cards={[
          { id: 'a', label: 'Total pago', value: '1000', unit: 'R$' },
          { id: 'b', label: 'Deputados', value: '30', unit: 'contagem' },
        ]}
      />,
    )

    expect(screen.getByText('Total pago')).toBeInTheDocument()
    expect(screen.getByText('Deputados')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
  })
})

