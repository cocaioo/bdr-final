import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

interface HeaderProps {
  datasetVersion?: string
}

const PANEL_LINKS = [
  { to: '/grupos/gastos', label: 'Gastos' },
  { to: '/grupos/perfil', label: 'Escolaridade e perfil' },
  { to: '/grupos/partidos-votacoes', label: 'Partidos e ideologia' },
  { to: '/metodologia', label: 'Metodologia' },
]

export function Header({ datasetVersion }: HeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  const handleNavClick = () => setMobileNavOpen(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <header className="app-header">
      <div className="header-top">
        <Link to="/" className="brand" onClick={handleNavClick}>
          BDR Painéis Parlamentares
        </Link>
        <span className="dataset-version">dataset: {datasetVersion ?? '-'}</span>
        <button
          className="mobile-menu-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="main-nav"
          aria-label={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMobileNavOpen((prev) => !prev)}
          type="button"
        >
          {mobileNavOpen ? '✕' : '☰'}
        </button>
      </div>
      <nav
        id="main-nav"
        className={`question-nav app-nav${mobileNavOpen ? ' mobile-nav-open' : ''}`}
        aria-label="Navegação principal"
      >
        <NavLink to="/" end className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`} onClick={handleNavClick}>
          Início
        </NavLink>
        {PANEL_LINKS.map((panel) => (
          <NavLink
            key={panel.to}
            to={panel.to}
            className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`}
            onClick={handleNavClick}
          >
            {panel.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
