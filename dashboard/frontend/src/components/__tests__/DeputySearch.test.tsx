import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchDeputies } from '../../api'
import { DeputySearch } from '../DeputySearch'

vi.mock('../../api', () => ({
  fetchDeputies: vi.fn(),
}))

const fetchDeputiesMock = vi.mocked(fetchDeputies)

const deputies = [
  {
    id: '220593',
    nome: 'Abilio Brunini',
    nomeCivil: 'ABILIO JACQUES BRUNINI MOUMER',
    escolaridade: 'Superior',
    legislaturaInicial: '57',
    legislaturaFinal: '57',
  },
  {
    id: '204379',
    nome: 'Acacio Favacho',
    nomeCivil: 'ACACIO DA SILVA FAVACHO NETO',
    escolaridade: 'Superior',
    legislaturaInicial: '56',
    legislaturaFinal: '57',
  },
]

describe('DeputySearch', () => {
  beforeEach(() => {
    fetchDeputiesMock.mockReset()
    fetchDeputiesMock.mockResolvedValue(deputies)
  })

  it('filters by part of the name and navigates when selected', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DeputySearch />} />
          <Route path="/deputados/:id" element={<div>Perfil carregado</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByRole('combobox', { name: /pesquisar deputado/i })
    await user.type(input, 'abi')

    expect(await screen.findByRole('option', { name: /Abilio Brunini/i })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /Abilio Brunini/i }))

    expect(await screen.findByText('Perfil carregado')).toBeInTheDocument()
  })

  it('closes on escape and hides suggestions when cleared', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DeputySearch />} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByRole('combobox', { name: /pesquisar deputado/i })
    await user.type(input, 'a')
    expect(await screen.findByRole('option', { name: /Abilio Brunini/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(input)
    await user.clear(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
