import type { FilterCatalog, FilterState } from '../types'

interface GlobalFiltersProps {
  catalog: FilterCatalog
  value: FilterState
  onChange: (next: FilterState) => void
  supportedFilters?: string[]
}

function isEnabled(supportedFilters: string[] | undefined, filterId: string) {
  if (!supportedFilters || supportedFilters.length === 0) return true
  return supportedFilters.includes(filterId)
}

function readSelectedValues(target: HTMLSelectElement) {
  return Array.from(target.selectedOptions).map((option) => option.value)
}

export function GlobalFilters({
  catalog,
  value,
  onChange,
  supportedFilters,
}: GlobalFiltersProps) {
  const setList = (key: keyof Pick<FilterState, 'anos' | 'partidos' | 'ufs' | 'deputados'>, values: string[]) => {
    onChange({ ...value, [key]: values })
  }

  return (
    <section className="filter-panel">
      <div className="filter-grid">
        <label className="filter-item">
          <span>Ano</span>
          <select
            multiple
            value={value.anos}
            onChange={(event) => setList('anos', readSelectedValues(event.target))}
            disabled={!isEnabled(supportedFilters, 'anos')}
          >
            {catalog.anos.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-item">
          <span>Partido</span>
          <select
            multiple
            value={value.partidos}
            onChange={(event) => setList('partidos', readSelectedValues(event.target))}
            disabled={!isEnabled(supportedFilters, 'partidos')}
          >
            {catalog.partidos.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-item">
          <span>UF</span>
          <select
            multiple
            value={value.ufs}
            onChange={(event) => setList('ufs', readSelectedValues(event.target))}
            disabled={!isEnabled(supportedFilters, 'ufs')}
          >
            {catalog.ufs.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-item">
          <span>Deputado</span>
          <select
            multiple
            value={value.deputados}
            onChange={(event) => setList('deputados', readSelectedValues(event.target))}
            disabled={!isEnabled(supportedFilters, 'deputados')}
          >
            {catalog.deputados.slice(0, 1000).map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="filter-search">
        <span>Busca textual no ranking</span>
        <input
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          placeholder="Digite para filtrar linhas..."
        />
      </label>
      <p className="filter-help">Use Ctrl/Cmd para selecionar mais de um valor em cada filtro.</p>
    </section>
  )
}

