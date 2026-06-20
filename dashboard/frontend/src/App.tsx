import { useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { fetchMeta } from './api'
import { GlobalFilters } from './components/GlobalFilters'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { DeputyProfilePage } from './pages/DeputyProfilePage'
import { QuestionPage } from './pages/QuestionPage'
import { GastosDashboardPage } from './pages/GastosDashboardPage'
import { PanelOverviewPage } from './pages/PanelOverviewPage'
import { PerfilDashboardPage } from './pages/PerfilDashboardPage'
import type { FilterState, MetaResponse } from './types'
import { isQuestionHidden } from './utils/questionAvailability'

const EMPTY_FILTER_STATE: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()

  const activeQuestionId = location.pathname.startsWith('/q/')
    ? location.pathname.split('/')[2]?.replace(/\/$/, '') || null
    : null
  const activeQuestion = meta?.questions.find((question) => question.id === activeQuestionId)
  const hiddenQuestionRoute = Boolean(activeQuestionId && isQuestionHidden(activeQuestionId))

  useEffect(() => {
    setFilters(EMPTY_FILTER_STATE)
  }, [activeQuestionId])

  useEffect(() => {
    fetchMeta()
      .then((result) => {
        setMeta(result)
      })
      .catch((cause: Error) => {
        setError(cause.message)
      })
  }, [])

  if (error) {
    return (
      <div className="app-shell">
        <p className="loading">Erro ao carregar metadados: {error}</p>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="app-shell">
        <p className="loading">Carregando estrutura do painel...</p>
      </div>
    )
  }

  const activeQuestionCatalog =
    activeQuestionId && meta.question_filters?.[activeQuestionId]
      ? meta.question_filters[activeQuestionId]
      : meta.available_filters

  return (
    <div className="app-shell">
      <Header datasetVersion={meta.dataset_version} />
      {activeQuestionId && !hiddenQuestionRoute ? (
        <GlobalFilters
          catalog={activeQuestionCatalog}
          value={filters}
          onChange={setFilters}
          supportedFilters={
            activeQuestionId?.toLowerCase() === 'q2' || activeQuestionId?.toLowerCase() === 'q4'
              ? activeQuestion?.supported_filters?.filter((f) => f !== 'deputados')
              : activeQuestion?.supported_filters
          }
          hideSearch={activeQuestionId?.toLowerCase() === 'q3'}
          hideNumericDeputyChoices={activeQuestionId?.toLowerCase() === 'q3'}
          searchableDeputyFilter={activeQuestionId?.toLowerCase() === 'q3'}
        />
      ) : null}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/deputados/:id" element={<DeputyProfilePage />} />
        <Route path="/q/:questionId" element={<QuestionPage key={activeQuestionId || undefined} meta={meta} filters={filters} onFiltersChange={setFilters} />} />
        <Route path="/grupos/gastos" element={<GastosDashboardPage meta={meta} />} />
        <Route path="/grupos/perfil" element={<PerfilDashboardPage meta={meta} />} />
        <Route
          path="/grupos/producao-legislativa"
          element={(
            <PanelOverviewPage
              title="Produção legislativa"
              description="Visão integrada sobre temas, proposições, autoria e indicadores de atuação parlamentar."
              topics={['Temas de atuação', 'Proposições e autoria', 'Indicadores de influência legislativa']}
            />
          )}
        />
        <Route
          path="/grupos/partidos-votacoes"
          element={(
            <PanelOverviewPage
              title="Partidos e votações"
              description="Visão integrada sobre bancadas, orientações partidárias, votos e alinhamento interno."
              topics={['Composição partidária', 'Orientações e votos', 'Alinhamento entre partidos e bancadas']}
            />
          )}
        />
      </Routes>
      <footer className="app-footer">
        Fonte: schema grupo4 + fontes analíticas consolidadas | Atualizado em {new Date(meta.last_updated).toLocaleString('pt-BR')}
      </footer>
    </div>
  )
}

export default App
