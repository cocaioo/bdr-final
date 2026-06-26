import { IDEOLOGY_RANGES } from '../utils/ideology'

interface IdeologyLegendProps {
  /** Contagem opcional de partidos por faixa (chave = rotulo da faixa). */
  counts?: Record<string, number>
}

/**
 * Legenda compartilhada do espectro ideologico. Sempre exibe as sete faixas
 * suportadas pelo painel, mesmo quando alguma esta vazia (ex.: Centro),
 * para manter a consistencia visual entre as secoes.
 */
export function IdeologyLegend({ counts }: IdeologyLegendProps) {
  return (
    <ul className="ideology-legend" aria-label="Faixas ideologicas">
      {IDEOLOGY_RANGES.map((range) => {
        const count = counts?.[range.label]
        const isEmpty = counts ? !count : false
        return (
          <li
            key={range.key}
            className={`ideology-legend__item${isEmpty ? ' ideology-legend__item--empty' : ''}`}
          >
            <span className="ideology-legend__swatch" style={{ backgroundColor: range.color }} aria-hidden="true" />
            <span className="ideology-legend__label">{range.label}</span>
            {counts ? <span className="ideology-legend__count">{count ?? 0}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}
