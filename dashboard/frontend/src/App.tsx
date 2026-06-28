import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { fetchMeta } from './api'
import { GlobalFilters } from './components/GlobalFilters'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { DeputyProfilePage } from './pages/DeputyProfilePage'
import { QuestionPage } from './pages/QuestionPage'
import { GastosDashboardPage } from './pages/GastosDashboardPage'
import { PerfilDashboardPage } from './pages/PerfilDashboardPage'
import { PartiesDashboardPage } from './pages/PartiesDashboardPage'
import { MethodologyPage } from './pages/MethodologyPage'
import type { FilterState, MetaResponse } from './types'
import { isQuestionHidden } from './utils/questionAvailability'

// Bloco consolidado de Partidos, Ideologia e Votacao. As perguntas q9/q10/q11
// deixaram de ter paginas individuais: passaram a ser detalhes de implementacao
// que alimentam este painel unico.
const PARTIES_BLOCK_ROUTE = '/grupos/partidos-votacoes'
const RETIRED_QUESTION_IDS = new Set(['q9', 'q10', 'q11', 'q14'])

const EMPTY_FILTER_STATE: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

function extractQuestionId(pathname: string): string | null {
  if (pathname.startsWith('/q/')) {
    return pathname.split('/')[2]?.replace(/\/$/, '') || null
  }
  if (pathname.startsWith('/pergunta/')) {
    return pathname.split('/')[2]?.replace(/\/$/, '') || null
  }
  return null
}

function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER_STATE)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()

  const activeQuestionId = extractQuestionId(location.pathname)
  const isRetiredQuestion = Boolean(activeQuestionId && RETIRED_QUESTION_IDS.has(activeQuestionId.toLowerCase()))
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
      <div className="app-main-container">
        {activeQuestionId && !hiddenQuestionRoute && !isRetiredQuestion ? (
          <GlobalFilters
            catalog={activeQuestionCatalog}
            value={filters}
            onChange={setFilters}
            supportedFilters={
              ['q2', 'q4', 'q7'].includes(activeQuestionId?.toLowerCase() ?? '')
                ? activeQuestion?.supported_filters?.filter((f) => f !== 'deputados')
                : activeQuestion?.supported_filters
            }
            hideSearch={activeQuestionId?.toLowerCase() === 'q3'}
            hideNumericDeputyChoices={activeQuestionId?.toLowerCase() === 'q3'}
            searchableDeputyFilter={activeQuestionId?.toLowerCase() === 'q3'}
            searchLabel={
              activeQuestionId?.toLowerCase() === 'q7'
                ? 'Buscar deputado por nome'
                : undefined
            }
            searchPlaceholder={
              activeQuestionId?.toLowerCase() === 'q7'
                ? 'Digite o nome parlamentar...'
                : undefined
            }
          />
        ) : null}
        <div className="app-main-route-wrapper" key={location.pathname}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/deputados/:id" element={<DeputyProfilePage />} />
            <Route
              path="/q/:questionId"
              element={
                isRetiredQuestion
                  ? <Navigate to={PARTIES_BLOCK_ROUTE} replace />
                  : <QuestionPage key={activeQuestionId || undefined} meta={meta} filters={filters} onFiltersChange={setFilters} />
              }
            />
            <Route
              path="/pergunta/:questionId"
              element={
                isRetiredQuestion
                  ? <Navigate to={PARTIES_BLOCK_ROUTE} replace />
                  : <QuestionPage key={activeQuestionId || undefined} meta={meta} filters={filters} onFiltersChange={setFilters} />
              }
            />
            <Route path="/grupos/gastos" element={<GastosDashboardPage meta={meta} />} />
            <Route path="/grupos/perfil" element={<PerfilDashboardPage meta={meta} />} />
            <Route path="/grupos/partidos-votacoes" element={<PartiesDashboardPage meta={meta} />} />
            <Route path="/metodologia" element={<MethodologyPage />} />
          </Routes>
        </div>
        <footer className="app-footer">
          Fonte: schema grupo4 + fontes analíticas consolidadas | Atualizado em {new Date(meta.last_updated).toLocaleString('pt-BR')}
        </footer>
      </div>
    </div>
  )
}

export default App
