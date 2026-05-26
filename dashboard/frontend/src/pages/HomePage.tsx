import { Link } from 'react-router-dom'

import type { MetaResponse } from '../types'
import { isQuestionEnabled } from '../utils/questionAvailability'

interface HomePageProps {
  meta: MetaResponse
}

export function HomePage({ meta }: HomePageProps) {
  return (
    <main className="home-page">
      <section className="hero-card stagger-item">
        <h1>Painel de Analise Parlamentar</h1>
        <p>
          Explore as perguntas Q1 a Q13 com visualizacoes, ranking paginado e transparencia da
          query SQL usada.
        </p>
      </section>

      <section className="question-grid">
        {meta.questions.map((question, index) => {
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
    </main>
  )
}

