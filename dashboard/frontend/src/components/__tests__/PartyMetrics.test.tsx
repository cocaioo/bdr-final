import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CaucusCohesionChart } from '../CaucusCohesionChart'
import { PartyAlignmentRanking } from '../PartyAlignmentRanking'

vi.mock('../IdeologyBarChart', () => ({
  IdeologyBarChart: ({ bars }: { bars: Array<{ label: string }> }) => (
    <div data-testid="bar-chart">{bars.map((bar) => bar.label).join(',')}</div>
  ),
}))

describe('métricas partidárias', () => {
  it('renderiza no gráfico todas as linhas de alinhamento recebidas', () => {
    render(
      <PartyAlignmentRanking
        rows={[
          {
            sigla_partido: 'NOVO',
            ideologia_faixa: 'Extrema direita',
            pct_alinhamento: 99.5,
            total_votos_com_diretriz: 100,
          },
          {
            sigla_partido: 'PT',
            ideologia_faixa: 'Esquerda',
            pct_alinhamento: 92.4,
            total_votos_com_diretriz: 250,
          },
        ]}
      />,
    )

    expect(screen.getByTestId('bar-chart')).toHaveTextContent('NOVO')
    expect(screen.getByTestId('bar-chart')).toHaveTextContent('PT')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('inclui bancadas de um único deputado no gráfico de coesão', () => {
    render(
      <CaucusCohesionChart
        cohesion={[
          {
            party: 'MISSAO',
            numDeputies: 1,
            partyBand: 'Direita',
            caucusScore: 7.5,
            deviationMeanAbs: 0,
            deviationMaxAbs: 0,
            deviationStd: 0,
          },
          {
            party: 'PT',
            numDeputies: 76,
            partyBand: 'Esquerda',
            caucusScore: 2.7,
            deviationMeanAbs: 0.128,
            deviationMaxAbs: 1.2,
            deviationStd: 0.2,
          },
        ]}
      />,
    )

    expect(screen.getByTestId('bar-chart')).toHaveTextContent('MISSAO')
    expect(screen.getByTestId('bar-chart')).toHaveTextContent('PT')
  })
})
