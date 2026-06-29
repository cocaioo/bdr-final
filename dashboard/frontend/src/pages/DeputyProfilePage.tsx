import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchDeputies, fetchDeputyAlignmentScores, fetchDeputyGastosSummary, fetchDeputyIdentityFromGastos, fetchDeputyTemasNuvem, fetchQuestionForDeputy } from '../api'
import type { DeputyAlignmentScores } from '../api'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { DeputySearch } from '../components/DeputySearch'
import { DeputyTemaWordCloud } from '../components/DeputyTemaWordCloud'
import type { DeputyGastosProfile, DeputyIdentityEnrichment, DeputyOption, DeputyTemaItem } from '../types'
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

// Cortes derivados do min/max real de ideologia_score por ideologia_faixa em
// dados_padronizados/partidos_ideologia.csv (ponto medio entre o max de uma
// faixa e o min da proxima) — mais fiel aos dados reais do que dividir 0-10
// em 6 partes iguais.
function classifyScoreCalibrado(score: number): string {
  if (score < 1.6) return 'Extrema esquerda'
  if (score < 3.13) return 'Esquerda'
  if (score < 5.07) return 'Centro-esquerda'
  if (score < 7.19) return 'Centro-direita'
  if (score < 8.54) return 'Direita'
  return 'Extrema direita'
}

function numericValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

interface RatingInfo {
  label: string
  color: string
  bg: string
  border: string
  description: string
}

function getDeputyRating(posicao: number | null, elegivel: boolean): RatingInfo {
  if (!elegivel || posicao === null) {
    return {
      label: 'Não classificado',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
      border: '1px solid #94a3b8',
      description: 'Este deputado não atende aos requisitos mínimos de atividade parlamentar para integrar o ranking principal da Q7.'
    }
  }
  if (posicao <= 50) {
    return {
      label: 'Excelente custo-benefício',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid #10b981',
      description: 'Entre os 50 deputados mais eficientes (Top 10%). Excelente relação de produção legislativa ponderada por gasto.'
    }
  }
  if (posicao <= 150) {
    return {
      label: 'Bom custo-benefício',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid #3b82f6',
      description: 'Desempenho acima da média nacional (Top 30%). Boa eficiência legislativa em relação às despesas do mandato.'
    }
  }
  if (posicao <= 350) {
    return {
      label: 'Regular',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid #f59e0b',
      description: 'Atuação e despesas de mandato dentro da média esperada do parlamento brasileiro (Top 70%).'
    }
  }
  return {
    label: 'Abaixo da média',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    description: 'Baixa eficiência legislativa ou gasto de mandato elevado em relação ao volume de proposições substantivas (Bottom 30%).'
  }
}

interface DeputyGaugeProps {
  posicao: number | null
  elegivel: boolean
}

function DeputyGauge({ posicao, elegivel }: DeputyGaugeProps) {
  const cx = 100
  const cy = 90
  const r = 70
  const strokeWidth = 14

  const polarToCartesian = (x: number, y: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0
    return {
      x: x + radius * Math.cos(angleInRadians),
      y: y - radius * Math.sin(angleInRadians)
    }
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, startAngle)
    const end = polarToCartesian(x, y, radius, endAngle)
    const largeArcFlag = startAngle - endAngle <= 180 ? '0' : '1'
    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y
    ].join(' ')
  }

  let rotation = 0
  let hasNeedle = false

  if (elegivel && posicao !== null) {
    hasNeedle = true
    let angle = 90

    if (posicao <= 50) {
      // Green zone: 43 to 3 degrees (with gaps)
      // Map 1 to 10 deg, 50 to 40 deg
      const pct = (posicao - 1) / 49
      angle = 10 + pct * 30
    } else if (posicao <= 150) {
      // Blue zone: 87 to 47 degrees
      // Map 51 to 50 deg, 150 to 85 deg
      const pct = (posicao - 51) / 99
      angle = 50 + pct * 35
    } else if (posicao <= 350) {
      // Yellow zone: 133 to 93 degrees
      // Map 151 to 95 deg, 350 to 130 deg
      const pct = (posicao - 151) / 199
      angle = 95 + pct * 35
    } else {
      // Red zone: 177 to 137 degrees
      // Map 351 to 140 deg, 500+ to 170 deg
      const maxPos = Math.max(500, posicao)
      const pct = (posicao - 351) / (maxPos - 351)
      angle = 140 + pct * 30
    }

    rotation = 90 - angle
  }

  const redColor = elegivel ? '#ef4444' : '#cbd5e1'
  const yellowColor = elegivel ? '#f59e0b' : '#e2e8f0'
  const blueColor = elegivel ? '#3b82f6' : '#cbd5e1'
  const greenColor = elegivel ? '#10b981' : '#e2e8f0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '200px', flexShrink: 0 }}>
      <svg width="200" height="110" viewBox="0 0 200 110" style={{ overflow: 'visible' }}>
        {/* Gray background track */}
        <path
          d={describeArc(cx, cy, r, 180, 0)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ opacity: 0.3 }}
        />
        {/* Red segment (left: 177 to 137 deg) */}
        <path
          d={describeArc(cx, cy, r, 177, 137)}
          fill="none"
          stroke={redColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Yellow segment (133 to 93 deg) */}
        <path
          d={describeArc(cx, cy, r, 133, 93)}
          fill="none"
          stroke={yellowColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Blue segment (87 to 47 deg) */}
        <path
          d={describeArc(cx, cy, r, 87, 47)}
          fill="none"
          stroke={blueColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Green segment (right: 43 to 3 deg) */}
        <path
          d={describeArc(cx, cy, r, 43, 3)}
          fill="none"
          stroke={greenColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Labels */}
        <text x="18" y="105" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600" style={{ opacity: 0.8 }}>Pior</text>
        <text x="182" y="105" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600" style={{ opacity: 0.8 }}>Melhor</text>

        {/* Needle pointer */}
        {hasNeedle && (
          <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
            <path d="M -4.5,0 L 0,-56 L 4.5,0 Z" fill="#334155" />
            <circle cx="0" cy="0" r="7" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
            <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
          </g>
        )}
      </svg>
      {elegivel && posicao !== null && (
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', marginTop: '-4px', color: 'var(--muted)' }}>
          Posição: #{posicao}
        </span>
      )}
    </div>
  )
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
  totalProposicoesSubstantivas: number
  totalProposicoesAprovadas: number
  elegivel: boolean
  motivoInelegibilidade: string | null
}

function LoadingSkeleton() {
  return (
    <main className="deputy-profile" aria-busy="true">
      <section className="deputy-profile__hero deputy-profile__hero--loading">
        <div className="deputy-profile__loading-identity">
          <div className="skeleton deputy-profile__avatar-skeleton" />
          <div className="deputy-profile__loading-copy">
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 180px)', height: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 320px)', height: 28 }} />
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 240px)', height: 12 }} />
          </div>
        </div>
      </section>
    </main>
  )
}

function ProfileField({ label, value, helpText }: { label: string; value: React.ReactNode; helpText?: string }) {
  return (
    <div className="deputy-profile__fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {helpText && (
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--muted)',
            fontWeight: 'normal',
            marginTop: '4px',
            lineHeight: '1.3'
          }}
        >
          {helpText}
        </span>
      )}
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
          <ProfileField label="Despesas realizadas" value={formatCurrency(data.summary.valor_total)} />
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
  const [temasState, setTemasState] = useState<{
    deputyId?: string
    data: DeputyTemaItem[] | null
    error: string | null
  }>({ data: null, error: null })
  const [alignmentState, setAlignmentState] = useState<{
    deputyId?: string
    data: DeputyAlignmentScores | null
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
    setTemasState({ data: null, error: null })
    setAlignmentState({ data: null, error: null })
    fetchDeputyIdentityFromGastos(deputy.id)
      .then((enrichment) => { if (active) setIdentityEnrichment(enrichment) })
      .catch(() => { /* silently ignore; fallback to CSV values */ })
    fetchDeputyGastosSummary(deputy.id)
      .then((payload) => { if (active) setGastosState({ deputyId: deputy.id, data: payload, error: null }) })
      .catch((cause: Error) => { if (active) setGastosState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchDeputyTemasNuvem(deputy.id)
      .then((temas) => { if (active) setTemasState({ deputyId: deputy.id, data: temas, error: null }) })
      .catch((cause: Error) => { if (active) setTemasState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchDeputyAlignmentScores(deputy.id)
      .then((scores) => { if (active) setAlignmentState({ deputyId: deputy.id, data: scores, error: null }) })
      .catch((cause: Error) => { if (active) setAlignmentState({ deputyId: deputy.id, data: null, error: cause.message }) })
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
          <ProfileField
            label="Score ideológico"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.deputyScore !== null && alignmentState.data?.deputyScore !== undefined
                ? <span className="deputy-profile__score-tooltip" data-tooltip={`Valor do score: ${formatDecimal(alignmentState.data.deputyScore)}`}>{classifyScoreCalibrado(alignmentState.data.deputyScore)}</span>
                : 'Não disponível'
            }
          />
          <ProfileField
            label="Score ideológico do partido"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.partyScore !== null && alignmentState.data?.partyScore !== undefined && alignmentState.data?.partyFaixa
                ? <span className="deputy-profile__score-tooltip" data-tooltip={`Valor do score: ${formatDecimal(alignmentState.data.partyScore)}`}>{alignmentState.data.partyFaixa}</span>
                : 'Não disponível'
            }
          />
          <ProfileField
            label="Diferença de score ideológico (Deputado x Partido)"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.deviation !== null && alignmentState.data?.deviation !== undefined
                ? formatDecimal(alignmentState.data.deviation)
                : 'Não disponível'
            }
          />
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

      <section className="deputy-profile__section" aria-labelledby="temas-heading">
        <SectionHeading
          eyebrow="Proposições"
          title="Temas mais trabalhados"
          description="Quantidade de proposições de autoria do deputado por tema legislativo. Temas sem proposições não aparecem na nuvem."
        />
        <div id="temas-heading">
          {temasState.deputyId !== deputy.id ? (
            <div className="deputy-profile__empty" role="status">Carregando temas legislativos…</div>
          ) : temasState.error ? (
            <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
              <strong>Não foi possível carregar os temas agora.</strong>
              <span>O restante do perfil permanece disponível.</span>
            </div>
          ) : temasState.data && temasState.data.length ? (
            <DeputyTemaWordCloud temas={temasState.data} />
          ) : (
            <div className="deputy-profile__empty" role="status">
              <strong>Nenhuma proposição com tema identificado para este deputado.</strong>
              <span>O perfil cadastral e os demais indicadores continuam disponíveis.</span>
            </div>
          )}
        </div>
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
            (() => {
              const rating = getDeputyRating(q7State.data.posicao, q7State.data.elegivel);
              return (
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
                    <ProfileField
                      label="Indice"
                      value={<span style={{ color: rating.color, fontSize: '2.2rem', display: 'inline-block', lineHeight: '1.2' }}>{formatDecimal(q7State.data.indice, 5)}</span>}
                    />
                    <ProfileField
                      label="Despesa considerada no índice"
                      value={formatCurrency(q7State.data.gastoTotal)}
                    />
                    <ProfileField
                      label="Proposicoes consideradas"
                      value={formatNumber(q7State.data.totalProposicoes)}
                    />
                  </div>

                  <article className="deputy-profile__data-card">
                    <h3 style={{ margin: '0 0 16px 0' }}>Leitura do indicador</h3>
                    
                    <div style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '24px',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      padding: '12px 0',
                      marginBottom: '16px'
                    }}>
                      <DeputyGauge posicao={q7State.data.posicao} elegivel={q7State.data.elegivel} />
                      
                      <div style={{ flex: '1', minWidth: '200px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <span
                            className="deputy-rating-badge"
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: rating.bg,
                              color: rating.color,
                              border: rating.border,
                              fontSize: '0.82rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            {rating.label}
                          </span>
                        </div>
                        {rating.description && (
                          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0, lineHeight: '1.4' }}>
                            {rating.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="deputy-profile__details-grid">
                      <ProfileField
                        label="Score total"
                        value={formatDecimal(q7State.data.scoreTotal, 2)}
                        helpText="Soma de pontos das proposições de autoria do deputado, ponderados por tipo, status e posição de autoria."
                      />
                      <ProfileField
                        label="Score ajustado"
                        value={formatDecimal(q7State.data.scoreAjustado, 2)}
                        helpText="Score total suavizado por potência (0.75) para evitar distorções de alto volume de projetos simples."
                      />
                      <ProfileField
                        label="Periodo"
                        value={`${q7State.data.periodoLabel}${q7State.data.anoParcial ? ' (parcial)' : ''}`}
                      />
                      <ProfileField
                        label="Proposições substantivas"
                        value={formatNumber(q7State.data.totalProposicoesSubstantivas)}
                        helpText="Proposições com relevância ou impacto legislativo concreto (como PECs, PLs, e PLPs), conforme metodologia."
                      />
                      <ProfileField
                        label="Proposições aprovadas"
                        value={formatNumber(q7State.data.totalProposicoesAprovadas)}
                        helpText="Proposições de autoria do deputado que foram aprovadas ou transformadas em lei no período."
                      />
                    </div>
                  </article>
                </>
              );
            })()
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
