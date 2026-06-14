import { Link, NavLink } from 'react-router-dom'

import type { QuestionMeta } from '../types'
import { isQuestionEnabled, isQuestionHidden } from '../utils/questionAvailability'

interface HeaderProps {
  questions: QuestionMeta[]
  datasetVersion?: string
}

export function Header({ questions, datasetVersion }: HeaderProps) {
  const visibleQuestions = questions.filter((question) => !isQuestionHidden(question.id))

  return (
    <header className="app-header">
      <div className="header-top">
        <Link to="/" className="brand">
          BDR Painel Q1-Q13
        </Link>
        <span className="dataset-version">dataset: {datasetVersion ?? '-'}</span>
      </div>
      <nav className="question-nav app-nav" aria-label="Navegacao principal">
        <NavLink to="/" end className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`}>
          Home
        </NavLink>
        <NavLink
          to="/grupos/gastos"
          className={({ isActive }) => `question-link nav-link${isActive ? ' active' : ''}`}
        >
          Painel de Gastos
        </NavLink>
        <details className="questions-menu">
          <summary>Questões Q1-Q13</summary>
          <div className="questions-menu-list" aria-label="Lista de questoes">
            {visibleQuestions.map((question) => {
              const isQuestionUnderDevelopment = !isQuestionEnabled(question.id)

              if (isQuestionUnderDevelopment) {
                return (
                  <span
                    key={question.id}
                    className="question-menu-link question-link-disabled"
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
                  className={({ isActive }) => `question-menu-link${isActive ? ' active' : ''}`}
                >
                  {question.id.toUpperCase()}
                </NavLink>
              )
            })}
          </div>
        </details>
      </nav>
    </header>
  )
}

