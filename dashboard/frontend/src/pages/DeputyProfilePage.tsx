import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchDeputies, fetchDeputyGastosSummary, fetchDeputyIdentityFromGastos, fetchQuestionForDeputy } from '../api'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { DeputySearch } from '../components/DeputySearch'
import type { DeputyGastosProfile, DeputyIdentityEnrichment, DeputyOption } from '../types'
import { formatCurrency } from '../utils/format'

function optionalLabel(value?: string): string {
  return value && value.trim() ? value : 'Não informado'
}

function formatLegislatura(deputy: DeputyOption): string {
  const start = deputy.legislaturaInicial
  const end = deputy.legislaturaFinal
  if (!start && !end) return 'Não informada'
  if (start && end && start === end) return `${start}ª Legislatura`
  if (start && end) return `${start}ª a ${end}ª Legislaturas`
  return `${start ?? end}ª Legislatura`
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

function numericValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

interface DeputyCostBenefitProfile {
  posicao: number | null
  indice: number
  gastoTotal: number
  totalProposicoes: number
  scoreTotal: number
  scoreAjustado: number
  periodoLabel: string
  anoParcial: boolean
}

function LoadingSkeleton() {
  return (
    <main className="deputy-profile" aria-busy="true">
      <section className="deputy-profile__hero deputy-profile__hero--loading">
        <div className="deputy-profile__loading-identity">
          <div className="skeleton deputy-profile__avatar-skeleton" />
          <div className="deputy-profile__loading-copy">
            <div className="skeleton skeleton-text" style={{ width: '180px', height: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: '320px', height: 28 }} />
            <div className="skeleton skeleton-text" style={{ width: '240px', height: 12 }} />
          </div>
        </div>
      </section>
    </main>
  )
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="deputy-profile__fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="deputy-profile__section-heading">
      <div>
        <span className="deputy-profile__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </header>
  )
}

function EmptyGastos() {
  return (
    <div className="deputy-profile__empty" role="status">
      <strong>Nenhum dado de gasto disponível para este deputado.</strong>
      <span>O perfil cadastral continua disponível; esta seção será preenchida quando houver dados nos endpoints atuais.</span>
    </div>
  )
}

function GastosSection({ data, loading, error }: { data: DeputyGastosProfile | null; loading: boolean; error: string | null }) {
  if (loading) {
    return <div className="deputy-profile__empty" role="status">Carregando dados reais de despesas…</div>
  }
  if (error) {
    return (
      <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
        <strong>Não foi possível carregar os gastos agora.</strong>
        <span>O restante do perfil permanece disponível.</span>
      </div>
    )
  }
  if (!data?.hasData) return <EmptyGastos />

  const categoryMax = Math.max(...data.categories.map((item) => item.valor_total), 1)
  const supplierMax = Math.max(...data.suppliers.map((item) => item.valor_total), 1)
  const annualMax = Math.max(...data.evolution.map((item) => item.valor_total), 1)

  return (
    <>
      {data.summary ? (
        <div className="deputy-profile__metrics" aria-label="Resumo de gastos">
          <ProfileField label="Total gasto" value={formatCurrency(data.summary.valor_total)} />
          <ProfileField label="Quantidade de despesas" value={formatNumber(data.summary.qtd_despesas)} />
          <ProfileField label="Despesa média" value={formatCurrency(data.summary.ticket_medio)} />
          <ProfileField label="Fornecedores" value={formatNumber(data.summary.qtd_fornecedores)} />
        </div>
      ) : null}

      <div className="deputy-profile__analytics-grid">
        <article className="deputy-profile__data-card">
          <h3>Principais categorias</h3>
          {data.categories.length ? (
            <ol className="deputy-profile__bar-list">
              {data.categories.map((item) => (
                <li key={item.categoria}>
                  <div><span>{item.categoria}</span><strong>{formatCurrency(item.valor_total)}</strong></div>
                  <div className="deputy-profile__bar-track" aria-hidden="true">
                    <span style={{ width: `${(item.valor_total / categoryMax) * 100}%` }} />
                  </div>
                  <small>{formatNumber(item.qtd_despesas)} despesas</small>
                </li>
              ))}
            </ol>
          ) : <p className="deputy-profile__inline-empty">Categorias não disponíveis.</p>}
        </article>

        <article className="deputy-profile__data-card">
          <h3>Principais fornecedores</h3>
          {data.suppliers.length ? (
            <ol className="deputy-profile__bar-list">
              {data.suppliers.map((item) => (
                <li key={item.fornecedor}>
                  <div><span>{item.fornecedor}</span><strong>{formatCurrency(item.valor_total)}</strong></div>
                  <div className="deputy-profile__bar-track" aria-hidden="true">
                    <span style={{ width: `${(item.valor_total / supplierMax) * 100}%` }} />
                  </div>
                  <small>{formatNumber(item.qtd_despesas)} despesas</small>
                </li>
              ))}
            </ol>
          ) : <p className="deputy-profile__inline-empty">Fornecedores não disponíveis.</p>}
        </article>
      </div>

      {data.evolution.length ? (
        <article className="deputy-profile__data-card">
          <h3>Evolução anual</h3>
          <div className="deputy-profile__year-chart" aria-label="Gastos por ano">
            {data.evolution.map((item) => (
              <div key={item.ano} className="deputy-profile__year-item">
                <strong>{formatCurrency(item.valor_total)}</strong>
                <div className="deputy-profile__year-bar"><span style={{ height: `${Math.max((item.valor_total / annualMax) * 100, 3)}%` }} /></div>
                <span>{item.ano}</span>
                <small>{formatNumber(item.qtd_despesas)} despesas</small>
              </div>
            ))}
          </div>
        </article>
      ) : null}


      {data.partialErrors.length ? (
        <p className="deputy-profile__partial-note">Alguns recortes não puderam ser carregados: {data.partialErrors.join(', ')}.</p>
      ) : null}
    </>
  )
}

export function DeputyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [catalog, setCatalog] = useState<DeputyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gastosState, setGastosState] = useState<{
    deputyId?: string
    data: DeputyGastosProfile | null
    error: string | null
  }>({ data: null, error: null })
  const [q7State, setQ7State] = useState<{
    deputyId?: string
    data: DeputyCostBenefitProfile | null
    error: string | null
  }>({ data: null, error: null })
  const [identityEnrichment, setIdentityEnrichment] = useState<DeputyIdentityEnrichment>({})

  useEffect(() => {
    let active = true
    fetchDeputies()
      .then((items) => { if (active) setCatalog(items) })
      .catch((cause: Error) => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const deputy = useMemo(() => catalog.find((item) => item.id === id), [catalog, id])

  useEffect(() => {
    if (!deputy) return
    let active = true
    setIdentityEnrichment({})
    setQ7State({ data: null, error: null })
    fetchDeputyIdentityFromGastos(deputy.id)
      .then((enrichment) => { if (active) setIdentityEnrichment(enrichment) })
      .catch(() => { /* silently ignore; fallback to CSV values */ })
    fetchDeputyGastosSummary(deputy.id)
      .then((payload) => { if (active) setGastosState({ deputyId: deputy.id, data: payload, error: null }) })
      .catch((cause: Error) => { if (active) setGastosState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchQuestionForDeputy('q7', deputy.id, 1, 5)
      .then((payload) => {
        if (!active) return
        const row =
          payload.table_spec.rows.find((item) => String(item.id_deputado ?? '') === deputy.id) ??
          payload.table_spec.rows[0]
        if (!row) {
          setQ7State({ deputyId: deputy.id, data: null, error: null })
          return
        }
        setQ7State({
          deputyId: deputy.id,
          data: {
            posicao: row.posicao === undefined || row.posicao === null ? null : numericValue(row.posicao),
            indice: numericValue(row.indice_custo_beneficio),
            gastoTotal: numericValue(row.gasto_total),
            totalProposicoes: numericValue(row.total_proposicoes),
            scoreTotal: numericValue(row.score_proposicoes_total),
            scoreAjustado: numericValue(row.score_proposicoes_ajustado),
            periodoLabel: String(row.periodo_label ?? 'Global'),
            anoParcial: Boolean(row.ano_parcial),
            totalProposicoesSubstantivas: numericValue(row.total_proposicoes_substantivas),
            totalProposicoesAprovadas: numericValue(row.total_proposicoes_aprovadas),
            elegivel: row.elegivel_ranking !== undefined ? (String(row.elegivel_ranking).toLowerCase() === 'true' || row.elegivel_ranking === true) : true,
            motivoInelegibilidade: row.motivo_inelegibilidade ? String(row.motivo_inelegibilidade) : null,
          },
          error: null,
        })
      })
      .catch((cause: Error) => {
        if (active) {
          setQ7State({ deputyId: deputy.id, data: null, error: cause.message })
        }
      })
    return () => { active = false }
  }, [deputy])

  // Merge: API values take priority over CSV catalog values
  const partido = identityEnrichment.partido ?? deputy?.partido
  const uf = identityEnrichment.uf ?? deputy?.uf

  if (loading && !catalog.length) return <LoadingSkeleton />

  if (error || !deputy) {
    const catalogError = Boolean(error)
    return (
      <main className="deputy-profile">
        <section className="deputy-profile__error-panel">
          <span className="deputy-profile__eyebrow">{catalogError ? 'Erro ao carregar perfil' : 'Deputado não encontrado'}</span>
          <h1>{catalogError ? 'O catálogo de deputados não pôde ser carregado.' : 'Não localizamos um deputado com este ID.'}</h1>
          <p>{catalogError ? 'Verifique a conexão e tente novamente.' : `O identificador ${id ?? 'informado'} não existe no catálogo atual.`}</p>
          <div className="deputy-profile__error-actions"><Link to="/" className="deputy-profile__action-link">Voltar para a home</Link></div>
          <DeputySearch placeholder="Buscar outro deputado..." compact className="deputy-profile__error-search" />
        </section>
      </main>
    )
  }

  return (
    <main className="deputy-profile">
      <section className="deputy-profile__hero">
        <div className="deputy-profile__hero-main">
          <div className="deputy-profile__avatar-frame"><DeputyAvatar id={deputy.id} nome={deputy.nome} size={152} /></div>
          <div className="deputy-profile__heading">
            <span className="deputy-profile__eyebrow">Perfil parlamentar</span>
            <h1>{deputy.nome}</h1>
            <p className="deputy-profile__civil-name">{optionalLabel(deputy.nomeCivil)}</p>
            <div className="deputy-profile__chips" aria-label="Identificação parlamentar">
              <span className="deputy-profile__chip"><strong>{optionalLabel(partido)}</strong></span>
              <span className="deputy-profile__chip">UF <strong>{optionalLabel(uf)}</strong></span>
              <span className="deputy-profile__chip">ID {deputy.id}</span>
            </div>
          </div>
        </div>
        <div className="deputy-profile__hero-aside">
          <ProfileField label="Escolaridade" value={optionalLabel(deputy.escolaridade)} />
          <ProfileField label="Legislaturas" value={formatLegislatura(deputy)} />
          <ProfileField label="Partido" value={optionalLabel(partido)} />
          <ProfileField label="Unidade federativa" value={optionalLabel(uf)} />
        </div>
      </section>

      <aside className="deputy-profile__context">
        Este perfil consolida informações individuais do parlamentar. Os painéis de bloco exibem análises gerais da legislatura.
      </aside>

      <section className="deputy-profile__section" aria-labelledby="resumo-heading">
        <SectionHeading eyebrow="Cadastro" title="Resumo rápido" description="Informações disponíveis no catálogo de deputados usado pelo projeto." />
        <div id="resumo-heading" className="deputy-profile__details-grid">
          <ProfileField label="Nome parlamentar" value={deputy.nome} />
          <ProfileField label="Nome civil" value={optionalLabel(deputy.nomeCivil)} />
          <ProfileField label="CPF" value={optionalLabel(deputy.cpf)} />
          <ProfileField label="ID do deputado" value={deputy.id} />
          <ProfileField label="Legislatura inicial" value={optionalLabel(deputy.legislaturaInicial)} />
          <ProfileField label="Legislatura final" value={optionalLabel(deputy.legislaturaFinal)} />
          <ProfileField label="Fonte cadastral" value={deputy.uriDeputado ? <a href={deputy.uriDeputado} target="_blank" rel="noreferrer">Dados Abertos da Câmara</a> : 'Não informada'} />
        </div>
      </section>

      <section className="deputy-profile__section" aria-labelledby="gastos-heading">
        <SectionHeading eyebrow="Despesas" title="Gastos parlamentares" description="Valores consolidados a partir das fontes analíticas disponíveis." />
        <div id="gastos-heading">
          <GastosSection
            data={gastosState.deputyId === deputy.id ? gastosState.data : null}
            loading={gastosState.deputyId !== deputy.id}
            error={gastosState.deputyId === deputy.id ? gastosState.error : null}
          />
        </div>
      </section>

      <section className="deputy-profile__future-grid" aria-label="Próximas dimensões do perfil">
        <article className="deputy-profile__placeholder">
          <span className="deputy-profile__eyebrow">Em preparação</span><h2>Produção legislativa</h2>
          <p>Esta área receberá proposições, temas e indicadores individuais quando os contratos de dados estiverem prontos.</p>
        </article>
        <article className="deputy-profile__placeholder">
          <span className="deputy-profile__eyebrow">Em preparação</span><h2>Votações</h2>
          <p>Esta área será enriquecida com histórico e posicionamentos do parlamentar, sem antecipar métricas ainda indisponíveis.</p>
        </article>
      </section>

      <section className="deputy-profile__section" aria-labelledby="custo-beneficio-heading">
        <SectionHeading
          eyebrow="Q7"
          title="Indice de custo-beneficio parlamentar"
          description="Producao legislativa ponderada por gasto, calculada segundo a metodologia atual da Q7."
        />
        <div id="custo-beneficio-heading">
          {q7State.deputyId !== deputy.id ? (
            <div className="deputy-profile__empty" role="status">Carregando indicador de custo-beneficio...</div>
          ) : q7State.error ? (
            <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
              <strong>Nao foi possivel carregar o indicador de custo-beneficio agora.</strong>
              <span>O restante do perfil continua disponivel.</span>
            </div>
          ) : q7State.data ? (
            <>
              {!q7State.data.elegivel && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#ef4444',
                  marginBottom: '16px',
                  lineHeight: '1.4'
                }}>
                  <strong>Inelegível para o Ranking Principal:</strong>
                  <div style={{ marginTop: '4px' }}>{q7State.data.motivoInelegibilidade}</div>
                </div>
              )}
              <div className="deputy-profile__metrics" aria-label="Indice de custo-beneficio">
                <ProfileField
                  label="Posicao no ranking global"
                  value={q7State.data.posicao ? `#${q7State.data.posicao}` : 'Nao disponivel'}
                />
                <ProfileField label="Indice" value={formatDecimal(q7State.data.indice, 5)} />
                <ProfileField label="Gasto total" value={formatCurrency(q7State.data.gastoTotal)} />
                <ProfileField
                  label="Proposicoes consideradas"
                  value={formatNumber(q7State.data.totalProposicoes)}
                />
              </div>

              <article className="deputy-profile__data-card">
                <h3>Leitura do indicador</h3>
                <div className="deputy-profile__details-grid">
                  <ProfileField label="Score total" value={formatDecimal(q7State.data.scoreTotal, 2)} />
                  <ProfileField label="Score ajustado" value={formatDecimal(q7State.data.scoreAjustado, 2)} />
                  <ProfileField
                    label="Periodo"
                    value={`${q7State.data.periodoLabel}${q7State.data.anoParcial ? ' (parcial)' : ''}`}
                  />
                  <ProfileField
                    label="Proposições substantivas"
                    value={formatNumber(q7State.data.totalProposicoesSubstantivas)}
                  />
                  <ProfileField
                    label="Proposições aprovadas"
                    value={formatNumber(q7State.data.totalProposicoesAprovadas)}
                  />
                </div>
              </article>
            </>
          ) : (
            <div className="deputy-profile__empty" role="status">
              <strong>Nao ha dados suficientes para calcular o indice deste deputado no periodo selecionado.</strong>
              <span>O card sera preenchido assim que a Q7 retornar esse parlamentar no recorte global.</span>
            </div>
          )}
        </div>
      </section>

      <section className="deputy-profile__section">
        <SectionHeading eyebrow="Visão ampla" title="Painéis gerais" description="Acesse os recortes consolidados da legislatura; estes links não aplicam filtro por deputado." />
        <div className="deputy-profile__actions">
          <Link to="/grupos/gastos" className="deputy-profile__action-link deputy-profile__action-link--primary">Abrir Painel de Gastos</Link>
          <Link to="/grupos/perfil" className="deputy-profile__action-link">Abrir Escolaridade e Perfil</Link>
          <Link to="/" className="deputy-profile__action-link">Voltar à página inicial</Link>
        </div>
      </section>
    </main>
  )
}
