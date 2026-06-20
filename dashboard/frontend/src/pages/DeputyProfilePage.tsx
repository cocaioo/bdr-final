import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchDeputies, fetchDeputyGastosSummary, fetchDeputyIdentityFromGastos } from '../api'
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
          <ProfileField label="Ticket médio" value={formatCurrency(data.summary.ticket_medio)} />
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
    fetchDeputyIdentityFromGastos(deputy.id)
      .then((enrichment) => { if (active) setIdentityEnrichment(enrichment) })
      .catch(() => { /* silently ignore; fallback to CSV values */ })
    fetchDeputyGastosSummary(deputy.id)
      .then((payload) => { if (active) setGastosState({ deputyId: deputy.id, data: payload, error: null }) })
      .catch((cause: Error) => { if (active) setGastosState({ deputyId: deputy.id, data: null, error: cause.message }) })
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
