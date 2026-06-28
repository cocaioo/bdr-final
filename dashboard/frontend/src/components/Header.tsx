import { Link, NavLink } from 'react-router-dom'

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
  return (
    <header className="app-header">
      <div className="header-top">
        <Link to="/" className="brand">
          BDR Painéis Parlamentares
        </Link>
        <span className="dataset-version">dataset: {datasetVersion ?? '-'}</span>
      </div>
      <nav className="question-nav app-nav" aria-label="Navegação principal">
        <NavLink to="/" end className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`}>
          Início
        </NavLink>
        {PANEL_LINKS.map((panel) => (
          <NavLink
            key={panel.to}
            to={panel.to}
            className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`}
          >
            {panel.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
