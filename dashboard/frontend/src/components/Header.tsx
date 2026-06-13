import { Link, NavLink } from 'react-router-dom'

import type { QuestionMeta } from '../types'
import { isQuestionEnabled, isQuestionHidden } from '../utils/questionAvailability'

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
        <NavLink
          to="/grupos/gastos"
          className={({ isActive }) => `question-link${isActive ? ' active' : ''}`}
          style={{ background: 'rgba(179, 157, 219, 0.08)', color: 'var(--accent)', borderColor: 'rgba(179, 157, 219, 0.2)' }}
        >
          Painel de Gastos
        </NavLink>
        {questions
          .filter((question) => !isQuestionHidden(question.id))
          .map((question) => {
          const isQuestionUnderDevelopment = !isQuestionEnabled(question.id)

          if (isQuestionUnderDevelopment) {
            return (
              <span
                key={question.id}
                className="question-link question-link-disabled"
                aria-disabled="true"
                title="Em desenvolvimento"
              >
                {question.id.toUpperCase()}
              </span>
            )
          }

          return (
            <NavLink
              key={question.id}
              to={`/q/${question.id}`}
              className={({ isActive }) => `question-link${isActive ? ' active' : ''}`}
            >
              {question.id.toUpperCase()}
            </NavLink>
          )
          })}
      </nav>
    </header>
  )
}

