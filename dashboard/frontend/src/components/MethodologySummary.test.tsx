import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MethodologySummary } from './MethodologySummary'
import { toRevealedDeputy, type CaucusCohesion, type RevealedDeputy } from '../utils/q14'

function mk(name: string, party: string, partyDeviation: number, caucusDeviation: number): RevealedDeputy {
  return toRevealedDeputy({
    deputy_id: name.replace(/\s/g, ''),
    deputy_name: name,
    party,
    party_ideology_score: 1.4,
    party_ideology_band: 'Extrema esquerda',
    behavioral_score_calibrated: 5.0,
    party_deviation: partyDeviation,
    party_deviation_direction: partyDeviation > 0 ? 'mais a direita' : 'mais a esquerda',
    caucus_deviation: caucusDeviation,
    valid_votes: 700,
    confidence_band: 'alta',
  })
}

const deputies = [mk('Pequeno Desvio', 'PT', 0.4, 0.1), mk('Glauber Braga', 'PSOL', 3.61, 0.27)]
const cohesion: CaucusCohesion[] = [
  { party: 'PSOL', numDeputies: 15, partyBand: 'Extrema esquerda', caucusScore: 1.3, deviationMeanAbs: 0.15, deviationMaxAbs: 0.79, deviationStd: 0.24 },
]

describe('MethodologySummary', () => {
  it('explica os três referenciais distintos', () => {
    render(<MethodologySummary deputies={deputies} cohesion={cohesion} />)
    expect(screen.getByText(/orientação oficial do líder/i)).toBeInTheDocument()
    expect(screen.getByText(/escala do partido \(Bolognesi\)/i)).toBeInTheDocument()
    expect(screen.getByText(/média de voto da própria bancada/i)).toBeInTheDocument()
  })

  it('usa como exemplo o deputado de maior desvio do partido e mostra os dois desvios', () => {
    render(<MethodologySummary deputies={deputies} cohesion={cohesion} />)
    // Glauber tem o maior |desvio do partido| (3.61), nao "Pequeno Desvio".
    expect(screen.getByText('Glauber Braga')).toBeInTheDocument()
    expect(screen.queryByText('Pequeno Desvio')).not.toBeInTheDocument()
    // Os dois desvios distintos aparecem.
    expect(screen.getByText('+3.61')).toBeInTheDocument()
    expect(screen.getByText('+0.27')).toBeInTheDocument()
    // E a coesão da bancada do PSOL.
    expect(screen.getByText(/Coesão da bancada do PSOL/i)).toBeInTheDocument()
  })
})
