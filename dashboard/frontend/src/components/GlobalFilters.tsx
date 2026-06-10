import { useEffect, useState } from 'react'

import type { FilterCatalog, FilterState } from '../types'

interface GlobalFiltersProps {
  catalog: FilterCatalog
  value: FilterState
  onChange: (next: FilterState) => void
  supportedFilters?: string[]
  hideSearch?: boolean
  hideNumericDeputyChoices?: boolean
  searchableDeputyFilter?: boolean
}

function isEnabled(supportedFilters: string[] | undefined, filterId: string) {
  if (!supportedFilters || supportedFilters.length === 0) return true
  return supportedFilters.includes(filterId)
}

function readSelectedValues(target: HTMLSelectElement) {
  return Array.from(target.selectedOptions).map((option) => option.value)
}

function choiceLabel(choice: { label: string; status?: string | null }) {
  if (!choice.status || choice.status === 'ativo') return choice.label
  return `${choice.label} (${choice.status})`
}

function getChoiceLabel(choices: Array<{ value: string; label: string }>, val: string): string {
  const choice = choices.find((c) => c.value === val)
  return choice ? choice.label : val
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const EMPTY_FILTER_STATE: FilterState = {
  anos: [],
  eixos: [],
  partidos: [],
  ufs: [],
  deputados: [],
  escolaridade: [],
  search: '',
}

export function GlobalFilters({
  catalog,
  value,
  onChange,
  supportedFilters,
  hideSearch = false,
  hideNumericDeputyChoices = false,
  searchableDeputyFilter = false,
}: GlobalFiltersProps) {
  const [searchValue, setSearchValue] = useState(value.search ?? '')
  const [deputySearchValue, setDeputySearchValue] = useState('')
  const [isDeputySearchOpen, setIsDeputySearchOpen] = useState(false)

  // Sync internal state with external value.search changes (e.g. clear filters)
  useEffect(() => {
    setSearchValue(value.search ?? '')
  }, [value.search])

  // Debounce state propagation to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (value.search ?? '')) {
        onChange({ ...value, search: searchValue })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, onChange, value])

  const setList = (
    key: keyof Pick<FilterState, 'anos' | 'eixos' | 'partidos' | 'ufs' | 'deputados' | 'escolaridade'>,
    values: string[],
  ) => {
    onChange({ ...value, [key]: values })
  }

  const isFilterActive = (filterId: string) => {
    if (!isEnabled(supportedFilters, filterId)) return false
    const key = filterId as keyof FilterState
    return Array.isArray(value[key]) ? (value[key] as string[]).length > 0 : false
  }

  const hasAnyActiveFilters = () => {
    return (
      isFilterActive('anos') ||
      isFilterActive('eixos') ||
      isFilterActive('partidos') ||
      isFilterActive('ufs') ||
      isFilterActive('deputados') ||
      isFilterActive('escolaridade') ||
      (!hideSearch && (value.search ?? '').trim().length > 0)
    )
  }

  const clearAllFilters = () => {
    setDeputySearchValue('')
    setIsDeputySearchOpen(false)
    onChange(EMPTY_FILTER_STATE)
  }

  const safeCatalog = {
    anos: catalog.anos ?? [],
    eixos: catalog.eixos ?? [],
    partidos: catalog.partidos ?? [],
    ufs: catalog.ufs ?? [],
    deputados: catalog.deputados ?? [],
    escolaridade: catalog.escolaridade ?? [],
  }

  const deputyChoices = hideNumericDeputyChoices
    ? safeCatalog.deputados.filter((choice) => !/^\d+$/.test(choice.label))
    : safeCatalog.deputados
  const selectedDeputyLabel = value.deputados.length > 0
    ? getChoiceLabel(deputyChoices, value.deputados[0])
    : ''
  const normalizedDeputySearch = normalizeSearchText(deputySearchValue.trim())
  const filteredDeputyChoices = deputyChoices
    .filter((choice) => {
      if (!normalizedDeputySearch) return true
      return normalizeSearchText(choice.label).includes(normalizedDeputySearch)
    })
    .slice(0, 20)

  useEffect(() => {
    if (!searchableDeputyFilter) return
    if (value.deputados.length > 0) {
      setDeputySearchValue(selectedDeputyLabel)
    }
  }, [searchableDeputyFilter, selectedDeputyLabel, value.deputados.length])

  const selectDeputy = (deputyId: string) => {
    setList('deputados', [deputyId])
    setDeputySearchValue(getChoiceLabel(deputyChoices, deputyId))
    setIsDeputySearchOpen(false)
  }

  const clearDeputy = () => {
    setList('deputados', [])
    setDeputySearchValue('')
    setIsDeputySearchOpen(false)
  }

  return (
    <section className="filter-panel stagger-item">
      <div className="filter-panel-header">
        <span className="filter-panel-title">Painel de Filtros</span>
        {hasAnyActiveFilters() && (
          <button type="button" className="clear-all-btn" onClick={clearAllFilters}>
            Limpar todos os filtros
          </button>
        )}
      </div>
      <div className="filter-grid">
        {isEnabled(supportedFilters, 'anos') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-anos">Ano</label>
              {value.anos.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setList('anos', [])}>
                  Limpar
                </button>
              )}
            </div>
            <select
              id="filter-anos"
              multiple
              value={value.anos}
              onChange={(event) => setList('anos', readSelectedValues(event.target))}
            >
              {safeCatalog.anos.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            {value.anos.length > 0 && (
              <div className="filter-tags">
                {value.anos.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.anos, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('anos', value.anos.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isEnabled(supportedFilters, 'eixos') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-eixos">Tema</label>
              {value.eixos.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setList('eixos', [])}>
                  Limpar
                </button>
              )}
            </div>
            <select
              id="filter-eixos"
              multiple
              value={value.eixos}
              onChange={(event) => setList('eixos', readSelectedValues(event.target))}
            >
              {safeCatalog.eixos.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            {value.eixos.length > 0 && (
              <div className="filter-tags">
                {value.eixos.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.eixos, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('eixos', value.eixos.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isEnabled(supportedFilters, 'partidos') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-partidos">Partido</label>
              {value.partidos.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setList('partidos', [])}>
                  Limpar
                </button>
              )}
            </div>
            <select
              id="filter-partidos"
              multiple
              value={value.partidos}
              onChange={(event) => setList('partidos', readSelectedValues(event.target))}
            >
              {safeCatalog.partidos.map((choice) => (
                <option key={choice.value} value={choice.value} title={choice.status ?? undefined}>
                  {choiceLabel(choice)}
                </option>
              ))}
            </select>
            {value.partidos.length > 0 && (
              <div className="filter-tags">
                {value.partidos.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.partidos, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('partidos', value.partidos.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isEnabled(supportedFilters, 'ufs') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-ufs">UF</label>
              {value.ufs.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setList('ufs', [])}>
                  Limpar
                </button>
              )}
            </div>
            <select
              id="filter-ufs"
              multiple
              value={value.ufs}
              onChange={(event) => setList('ufs', readSelectedValues(event.target))}
            >
              {safeCatalog.ufs.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            {value.ufs.length > 0 && (
              <div className="filter-tags">
                {value.ufs.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.ufs, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('ufs', value.ufs.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isEnabled(supportedFilters, 'deputados') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-deputados">Deputado</label>
              {value.deputados.length > 0 && (
                <button type="button" className="clear-btn" onClick={searchableDeputyFilter ? clearDeputy : () => setList('deputados', [])}>
                  Limpar
                </button>
              )}
            </div>
            {searchableDeputyFilter ? (
              <div className="autocomplete-filter">
                <input
                  id="filter-deputados"
                  value={deputySearchValue}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={isDeputySearchOpen}
                  aria-controls="filter-deputados-options"
                  placeholder="Digite o nome do deputado..."
                  onFocus={() => setIsDeputySearchOpen(true)}
                  onChange={(event) => {
                    setDeputySearchValue(event.target.value)
                    setIsDeputySearchOpen(true)
                    if (value.deputados.length > 0) {
                      setList('deputados', [])
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && filteredDeputyChoices.length > 0) {
                      event.preventDefault()
                      selectDeputy(filteredDeputyChoices[0].value)
                    }
                    if (event.key === 'Escape') {
                      setIsDeputySearchOpen(false)
                    }
                  }}
                />
                {isDeputySearchOpen && deputySearchValue.trim().length > 0 && (
                  <div id="filter-deputados-options" className="autocomplete-options" role="listbox">
                    {filteredDeputyChoices.length > 0 ? (
                      filteredDeputyChoices.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          role="option"
                          className="autocomplete-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectDeputy(choice.value)}
                        >
                          {choice.label}
                        </button>
                      ))
                    ) : (
                      <span className="autocomplete-empty">Nenhum deputado encontrado</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <select
                id="filter-deputados"
                multiple
                value={value.deputados}
                onChange={(event) => setList('deputados', readSelectedValues(event.target))}
              >
                {deputyChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
            {value.deputados.length > 0 && (
              <div className="filter-tags">
                {value.deputados.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.deputados, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('deputados', value.deputados.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {isEnabled(supportedFilters, 'escolaridade') && (
          <div className="filter-item">
            <div className="filter-item-header">
              <label htmlFor="filter-escolaridade">Escolaridade</label>
              {value.escolaridade.length > 0 && (
                <button type="button" className="clear-btn" onClick={() => setList('escolaridade', [])}>
                  Limpar
                </button>
              )}
            </div>
            <select
              id="filter-escolaridade"
              multiple
              value={value.escolaridade}
              onChange={(event) => setList('escolaridade', readSelectedValues(event.target))}
            >
              {safeCatalog.escolaridade.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            {value.escolaridade.length > 0 && (
              <div className="filter-tags">
                {value.escolaridade.map((val) => (
                  <span key={val} className="filter-tag">
                    {getChoiceLabel(safeCatalog.escolaridade, val)}
                    <button
                      type="button"
                      className="remove-tag-btn"
                      onClick={() => setList('escolaridade', value.escolaridade.filter((v) => v !== val))}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {!hideSearch ? (
        <div className="filter-search-container">
          <div className="filter-item-header">
            <label htmlFor="filter-search">Busca textual no ranking</label>
            {searchValue.length > 0 && (
              <button type="button" className="clear-btn" onClick={() => {
                setSearchValue('')
                onChange({ ...value, search: '' })
              }}>
                Limpar
              </button>
            )}
          </div>
          <input
            id="filter-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Digite para filtrar linhas..."
          />
        </div>
      ) : null}
      <p className="filter-help">Use Ctrl/Cmd para selecionar mais de um valor em cada filtro.</p>
    </section>
  )
}
