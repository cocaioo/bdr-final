import { Markdown } from './Markdown'
import type { MethodologyBlock } from '../utils/q14'

interface MethodologyCardProps {
  methodology: MethodologyBlock | null
}

/**
 * Card de metodologia (sempre a ultima secao do bloco). Renderiza o texto
 * vindo do backend (chart_spec.options.methodology) com o renderizador de
 * Markdown do app, exibindo títulos, listas, tabelas, código e ênfase como
 * documentação. Não altera nem reinterpreta a metodologia.
 */
export function MethodologyCard({ methodology }: MethodologyCardProps) {
  if (!methodology || !methodology.text) return null

  return (
    <div className="methodology-card">
      {methodology.summary ? <p className="methodology-card__summary">{methodology.summary}</p> : null}
      <Markdown source={methodology.text} className="methodology-card__body" />
      {methodology.source ? (
        <p className="methodology-card__source">Fonte: {methodology.source}</p>
      ) : null}
    </div>
  )
}
