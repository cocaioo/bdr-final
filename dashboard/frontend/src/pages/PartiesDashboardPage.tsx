import { useEffect, useMemo, useState } from 'react'

import { fetchQuestion } from '../api'
import { ExecutiveCards } from '../components/ExecutiveCards'
import { IdeologyBarChart, type IdeologyBar } from '../components/IdeologyBarChart'
import { IdeologyLegend } from '../components/IdeologyLegend'
import { IdeologySpectrum } from '../components/IdeologySpectrum'
import { NoDataState } from '../components/NoDataState'
import { PartyAlignmentRanking } from '../components/PartyAlignmentRanking'
import { PartyRankingTabs, type Q11Tables } from '../components/PartyRankingTabs'
import { IDEOLOGY_RANGES, rangeLabel, toNumber, toSpectrumParties } from '../utils/ideology'
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

  const [q9, setQ9] = useState<QuestionPayload | null>(null)
  const [q10, setQ10] = useState<QuestionPayload | null>(null)
  const [q11, setQ11] = useState<QuestionPayload | null>(null)
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
    ])
      .then(([a, b, c]) => {
        if (!active) return
        setQ9(a)
        setQ10(b)
        setQ11(c)
      })
      .catch((cause: Error) => active && setError(cause.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [q9Meta, q10Meta, q11Meta])

  // --- Secao 1: espectro ---
  const spectrum = useMemo(() => (q9 ? toSpectrumParties(q9.table_spec.rows) : []), [q9])
  const rangeCounts = useMemo(() => countByRange(spectrum), [spectrum])

  // --- Secao 2: distribuicao ---
  const distributionBars = useMemo<IdeologyBar[]>(
    () =>
      IDEOLOGY_RANGES.map((r) => ({
        label: r.label,
        value: rangeCounts[r.label] ?? 0,
        color: r.color,
      })),
    [rangeCounts],
  )

  // --- Secao 4: rankings (Q11) ---
  const q11Tables = useMemo<Q11Tables | null>(() => {
    if (!q11) return null
    return {
      voting: (findTable(q11, 'frequência')?.rows ?? findTable(q11, 'frequencia')?.rows ?? q11.table_spec.rows) as Row[],
      bills: (findTable(q11, 'proposi')?.rows ?? []) as Row[],
      spending: (findTable(q11, 'gasto')?.rows ?? []) as Row[],
    }
  }, [q11])

  // --- Cards de resumo ---
  const cards = useMemo<SummaryCard[]>(() => {
    const classified = spectrum.length
    const rangesCovered = IDEOLOGY_RANGES.filter((r) => (rangeCounts[r.label] ?? 0) > 0).length
    const votesAnalysed = q11
      ? (findTable(q11, 'frequência')?.rows ?? q11.table_spec.rows).reduce(
          (sum: number, row: Row) => sum + toNumber(row.total_votos_registrados),
          0,
        )
      : 0
    const topAlign =
      q10 && q10.table_spec.rows.length
        ? [...q10.table_spec.rows].sort((a, b) => toNumber(b.pct_alinhamento) - toNumber(a.pct_alinhamento))[0]
        : null
    return [
      { id: 'classified', label: 'Partidos classificados', value: String(classified) },
      { id: 'spectrum', label: 'Faixas do espectro cobertas', value: `${rangesCovered}`, unit: `de ${IDEOLOGY_RANGES.length}` },
      {
        id: 'votes',
        label: 'Votos analisados',
        value: votesAnalysed >= 1000 ? `${(votesAnalysed / 1000).toFixed(0)} mil` : String(votesAnalysed),
      },
      {
        id: 'alignment',
        label: 'Maior alinhamento partidário',
        value: topAlign ? `${toNumber(topAlign.pct_alinhamento).toFixed(1)}%` : '—',
        unit: topAlign ? String(topAlign.sigla_partido) : undefined,
      },
    ]
  }, [spectrum, rangeCounts, q10, q11])

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

  return (
    <main className="parties-dashboard">
      {/* Header */}
      <section className="parties-hero stagger-item">
        <span className="parties-eyebrow">Visão integrada</span>
        <h1>Partidos, Ideologia e Votação</h1>
        <p>
          Este painel reúne, em uma única experiência, a classificação ideológica dos partidos, o
          alinhamento às orientações partidárias e os rankings de atuação parlamentar.
        </p>
      </section>

      <ExecutiveCards cards={cards} />

      {/* Secao 1 — Espectro ideologico */}
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

      {/* Secao 2 — Distribuicao */}
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

      {/* Secao 3 — Alinhamento partidario */}
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

      {/* Secao 4 — Rankings */}
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
    </main>
  )
}
