import { useMemo, useRef, useState } from 'react'

import { IdeologyBadge } from './IdeologyBadge'
import { DeputyAvatar } from './DeputyAvatar'
import { IDEOLOGY_SCORE_MIN, IDEOLOGY_SCORE_MAX, rangeColor } from '../utils/ideology'
import type { RevealedDeputy } from '../utils/q14'

interface DeputyIdeologySearchProps {
  deputies: RevealedDeputy[]
}

/** Normaliza string para busca insensível a acento e case. */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Barra mini que mostra posição do partido e do deputado no espectro 0-10. */
function MiniSpectrum({
  partyScore,
  deputyScore,
  partyColor,
}: {
  partyScore: number
  deputyScore: number
  partyColor: string
}) {
  const RANGE = IDEOLOGY_SCORE_MAX - IDEOLOGY_SCORE_MIN
  const partyPct = ((partyScore - IDEOLOGY_SCORE_MIN) / RANGE) * 100
  const deputyPct = ((deputyScore - IDEOLOGY_SCORE_MIN) / RANGE) * 100

  return (
    <div className="dep-search__spectrum" aria-hidden="true">
      {/* Trilha de gradiente esquerda-direita */}
      <div className="dep-search__track" />

      {/* Marcador do partido */}
      <div
        className="dep-search__marker dep-search__marker--party"
        style={{ left: `${partyPct}%`, borderColor: partyColor }}
        title={`Partido: ${partyScore.toFixed(2)}`}
      />

      {/* Marcador do deputado */}
      <div
        className="dep-search__marker dep-search__marker--deputy"
        style={{ left: `${deputyPct}%`, background: partyColor }}
        title={`Deputado: ${deputyScore.toFixed(2)}`}
      />

      {/* Seta de desvio entre partido e deputado */}
      {Math.abs(partyPct - deputyPct) > 1 && (
        <div
          className="dep-search__deviation-line"
          style={{
            left: `${Math.min(partyPct, deputyPct)}%`,
            width: `${Math.abs(partyPct - deputyPct)}%`,
            borderColor: partyColor,
          }}
        />
      )}

      {/* Labels dos extremos */}
      <div className="dep-search__track-labels">
        <span>0 Esq.</span>
        <span>5 Centro</span>
        <span>10 Dir.</span>
      </div>
    </div>
  )
}

export function DeputyIdeologySearch({ deputies }: DeputyIdeologySearchProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<RevealedDeputy | null>(null)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = normalize(query.trim())
    if (q.length < 2) return []
    return deputies
      .filter((d) => normalize(d.name).includes(q) || normalize(d.party).includes(q))
      .slice(0, 8)
  }, [query, deputies])

  function pick(deputy: RevealedDeputy) {
    setSelected(deputy)
    setQuery(deputy.name)
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const deviation = selected?.partyDeviation ?? 0
  const deviationDir = selected?.partyDeviationDirection ?? 'alinhado'
  const partyColor = selected ? rangeColor(selected.partyBand) : '#8a9ba8'

  const profile = useMemo(() => {
    if (!selected) return null
    const name = selected.name
    const party = selected.party
    const absPartyDev = Math.abs(selected.partyDeviation)
    const absCaucusDev = Math.abs(selected.caucusDeviation)
    const formattedPartyDev = `${selected.partyDeviation > 0 ? '+' : ''}${selected.partyDeviation.toFixed(2)}`
    const formattedCaucusDev = `${selected.caucusDeviation > 0 ? '+' : ''}${selected.caucusDeviation.toFixed(2)}`

    if (absPartyDev > 1.5 && absCaucusDev < 0.3) {
      return {
        id: 'label_divergence',
        label: 'Divergência de Rótulo',
        color: '#468bc7',
        bg: 'rgba(70, 139, 199, 0.1)',
        description: (
          <span>
            <strong>Interpretação:</strong> Embora <strong>{name}</strong> vote de forma diferente do rótulo ideológico oficial do partido (desvio de {formattedPartyDev}), ele(a) vota em forte sintonia com os colegas do <strong>{party}</strong> em plenário (desvio de apenas {formattedCaucusDev}). Isso reflete que a bancada inteira do {party} tem votado deslocada da sua ideologia teórica.
          </span>
        )
      }
    }

    if (absPartyDev > 1.5 && absCaucusDev >= 0.5) {
      return {
        id: 'outlier',
        label: 'Outlier de Bancada',
        color: '#cf673f',
        bg: 'rgba(207, 103, 63, 0.1)',
        description: (
          <span>
            <strong>Interpretação:</strong> <strong>{name}</strong> demonstra atuação independente: afasta-se significativamente tanto do rótulo teórico do partido (desvio de {formattedPartyDev}) quanto do comportamento médio de voto dos colegas do <strong>{party}</strong> (desvio da bancada de {formattedCaucusDev}).
          </span>
        )
      }
    }

    if (absPartyDev <= 0.5 && absCaucusDev < 0.3) {
      return {
        id: 'aligned',
        label: 'Fiel à Doutrina',
        color: 'var(--ok, #22c55e)',
        bg: 'rgba(34, 197, 94, 0.1)',
        description: (
          <span>
            <strong>Interpretação:</strong> <strong>{name}</strong> está altamente alinhado(a): mantém votos muito próximos tanto do rótulo ideológico teórico do partido (desvio de {formattedPartyDev}) quanto da média da bancada do <strong>{party}</strong> (desvio de {formattedCaucusDev}).
          </span>
        )
      }
    }

    return {
      id: 'standard',
      label: 'Alinhamento Padrão',
      color: 'var(--muted, #8a9ba8)',
      bg: 'rgba(138, 155, 168, 0.1)',
      description: (
        <span>
          <strong>Interpretação:</strong> O <em>desvio ideológico</em> ({formattedPartyDev}) mede a distância para o rótulo oficial do partido. O <em>desvio da bancada</em> ({formattedCaucusDev}) mede a distância para a média real de voto da bancada do <strong>{party}</strong> em plenário.
        </span>
      )
    }
  }, [selected])

  return (
    <div className="dep-search">
      {/* Banner de Contexto Analitico */}
      <div className="dep-search__info-banner">
        <p>
          🎯 <strong>Dica de análise:</strong> Esta pesquisa contrasta a ideologia oficial do partido contra o comportamento real de voto do parlamentar. Você encontrará dois tipos marcantes de comportamento nos dados:
        </p>
        <ul>
          <li>
            <strong>Divergência de Rótulo Partidário:</strong> Deputados (como os do <strong>PSOL</strong>, <strong>PT</strong> ou <strong>UNIÃO</strong>) que votam muito próximos à sua bancada, mas distantes do rótulo teórico do partido. Isso indica que a bancada inteira atua em plenário de forma deslocada de sua classificação acadêmica.
          </li>
          <li>
            <strong>Outliers de Bancada (Desalinhamento Real):</strong> Deputados que de fato votam de forma muito diferente dos seus próprios colegas de partido (ex: <strong>João Carlos Bacelar</strong> no PL, ou <strong>Daniel José</strong> e <strong>Delegado Palumbo</strong> no Podemos).
          </li>
        </ul>
      </div>

      {/* Search input */}
      <div className="dep-search__input-wrap">
        <input
          ref={inputRef}
          className="dep-search__input"
          type="text"
          placeholder="Buscar deputado por nome ou partido…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (!e.target.value) setSelected(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Buscar deputado"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
        />
        {query && (
          <button
            type="button"
            className="dep-search__clear"
            onClick={clear}
            aria-label="Limpar busca"
          >
            ×
          </button>
        )}

        {/* Dropdown com posicionamento absoluto em relacao a .dep-search__input-wrap */}
        {open && suggestions.length > 0 && (
          <ul
            className="dep-search__dropdown"
            role="listbox"
            style={{ zIndex: 1001 }}
          >
            {suggestions.map((d) => (
              <li key={d.deputyId || d.name} role="option" aria-selected={selected?.deputyId === d.deputyId}>
                <button
                  type="button"
                  className="dep-search__option"
                  onMouseDown={() => pick(d)}
                >
                  <DeputyAvatar id={d.deputyId} nome={d.name} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="dep-search__option-name">{d.name}</span>
                    <span className="dep-search__option-meta">
                      {d.party}
                      <IdeologyBadge range={d.partyBand} compact />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Deputy profile card */}
      {selected && (
        <div className="dep-search__card">
          <div className="dep-search__card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <DeputyAvatar id={selected.deputyId} nome={selected.name} size={48} />
              <div>
                <h4 className="dep-search__card-name">{selected.name}</h4>
                <div className="dep-search__card-meta">
                  <span>{selected.party}</span>
                  <IdeologyBadge range={selected.partyBand} />
                  {profile && (
                    <span
                      className="dep-search__profile-badge"
                      style={{
                        borderColor: profile.color,
                        color: profile.color,
                        backgroundColor: profile.bg,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: '1px solid',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      {profile.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button type="button" className="dep-search__card-close" onClick={clear} aria-label="Fechar">×</button>
          </div>

          {/* Mini spectrum bar */}
          <MiniSpectrum
            partyScore={selected.partyScore}
            deputyScore={selected.calibratedScore}
            partyColor={partyColor}
          />

          {/* Stats grid */}
          <div className="dep-search__stats">
            <div className="dep-search__stat">
              <span>Score do partido</span>
              <strong style={{ color: partyColor }}>{selected.partyScore.toFixed(2)}</strong>
            </div>
            <div className="dep-search__stat">
              <span>Score comportamental</span>
              <strong>{selected.calibratedScore.toFixed(2)}</strong>
            </div>
            <div className="dep-search__stat">
              <span>Desvio ideológico</span>
              <strong
                style={{
                  color: deviationDir === 'mais a direita' ? '#cf673f'
                    : deviationDir === 'mais a esquerda' ? '#468bc7'
                    : 'var(--ok, #22c55e)',
                }}
              >
                {deviation > 0 ? '+' : ''}{deviation.toFixed(2)}
              </strong>
            </div>
            <div className="dep-search__stat">
              <span>Direção do desvio</span>
              <strong>
                {deviationDir === 'mais a direita' ? '→ Direita'
                  : deviationDir === 'mais a esquerda' ? '← Esquerda'
                  : '≈ Alinhado'}
              </strong>
            </div>
            <div className="dep-search__stat">
              <span>Desvio da bancada</span>
              <strong>{selected.caucusDeviation > 0 ? '+' : ''}{selected.caucusDeviation.toFixed(2)}</strong>
            </div>
            <div className="dep-search__stat">
              <span>Votos válidos</span>
              <strong>{selected.validVotes.toLocaleString('pt-BR')}</strong>
            </div>
          </div>

          {/* Legenda Inteligente Contextual */}
          {profile && (
            <div className="dep-search__explanation">
              <span className="dep-search__explanation-icon">💡</span>
              <p>{profile.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
