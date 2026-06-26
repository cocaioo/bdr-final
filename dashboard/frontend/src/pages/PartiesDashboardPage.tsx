import { useEffect, useMemo, useState } from 'react'

import { fetchAllQuestionRows, fetchQuestion } from '../api'
import { CaucusCohesionChart } from '../components/CaucusCohesionChart'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { IdeologyBarChart, type IdeologyBar } from '../components/IdeologyBarChart'
import { IdeologyLegend } from '../components/IdeologyLegend'
import { IdeologySpectrum } from '../components/IdeologySpectrum'
import { MethodologyCard } from '../components/MethodologyCard'
import { NoDataState } from '../components/NoDataState'
import { OutlierDeputiesRanking } from '../components/OutlierDeputiesRanking'
import { PartyAlignmentRanking } from '../components/PartyAlignmentRanking'
import { PartyRankingTabs, type Q11Tables } from '../components/PartyRankingTabs'
import { RevealedDeputiesTable } from '../components/RevealedDeputiesTable'
import { RevealedPositionScatter } from '../components/RevealedPositionScatter'
import { IDEOLOGY_RANGES, rangeLabel, toNumber, toSpectrumParties } from '../utils/ideology'
import { averageCaucusCohesion, behavioralPartyCorrelation, parseQ14, type Q14Data } from '../utils/q14'
import type { FilterState, MetaResponse, QuestionPayload, SummaryCard, TableSpec } from '../types'

interface PartiesDashboardPageProps {
  meta: MetaResponse
}

const EMPTY_FILTERS: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

const TABLE_STATE = { page: 1, pageSize: 500, sortDir: 'desc' as const }
const Q14_TABLE_STATE = { page: 1, pageSize: 200, sortDir: 'desc' as const }

type Row = Record<string, unknown>

/** Localiza uma tabela complementar pelo trecho do titulo. */
function findTable(payload: QuestionPayload, fragment: string): TableSpec | undefined {
  const lower = fragment.toLowerCase()
  if (payload.table_spec.title.toLowerCase().includes(lower)) return payload.table_spec
  return payload.complement_tables.find((t) => t.title.toLowerCase().includes(lower))
}

/** Conta partidos por faixa, garantindo todas as faixas (inclusive vazias). */
function countByRange(parties: Array<{ faixa: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  IDEOLOGY_RANGES.forEach((r) => {
    counts[r.label] = 0
  })
  parties.forEach((p) => {
    const label = rangeLabel(p.faixa)
    counts[label] = (counts[label] ?? 0) + 1
  })
  return counts
}

export function PartiesDashboardPage({ meta }: PartiesDashboardPageProps) {
  const q9Meta = meta.questions.find((q) => q.id === 'q9')
  const q10Meta = meta.questions.find((q) => q.id === 'q10')
  const q11Meta = meta.questions.find((q) => q.id === 'q11')
  const q14Meta = meta.questions.find((q) => q.id === 'q14')

  const [q9, setQ9] = useState<QuestionPayload | null>(null)
  const [q10, setQ10] = useState<QuestionPayload | null>(null)
  const [q11, setQ11] = useState<QuestionPayload | null>(null)
  const [q14, setQ14] = useState<Q14Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q9Meta || !q10Meta || !q11Meta) {
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    Promise.all([
      fetchQuestion('q9', EMPTY_FILTERS, TABLE_STATE, q9Meta.supported_filters),
      fetchQuestion('q10', EMPTY_FILTERS, TABLE_STATE, q10Meta.supported_filters),
      fetchQuestion('q11', EMPTY_FILTERS, TABLE_STATE, q11Meta.supported_filters),
      // Q14 e opcional. O backend limita page_size (~200), entao paginamos para
      // trazer todos os ~634 deputados; caso contrario o grafico so veria os 200
      // primeiros (ordenados por desvio), colapsando para uma unica direcao.
      q14Meta
        ? fetchAllQuestionRows('q14', EMPTY_FILTERS, Q14_TABLE_STATE, q14Meta.supported_filters).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([a, b, c, d]) => {
        if (!active) return
        setQ9(a)
        setQ10(b)
        setQ11(c)
        setQ14(parseQ14(d))
      })
      .catch((cause: Error) => active && setError(cause.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [q9Meta, q10Meta, q11Meta, q14Meta])

  // --- Secao 2: espectro ---
  const spectrum = useMemo(() => (q9 ? toSpectrumParties(q9.table_spec.rows) : []), [q9])
  const rangeCounts = useMemo(() => countByRange(spectrum), [spectrum])

  // --- Secao 3: distribuicao ---
  const distributionBars = useMemo<IdeologyBar[]>(
    () =>
      IDEOLOGY_RANGES.map((r) => ({
        label: r.label,
        value: rangeCounts[r.label] ?? 0,
        color: r.color,
      })),
    [rangeCounts],
  )

  // --- Secao 5: rankings (Q11) ---
  const q11Tables = useMemo<Q11Tables | null>(() => {
    if (!q11) return null
    return {
      voting: (findTable(q11, 'frequência')?.rows ?? findTable(q11, 'frequencia')?.rows ?? q11.table_spec.rows) as Row[],
      bills: (findTable(q11, 'proposi')?.rows ?? []) as Row[],
      spending: (findTable(q11, 'gasto')?.rows ?? []) as Row[],
    }
  }, [q11])

  // --- Secao 1: resumo executivo ---
  const cards = useMemo<SummaryCard[]>(() => {
    const partiesAnalysed = spectrum.length
    const votesAnalysed = q11
      ? (findTable(q11, 'frequência')?.rows ?? q11.table_spec.rows).reduce(
          (sum: number, row: Row) => sum + toNumber(row.total_votos_registrados),
          0,
        )
      : 0
    const deputiesAnalysed = q14 ? q14.deputies.length : 0
    const correlation = q14 ? behavioralPartyCorrelation(q14.deputies) : null
    const avgCohesion = q14 ? averageCaucusCohesion(q14.cohesion) : null

    const formatThousands = (value: number) =>
      value >= 1000 ? `${(value / 1000).toFixed(0)} mil` : String(value)

    const cardsList: SummaryCard[] = [
      { id: 'parties', label: 'Partidos analisados', value: String(partiesAnalysed) },
      {
        id: 'deputies',
        label: 'Deputados analisados',
        value: deputiesAnalysed ? deputiesAnalysed.toLocaleString('pt-BR') : '—',
      },
      { id: 'votes', label: 'Votos analisados', value: formatThousands(votesAnalysed) },
      {
        id: 'correlation',
        label: 'Correlação ideologia × comportamento',
        value: correlation === null ? '—' : correlation.toFixed(2),
        unit: correlation === null ? undefined : 'Pearson r',
      },
      {
        id: 'cohesion',
        label: 'Coesão média das bancadas',
        value: avgCohesion === null ? '—' : avgCohesion.toFixed(1),
        unit: avgCohesion === null ? undefined : 'de 10',
      },
    ]

    return cardsList
  }, [spectrum, q11, q14])

  if (!q9Meta || !q10Meta || !q11Meta) {
    return (
      <main className="parties-dashboard">
        <NoDataState message="Os dados de partidos, ideologia e votação não estão disponíveis." />
      </main>
    )
  }

  if (loading && !q9) {
    return (
      <main className="parties-dashboard">
        <p className="loading">Carregando o painel de partidos, ideologia e votação...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="parties-dashboard">
        <NoDataState message={`Falha ao carregar o painel: ${error}`} />
      </main>
    )
  }

  const hasRevealed = Boolean(q14 && q14.deputies.length)

  return (
    <main className="parties-dashboard">
      {/* Header */}
      <section className="parties-hero stagger-item">
        <span className="parties-eyebrow">Visão integrada</span>
        <h1>Partidos, Ideologia e Votação</h1>
        <p>
          Este painel reúne, em uma única experiência, a classificação ideológica dos partidos, o
          alinhamento às orientações partidárias, os rankings de atuação parlamentar e a posição
          ideológica revelada pelo comportamento de voto dos deputados.
        </p>
      </section>

      {/* Secao 1 — Resumo executivo */}
      <ExecutiveCards cards={cards} />

      {/* Secao 2 — Espectro ideologico */}
      <section className="parties-section stagger-item">
        <div className="parties-section__head">
          <span aria-hidden="true">01</span>
          <div>
            <h2>Espectro ideológico</h2>
            <p>Onde cada partido se posiciona no eixo de 0 (esquerda) a 10 (direita).</p>
          </div>
        </div>
        <IdeologyLegend counts={rangeCounts} />
        {spectrum.length ? (
          <IdeologySpectrum parties={spectrum} />
        ) : (
          <NoDataState message="Sem classificação ideológica disponível." />
        )}
      </section>

      {/* Secao 3 — Distribuicao */}
      <section className="parties-section stagger-item">
        <div className="parties-section__head">
          <span aria-hidden="true">02</span>
          <div>
            <h2>Distribuição ideológica</h2>
            <p>Quantos partidos há em cada faixa do espectro.</p>
          </div>
        </div>
        <IdeologyBarChart bars={distributionBars} orientation="vertical" height={300} />
      </section>

      {/* Secao 4 — Alinhamento partidario */}
      <section className="parties-section stagger-item">
        <div className="parties-section__head">
          <span aria-hidden="true">03</span>
          <div>
            <h2>Alinhamento partidário</h2>
            <p>Quanto cada partido consegue que seus deputados sigam a orientação oficial.</p>
          </div>
        </div>
        {q10 && q10.table_spec.rows.length ? (
          <PartyAlignmentRanking rows={q10.table_spec.rows} />
        ) : (
          <NoDataState message="Sem dados de alinhamento disponíveis." />
        )}
      </section>

      {/* Secao 5 — Rankings */}
      <section className="parties-section stagger-item">
        <div className="parties-section__head">
          <span aria-hidden="true">04</span>
          <div>
            <h2>Rankings partidários</h2>
            <p>Compare os partidos por votações, proposições, gastos e um score composto.</p>
          </div>
        </div>
        {q11Tables ? (
          <PartyRankingTabs tables={q11Tables} />
        ) : (
          <NoDataState message="Sem dados de ranking disponíveis." />
        )}
      </section>

      {/* Secao 6 — Posicao revelada (Q14) */}
      <section className="parties-section stagger-item">
        <div className="parties-section__head">
          <span aria-hidden="true">05</span>
          <div>
            <h2>Posição ideológica revelada</h2>
            <p>
              Comparação entre a ideologia atribuída ao partido (Bolognesi) e o comportamento de voto
              calibrado de cada deputado (W-NOMINATE).
            </p>
          </div>
        </div>
        {hasRevealed ? (
          <RevealedPositionScatter deputies={q14!.deputies} />
        ) : (
          <NoDataState message="Sem dados de posição revelada disponíveis." />
        )}
      </section>

      {/* Secao 7 — Deputados fora da curva (Q14) */}
      {hasRevealed ? (
        <section className="parties-section stagger-item">
          <div className="parties-section__head">
            <span aria-hidden="true">06</span>
            <div>
              <h2>Deputados fora da curva do partido</h2>
              <p>Parlamentares cujo comportamento de voto mais se afasta da posição do próprio partido.</p>
            </div>
          </div>
          <OutlierDeputiesRanking toRight={q14!.outliersRight} toLeft={q14!.outliersLeft} />
        </section>
      ) : null}

      {/* Secao 8 — Coesao das bancadas (Q14) */}
      {hasRevealed && q14!.cohesion.length ? (
        <section className="parties-section stagger-item">
          <div className="parties-section__head">
            <span aria-hidden="true">07</span>
            <div>
              <h2>Coesão das bancadas</h2>
              <p>Da bancada mais coesa à menos coesa, segundo a uniformidade do comportamento de voto.</p>
            </div>
          </div>
          <CaucusCohesionChart cohesion={q14!.cohesion} />
        </section>
      ) : null}

      {/* Secao 9 — Tabela completa (colapsavel) */}
      {hasRevealed ? (
        <section className="parties-section stagger-item">
          <div className="parties-section__head">
            <span aria-hidden="true">08</span>
            <div>
              <h2>Tabela completa</h2>
              <p>Todos os deputados com posição revelada. Recolhida por padrão para manter a leitura limpa.</p>
            </div>
          </div>
          <RevealedDeputiesTable deputies={q14!.deputies} />
        </section>
      ) : null}

      {/* Secao 10 — Metodologia (sempre por ultimo) */}
      {q14 && q14.methodology ? (
        <section className="parties-section stagger-item">
          <div className="parties-section__head">
            <span aria-hidden="true">09</span>
            <div>
              <h2>Metodologia e fontes</h2>
              <p>Como a posição ideológica revelada é estimada e calibrada.</p>
            </div>
          </div>
          <MethodologyCard methodology={q14.methodology} />
        </section>
      ) : null}
    </main>
  )
}
