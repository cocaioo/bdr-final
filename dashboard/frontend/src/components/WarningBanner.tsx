import type { WarningItem } from '../types'

interface WarningBannerProps {
  warnings: WarningItem[]
}

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null
  return (
    <section className="warning-banner" aria-label="Avisos de consistencia">
      <h3>Avisos de consistencia</h3>
      <ul>
        {warnings.map((warning) => (
          <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
        ))}
      </ul>
    </section>
  )
}

