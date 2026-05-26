import { Link, NavLink } from 'react-router-dom'

import type { QuestionMeta } from '../types'

interface HeaderProps {
  questions: QuestionMeta[]
  datasetVersion?: string
}

export function Header({ questions, datasetVersion }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-top">
        <Link to="/" className="brand">
          BDR Painel Q1-Q13
        </Link>
        <span className="dataset-version">dataset: {datasetVersion ?? '-'}</span>
      </div>
      <nav className="question-nav" aria-label="Navegacao por perguntas">
        <NavLink to="/" end className={({ isActive }) => `question-link${isActive ? ' active' : ''}`}>
          Home
        </NavLink>
        {questions.map((question) => (
          <NavLink
            key={question.id}
            to={`/q/${question.id}`}
            className={({ isActive }) => `question-link${isActive ? ' active' : ''}`}
          >
            {question.id.toUpperCase()}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

