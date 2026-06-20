import { Link } from 'react-router-dom'

import { DeputySearch } from '../components/DeputySearch'

const PANELS = [
  {
    title: 'Gastos parlamentares',
    description: 'Acompanhe valores, categorias, deputados, fornecedores e diferenças entre partidos e estados.',
    route: '/grupos/gastos',
    status: 'Disponível',
  },
  {
    title: 'Escolaridade e perfil dos deputados',
    description: 'Explore a formação da legislatura e compare indicadores de atividade entre níveis de escolaridade.',
    route: '/grupos/perfil',
    status: 'Disponível',
  },
  {
    title: 'Produção legislativa',
    description: 'Módulo destinado a temas, proposições, autoria e indicadores de atuação parlamentar.',
    route: '/grupos/producao-legislativa',
    status: 'Em consolidação',
  },
  {
    title: 'Partidos e votações',
    description: 'Módulo destinado a alinhamento partidário, orientações, votos e comparações entre bancadas.',
    route: '/grupos/partidos-votacoes',
    status: 'Em consolidação',
  },
]

export function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-card home-hero stagger-item">
        <span className="home-hero-eyebrow">Inteligência parlamentar</span>
        <h1>Painéis de análise parlamentar</h1>
        <p className="home-hero-subtitle">
          Escolha um módulo para explorar informações públicas da Câmara de forma integrada.
        </p>
      </section>

      <section className="home-panel-section stagger-item" aria-labelledby="home-panels-title">
        <header className="home-panel-heading">
          <div>
            <span>Módulos analíticos</span>
            <h2 id="home-panels-title">Explore os painéis</h2>
          </div>
          <p>Cada painel reúne indicadores relacionados em uma única experiência.</p>
        </header>

        <div className="home-panel-grid">
          {PANELS.map((panel) => (
            <article className="home-panel-card" key={panel.route}>
              <span className={`home-panel-status${panel.status === 'Disponível' ? ' available' : ''}`}>
                {panel.status}
              </span>
              <h3>{panel.title}</h3>
              <p>{panel.description}</p>
              <Link to={panel.route} aria-label={`Abrir painel: ${panel.title}`}>Abrir painel</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="deputy-search-hero stagger-item">
        <div className="deputy-search-hero__copy">
          <h2>Pesquisar deputado</h2>
          <p>Encontre um parlamentar e consulte seu perfil individual.</p>
        </div>
        <DeputySearch placeholder="Pesquisar deputado..." />
      </section>
    </main>
  )
}
