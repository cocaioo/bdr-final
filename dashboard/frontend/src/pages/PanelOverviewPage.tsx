import { Link } from 'react-router-dom'

interface PanelOverviewPageProps {
  title: string
  description: string
  topics: string[]
}

export function PanelOverviewPage({ title, description, topics }: PanelOverviewPageProps) {
  return (
    <main className="panel-overview-page">
      <section className="panel-overview-hero stagger-item">
        <span>Painel em consolidação</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="panel-overview-card stagger-item">
        <div>
          <span>Próxima etapa</span>
          <h2>O que este módulo reunirá</h2>
          <p>A composição integrada será disponibilizada aqui sem expor análises técnicas isoladas.</p>
        </div>
        <ul>
          {topics.map((topic) => <li key={topic}>{topic}</li>)}
        </ul>
        <Link to="/">Voltar aos painéis</Link>
      </section>
    </main>
  )
}
