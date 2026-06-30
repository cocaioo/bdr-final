import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { useTheme } from '../hooks/useTheme'

interface HeaderProps {
  datasetVersion?: string
}

const PANEL_LINKS = [
  { to: '/grupos/gastos', label: 'Gastos' },
  { to: '/grupos/perfil', label: 'Escolaridade e perfil' },
  { to: '/grupos/partidos-votacoes', label: 'Partidos e ideologia' },
  { to: '/metodologia', label: 'Metodologia' },
]

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isDark ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
        )}
      </span>
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  )
}

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
        <ThemeToggle />
      </nav>
    </header>
  )
}
