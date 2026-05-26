import { Link } from 'react-router-dom'

import type { MetaResponse } from '../types'

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
        {meta.questions.map((question, index) => (
          <article
            key={question.id}
            className="question-card stagger-item"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <h2>{question.id.toUpperCase()}</h2>
            <h3>{question.title}</h3>
            <p>{question.description}</p>
            <Link to={`/q/${question.id}`}>Abrir painel</Link>
          </article>
        ))}
      </section>
    </main>
  )
}

