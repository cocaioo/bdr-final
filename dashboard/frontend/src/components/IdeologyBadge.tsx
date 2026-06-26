import { rangeColor, rangeLabel } from '../utils/ideology'

interface IdeologyBadgeProps {
  range: unknown
  /** Exibe um ponto colorido seguido do rotulo (padrao) ou apenas o ponto. */
  compact?: boolean
}

/** Etiqueta colorida que identifica a faixa ideologica de um partido. */
export function IdeologyBadge({ range, compact = false }: IdeologyBadgeProps) {
  const color = rangeColor(range)
  const label = rangeLabel(range)

  if (compact) {
    return (
      <span
        className="ideology-badge ideology-badge--compact"
        title={label}
        style={{ backgroundColor: color }}
        aria-label={label}
      />
    )
  }

  return (
    <span className="ideology-badge" style={{ borderColor: color }}>
      <span className="ideology-badge__dot" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
