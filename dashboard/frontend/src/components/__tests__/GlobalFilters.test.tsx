import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { GlobalFilters } from '../GlobalFilters'
import type { FilterCatalog, FilterState } from '../../types'

const catalog: FilterCatalog = {
  anos: [
    { value: '2023', label: '2023' },
    { value: '2024', label: '2024' },
  ],
  eixos: [
    { value: 'Social', label: 'Social' },
    { value: 'Economia', label: 'Economia' },
  ],
  partidos: [
    { value: 'PT', label: 'PT' },
    { value: 'PL', label: 'PL' },
  ],
  ufs: [
    { value: 'SP', label: 'SP' },
    { value: 'RJ', label: 'RJ' },
  ],
  deputados: [
    { value: 'Ana Silva', label: 'Ana Silva' },
    { value: 'Bruno Lima', label: 'Bruno Lima' },
  ],
}

const value: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  search: '',
}

describe('GlobalFilters', () => {
  it('renders the available filters and updates the selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <GlobalFilters catalog={catalog} value={value} onChange={onChange} supportedFilters={['anos', 'deputados']} />,
    )

    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Deputado')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /deputado/i })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Ano'), ['2024'])

    expect(onChange).toHaveBeenCalledWith({ ...value, anos: ['2024'] })
  })

  it('does not expose a deputy-id search control', () => {
    const onChange = vi.fn()

    render(
      <GlobalFilters catalog={catalog} value={value} onChange={onChange} supportedFilters={['anos']} />,
    )

    expect(screen.queryByText(/buscar deputado por id/i)).not.toBeInTheDocument()
  })

  it('renders party options exactly from the backend catalog', () => {
    const onChange = vi.fn()
    const backendCatalog: FilterCatalog = {
      ...catalog,
      partidos: [
        { value: 'PL', label: 'PL', status: 'ativo' },
        { value: 'PT', label: 'PT', status: 'ativo' },
      ],
    }

    render(
      <GlobalFilters
        catalog={backendCatalog}
        value={value}
        onChange={onChange}
        supportedFilters={['partidos']}
      />,
    )

    expect(screen.getByRole('option', { name: 'PL' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PT' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'ARENA' })).not.toBeInTheDocument()
  })
})
