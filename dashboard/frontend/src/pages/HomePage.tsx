import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DeputySearch } from '../components/DeputySearch'
import type { MetaResponse } from '../types'
import { isQuestionEnabled, isQuestionHidden } from '../utils/questionAvailability'

interface HomePageProps {
  meta: MetaResponse
}

export function HomePage({ meta }: HomePageProps) {
  const [questionsOpen, setQuestionsOpen] = useState(false)

  const questions = meta.questions || []

  // Filter questions that are not hidden
  const visibleQuestions = questions.filter((question) => !isQuestionHidden(question.id))

  return (
    <main className="home-page">
      {/* Hero — compact intro */}
      <section className="hero-card home-hero stagger-item">
        <h1>Painel de Analise Parlamentar</h1>
        <p className="home-hero-subtitle">
          Visualize dados legislativos, gastos parlamentares e indicadores de desempenho.
        </p>
      </section>

      {/* Primary CTA — Painel de Gastos */}
      <section className="deputy-search-hero stagger-item">
        <div className="deputy-search-hero__copy">
          <h2>Pesquisar deputado</h2>
          <p>Encontre um parlamentar e veja seu perfil individual.</p>
        </div>
        <DeputySearch placeholder="Pesquisar deputado..." />
      </section>

      <section className="home-primary-cta stagger-item">
        <div className="home-cta-content">
          <h2>Painel Consolidado de Gastos</h2>
          <p>Analise detalhada de despesas parlamentares com rankings, anomalias e filtros interativos.</p>
        </div>
        <Link to="/grupos/gastos" className="home-cta-btn">
          Acessar Painel →
        </Link>
      </section>

      <section className="home-primary-cta home-profile-cta stagger-item">
        <div className="home-cta-content">
          <h2>Escolaridade e Perfil</h2>
          <p>Explore a formação dos deputados e sua associação com indicadores de atividade parlamentar.</p>
        </div>
        <Link to="/grupos/perfil" className="home-cta-btn">
          Acessar Painel →
        </Link>
      </section>

      {/* Secondary — Questions Q1-Q13 */}
      <section className="home-questions-section stagger-item">
        <button
          type="button"
          className="home-questions-toggle"
          onClick={() => setQuestionsOpen(!questionsOpen)}
          aria-expanded={questionsOpen}
        >
          <span className="home-questions-toggle-label">
            Questoes individuais
            <span className="home-questions-count">{visibleQuestions.length}</span>
          </span>
          <span className={`home-questions-chevron${questionsOpen ? ' open' : ''}`}>▾</span>
        </button>

        {questionsOpen && (
          <ul className="home-questions-list">
            {visibleQuestions.map((question) => {
              const enabled = isQuestionEnabled(question.id)
              return (
                <li key={question.id} className="home-question-item">
                  <span className="home-question-id">{question.id.toUpperCase()}</span>
                  <div className="home-question-info">
                    <span className="home-question-title">{question.title}</span>
                  </div>
                  {enabled ? (
                    <Link to={`/q/${question.id}`} className="home-question-link">
                      Abrir
                    </Link>
                  ) : (
                    <span className="home-question-disabled">Em desenvolvimento</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
