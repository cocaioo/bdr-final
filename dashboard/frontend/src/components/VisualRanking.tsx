import { DeputyAvatar } from './DeputyAvatar'
import { formatCurrency } from '../utils/format'

interface VisualRankingProps {
  rows: Array<Record<string, unknown>>
  title?: string
  limit?: number
  idField?: string
  labelField: string
  valueField: string
  subtitleField?: string
  secondarySubtitleField?: string
  extraLabelField?: string
  highlightValue?: string | number | null
  highlightField?: string
  isCurrency?: boolean
  formatSubtitle?: (val: unknown) => string
}

export function VisualRanking({
  rows,
  title,
  limit = 10,
  idField,
  labelField,
  valueField,
  subtitleField,
  secondarySubtitleField,
  extraLabelField,
  highlightValue,
  highlightField = 'id_deputado',
  isCurrency = true,
  formatSubtitle,
}: VisualRankingProps) {
  const displayRows = rows.slice(0, limit)

  const maxVal = Math.max(
    1,
    ...rows.map((r) => {
      const val = Number(r[valueField])
      return Number.isNaN(val) ? 0 : val
    })
  )

  const isHighlighted = (row: Record<string, unknown>) => {
    if (!highlightValue) return false
    const val = row[highlightField]
    return val !== undefined && String(val) === String(highlightValue)
  }

  return (
    <div className="visual-ranking">
      {title && <h3 className="ranking-title">{title}</h3>}
      <div className="ranking-list">
        {displayRows.map((row, index) => {
          const val = Number(row[valueField])
          const valueFormatted = isCurrency
            ? formatCurrency(Number.isNaN(val) ? 0 : val)
            : (Number.isNaN(val) ? 0 : val).toLocaleString('pt-BR', { maximumFractionDigits: 5 })
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
          const label = String(row[labelField] || '')
          const id = idField ? String(row[idField] || '') : undefined

          let subtitle = ''
          if (subtitleField) {
            const rawSub = row[subtitleField]
            subtitle = formatSubtitle ? formatSubtitle(rawSub) : String(rawSub || '')
            if (secondarySubtitleField && row[secondarySubtitleField]) {
              subtitle = `${subtitle} - ${row[secondarySubtitleField]}`
            }
          }

          const extraLabel = extraLabelField && row[extraLabelField] !== undefined
            ? typeof row[extraLabelField] === 'number'
              ? `${Number(row[extraLabelField]).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
              : `${row[extraLabelField]}%`
            : null

          const highlighted = isHighlighted(row)

          return (
            <div
              key={index}
              className={`ranking-row ${highlighted ? 'highlight' : ''}`}
            >
              <div className="ranking-position">#{index + 1}</div>

              {idField && (
                <div className="ranking-avatar-wrapper">
                  <DeputyAvatar id={id} nome={label} size={38} />
                </div>
              )}

              <div className="ranking-details">
                <div className="ranking-label-row">
                  <span className="ranking-item-label" title={label}>{label}</span>
                  <div className="ranking-item-values">
                    <span className="ranking-item-value">{valueFormatted}</span>
                    {extraLabel && <span className="ranking-item-extra">({extraLabel})</span>}
                  </div>
                </div>

                {subtitle && <div className="ranking-item-subtitle">{subtitle}</div>}

                <div className="ranking-progress-track">
                  <div
                    className="ranking-progress-bar"
                    style={{ width: `${Math.max(1, Math.min(100, pct))}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
        {displayRows.length === 0 && (
          <p className="ranking-empty">Nenhum registro para exibir.</p>
        )}
      </div>
    </div>
  )
}
