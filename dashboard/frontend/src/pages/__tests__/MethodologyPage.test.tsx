import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { MethodologyPage } from '../MethodologyPage'

describe('MethodologyPage', () => {
  it('exibe índices visuais sequenciais para as seções', () => {
    const { container } = render(
      <MemoryRouter>
        <MethodologyPage />
      </MemoryRouter>
    )
    const indices = Array.from(
      container.querySelectorAll('.method-section__head > span'),
      (node) => node.textContent,
    )

    expect(indices).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
    ])
  })
})
