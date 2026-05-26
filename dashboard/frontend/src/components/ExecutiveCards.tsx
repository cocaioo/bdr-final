import type { ReactNode } from 'react'

import type { SummaryCard } from '../types'

interface ExecutiveCardsProps {
  cards: SummaryCard[]
  extraCard?: ReactNode
}

export function ExecutiveCards({ cards, extraCard }: ExecutiveCardsProps) {
  return (
    <section className="cards-section" aria-label="Resumo executivo">
      {cards.map((card, index) => (
        <article
          key={card.id}
          className="summary-card stagger-item"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <h3>{card.label}</h3>
          <p>
            {card.value}
            {card.unit ? <small>{card.unit}</small> : null}
          </p>
        </article>
      ))}

      {extraCard ? (
        <article
          className="summary-card formula-card stagger-item"
          style={{ animationDelay: `${cards.length * 60}ms` }}
        >
          {extraCard}
        </article>
      ) : null}
    </section>
  )
}

