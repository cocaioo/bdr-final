import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { MetaResponse } from '../types'
import { isQuestionEnabled, isQuestionHidden } from '../utils/questionAvailability'

interface HomePageProps {
  meta: MetaResponse
}

export function HomePage({ meta }: HomePageProps) {
  const [activeTab, setActiveTab] = useState<string>('all')

  const groups = meta.groups || []
  const questions = meta.questions || []

  // Filter questions that are not hidden
  const visibleQuestions = questions.filter((question) => !isQuestionHidden(question.id))

  const hasGroups = groups.length > 0

  return (
    <main className="home-page">
      <section className="hero-card stagger-item">
        <h1>Painel de Analise Parlamentar</h1>
        <p>
          Explore as perguntas Q1 a Q13 organizadas por áreas temáticas com visualizações,
          ranking paginado e transparência das consultas SQL executadas.
        </p>
      </section>

      {/* Tabs navigation */}
      {hasGroups && (
        <div className="home-tabs-container stagger-item">
          <button
            type="button"
            className={`home-tab-btn${activeTab === 'all' ? ' active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Ver Todas
          </button>
          {groups.map((group) => {
            const count = visibleQuestions.filter((q) => q.group_id === group.id).length
            if (count === 0) return null

            return (
              <button
                key={group.id}
                type="button"
                className={`home-tab-btn${activeTab === group.id ? ' active' : ''}`}
                onClick={() => setActiveTab(group.id)}
              >
                {group.label} <span className="tab-badge">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grouped sections */}
      <div className="home-groups-container">
        {hasGroups ? (
          groups
            .filter((group) => activeTab === 'all' || activeTab === group.id)
            .map((group) => {
              const groupQuestions = visibleQuestions.filter((q) => q.group_id === group.id)
              if (groupQuestions.length === 0) return null

              return (
                <section key={group.id} className="group-section stagger-item">
                  <div className="group-header">
                    <h2>{group.label}</h2>
                    {group.description && <p className="group-description">{group.description}</p>}
                    {group.id === 'gastos' && (
                      <Link to="/grupos/gastos" className="consolidated-dashboard-cta">
                        Acessar Painel Consolidado de Gastos →
                      </Link>
                    )}
                  </div>
                  <div className="question-grid">
                    {groupQuestions.map((question, index) => {
                      const isEnabled = isQuestionEnabled(question.id)
                      return (
                        <article
                          key={question.id}
                          className={`question-card${isEnabled ? '' : ' question-card-disabled'}`}
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <div className="card-top">
                            <span className="question-id-badge">{question.id.toUpperCase()}</span>
                            {question.tags && question.tags.length > 0 && (
                              <div className="card-tags">
                                {question.tags.map((tag) => (
                                  <span key={tag} className="card-tag-badge">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <h3>{question.title}</h3>
                          <p>{question.description}</p>
                          <div className="card-action">
                            {isEnabled ? (
                              <Link to={`/q/${question.id}`} className="open-btn">
                                Abrir painel
                              </Link>
                            ) : (
                              <div className="question-maintenance">
                                <span className="question-maintenance-mark">X</span>
                                <span>Em desenvolvimento</span>
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })
        ) : (
          // Fallback legacy grid if no groups meta is available (backward compatibility)
          <section className="question-grid">
            {visibleQuestions.map((question, index) => {
              const isEnabled = isQuestionEnabled(question.id)
              return (
                <article
                  key={question.id}
                  className={`question-card stagger-item${isEnabled ? '' : ' question-card-disabled'}`}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <h2>{question.id.toUpperCase()}</h2>
                  <h3>{question.title}</h3>
                  <p>{question.description}</p>
                  {isEnabled ? (
                    <Link to={`/q/${question.id}`}>Abrir painel</Link>
                  ) : (
                    <div className="question-maintenance">
                      <span className="question-maintenance-mark">X</span>
                      <span>Em desenvolvimento</span>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

