import { IdeologyBadge } from './IdeologyBadge'
import type { RevealedDeputy } from '../utils/q14'

interface OutlierDeputiesRankingProps {
  /** Deputados que votam mais a direita que o partido (topRightDeviation). */
  toRight: RevealedDeputy[]
  /** Deputados que votam mais a esquerda que o partido (topLeftDeviation). */
  toLeft: RevealedDeputy[]
  limit?: number
}

interface OutlierColumnProps {
  title: string
  accent: string
  deputies: RevealedDeputy[]
}

function OutlierColumn({ title, accent, deputies }: OutlierColumnProps) {
  return (
    <div className="outliers__column">
      <h3 className="outliers__title" style={{ borderColor: accent }}>
        <span className="outliers__dot" style={{ backgroundColor: accent }} aria-hidden="true" />
        {title}
      </h3>
      {deputies.length ? (
        <ol className="outliers__list">
          {deputies.map((d, index) => (
            <li key={d.deputyId || `${d.name}-${index}`} className="outliers__row">
              <span className="outliers__rank">{index + 1}</span>
              <span className="outliers__deputy">
                <strong>{d.name}</strong>
                <small>{d.party}</small>
              </span>
              <span className="outliers__band">
                <IdeologyBadge range={d.partyBand} compact />
              </span>
              <span className="outliers__deviation" style={{ color: accent }}>
                {d.partyDeviation > 0 ? '+' : ''}
                {d.partyDeviation.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="outliers__empty">Sem deputados nesta categoria.</p>
      )}
    </div>
  )
}

/**
 * "Deputados fora da curva do partido" (Q14): duas colunas com os parlamentares
 * cujo comportamento de voto mais se afasta da posicao do proprio partido, para
 * a direita e para a esquerda. Consome os helper arrays ja calculados pelo backend.
 */
export function OutlierDeputiesRanking({ toRight, toLeft, limit = 10 }: OutlierDeputiesRankingProps) {
  return (
    <div className="outliers">
      <OutlierColumn
        title="Mais à esquerda que o partido"
        accent="#468bc7"
        deputies={toLeft.slice(0, limit)}
      />
      <OutlierColumn
        title="Mais à direita que o partido"
        accent="#cf673f"
        deputies={toRight.slice(0, limit)}
      />
    </div>
  )
}
