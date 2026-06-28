import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('abre e fecha a navegação móvel pelo botão do menu', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: 'Abrir menu' })
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(navigation).not.toHaveClass('mobile-nav-open')

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(navigation).toHaveClass('mobile-nav-open')

    await user.click(screen.getByRole('link', { name: 'Gastos' }))
    expect(navigation).not.toHaveClass('mobile-nav-open')
  })
})
