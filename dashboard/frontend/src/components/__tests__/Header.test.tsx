import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { Header } from '../Header'

describe('Header', () => {
  it('lista somente os três painéis da navegação principal', () => {
    render(
      <MemoryRouter>
        <Header datasetVersion="test-version" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Gastos' })).toHaveAttribute('href', '/grupos/gastos')
    expect(screen.getByRole('link', { name: 'Escolaridade e perfil' })).toHaveAttribute('href', '/grupos/perfil')
    expect(screen.getByRole('link', { name: 'Partidos e ideologia' })).toHaveAttribute('href', '/grupos/partidos-votacoes')
    expect(screen.queryByText(/Q1|Q13|quest[aã]o/i)).not.toBeInTheDocument()
  })
})
