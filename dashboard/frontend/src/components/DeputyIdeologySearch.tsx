import { useMemo, useRef, useState } from 'react'

import { IdeologyBadge } from './IdeologyBadge'
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

  return (
    <div className="dep-search">
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
      </div>

      {/* Dropdown com posicionamento absoluto em relacao a .dep-search */}
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
                <span className="dep-search__option-name">{d.name}</span>
                <span className="dep-search__option-meta">
                  {d.party}
                  <IdeologyBadge range={d.partyBand} compact />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Deputy profile card */}
      {selected && (
        <div className="dep-search__card">
          <div className="dep-search__card-header">
            <div>
              <h4 className="dep-search__card-name">{selected.name}</h4>
              <p className="dep-search__card-meta">
                {selected.party}
                <IdeologyBadge range={selected.partyBand} />
              </p>
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
        </div>
      )}
    </div>
  )
}
