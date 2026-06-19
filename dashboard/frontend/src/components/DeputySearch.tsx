import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fetchDeputies } from '../api'
import { DeputyAvatar } from './DeputyAvatar'
import type { DeputyOption } from '../types'

interface DeputySearchProps {
  placeholder?: string
  compact?: boolean
  className?: string
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function optionalLabel(value?: string): string {
  return value && value.trim() ? value : 'Nao informado'
}

function formatLegislatura(deputy: DeputyOption): string {
  if (!deputy.legislaturaInicial && !deputy.legislaturaFinal) return 'Nao informada'
  if (deputy.legislaturaInicial && deputy.legislaturaFinal && deputy.legislaturaInicial === deputy.legislaturaFinal) {
    return `${deputy.legislaturaInicial}a Legislatura`
  }
  if (deputy.legislaturaInicial && deputy.legislaturaFinal) {
    return `${deputy.legislaturaInicial}a a ${deputy.legislaturaFinal}a Legislaturas`
  }
  return `${deputy.legislaturaInicial ?? deputy.legislaturaFinal}a Legislatura`
}

function buildSecondaryLine(deputy: DeputyOption): string {
  const parts = [optionalLabel(deputy.escolaridade)]
  const hasCivil = Boolean(deputy.nomeCivil && deputy.nomeCivil.trim())
  const hasLegislatura = Boolean(deputy.legislaturaInicial || deputy.legislaturaFinal)

  if (hasCivil) parts.push(String(deputy.nomeCivil).trim())
  if (hasLegislatura) parts.push(formatLegislatura(deputy))

  return parts.filter(Boolean).join(' | ')
}

export function DeputySearch({ placeholder = 'Pesquisar deputado...', compact = false, className = '' }: DeputySearchProps) {
  const navigate = useNavigate()
  const blurTimerRef = useRef<number | null>(null)
  const [catalog, setCatalog] = useState<DeputyOption[]>([])
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchDeputies()
      .then((items) => {
        if (!active) return
        setCatalog(items)
      })
      .catch((cause: Error) => {
        if (!active) return
        setError(cause.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  const normalizedQuery = normalizeText(value.trim())
  const results = useMemo(() => {
    if (!normalizedQuery) return catalog.slice(0, 5)

    return catalog
      .filter((deputy) => {
        const searchable = [
          deputy.nome,
          deputy.nomeCivil,
          deputy.partido,
          deputy.uf,
          deputy.escolaridade,
          deputy.legislaturaInicial,
          deputy.legislaturaFinal,
        ]
          .filter(Boolean)
          .join(' ')
        return normalizeText(searchable).includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [catalog, normalizedQuery])

  const selectDeputy = (deputy: DeputyOption) => {
    setValue(deputy.nome)
    setOpen(false)
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
    navigate(`/deputados/${deputy.id}`)
  }

  const visibleResults = normalizedQuery ? results : !hasInteracted ? results : []
  const showResults = open && visibleResults.length > 0

  return (
    <section
      className={`deputy-search${compact ? ' deputy-search--compact' : ''}${className ? ` ${className}` : ''}`}
      onBlurCapture={(event) => {
        if (blurTimerRef.current) {
          window.clearTimeout(blurTimerRef.current)
        }
        const nextTarget = event.relatedTarget as Node | null
        if (nextTarget && event.currentTarget.contains(nextTarget)) {
          return
        }
        blurTimerRef.current = window.setTimeout(() => {
          setOpen(false)
          if (!value.trim()) {
            setHasInteracted(false)
          }
        }, 120)
      }}
      onFocusCapture={() => {
        if (blurTimerRef.current) {
          window.clearTimeout(blurTimerRef.current)
          blurTimerRef.current = null
        }
      }}
    >
      <label className="deputy-search__label" htmlFor="deputy-search-input">
        <span>Pesquisar deputado</span>
        <input
          id="deputy-search-input"
          className="deputy-search__input"
          type="search"
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showResults}
          aria-controls="deputy-search-results"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setValue(event.target.value)
            if (event.target.value.trim().length > 0) {
              setHasInteracted(true)
            }
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              event.currentTarget.blur()
            }
            if (event.key === 'Enter' && results.length > 0) {
              event.preventDefault()
              selectDeputy(results[0])
            }
          }}
        />
      </label>

      {loading ? <p className="deputy-search__status">Carregando catalogo de deputados...</p> : null}
      {error ? <p className="deputy-search__status deputy-search__status--error">Nao foi possivel carregar o catalogo: {error}</p> : null}

      {showResults ? (
        <div id="deputy-search-results" className="deputy-search__results" role="listbox">
          {visibleResults.length > 0 ? (
            visibleResults.map((deputy) => (
              <button
                key={deputy.id}
                type="button"
                className="deputy-search__option"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectDeputy(deputy)}
              >
                <DeputyAvatar id={deputy.id} nome={deputy.nome} size={compact ? 32 : 40} />
                <span className="deputy-search__option-body">
                  <strong className="deputy-search__option-name">{deputy.nome}</strong>
                  <span className="deputy-search__option-meta">
                    {optionalLabel(deputy.partido)} | {optionalLabel(deputy.uf)}
                  </span>
                  <span className="deputy-search__option-submeta">{buildSecondaryLine(deputy)}</span>
                </span>
              </button>
            ))
          ) : (
            <span className="deputy-search__empty">Nenhum deputado encontrado.</span>
          )}
        </div>
      ) : null}
    </section>
  )
}
