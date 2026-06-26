import { useMemo } from 'react'

import { DeputyAvatar } from './DeputyAvatar'
import { ALIGNMENT_TOLERANCE, type CaucusCohesion, type RevealedDeputy } from '../utils/q14'

interface MethodologySummaryProps {
  deputies: RevealedDeputy[]
  cohesion: CaucusCohesion[]
}

function fmt(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

/**
 * Resumo de metodologia em linguagem direta + um EXEMPLO REAL montado a partir
 * dos dados carregados. Escolhe o deputado de maior desvio do partido (que
 * aparece em "Deputados fora da curva") e mostra, lado a lado, os tres conceitos
 * que o painel mede — para tornar evidente que cada secao usa uma referencia
 * diferente. Nao recalcula a metodologia; apenas le os campos ja vindos de Q14.
 */
export function MethodologySummary({ deputies, cohesion }: MethodologySummaryProps) {
  const example = useMemo(() => {
    if (!deputies.length) return null
    // Deputado de maior |desvio do partido| — o mais "fora da curva".
    const deputy = [...deputies].sort(
      (a, b) => Math.abs(b.partyDeviation) - Math.abs(a.partyDeviation),
    )[0]
    const caucus = cohesion.find((c) => c.party === deputy.party) ?? null
    return { deputy, caucus }
  }, [deputies, cohesion])

  return (
    <div className="methodology-summary">
      <p className="methodology-summary__lead">
        O painel mede três coisas parecidas, mas com <strong>referências diferentes</strong>. Não
        confunda os “desvios”: cada seção compara o deputado (ou a bancada) com um ponto de partida distinto.
      </p>

      <div className="methodology-summary__grid">
        <article className="methodology-summary__concept">
          <h4>Alinhamento partidário</h4>
          <p className="methodology-summary__ref">Referência: orientação oficial do líder</p>
          <p>Disciplina de voto: com que frequência o deputado segue a diretriz da bancada em cada votação.</p>
        </article>
        <article className="methodology-summary__concept">
          <h4>Posição revelada / fora da curva</h4>
          <p className="methodology-summary__ref">Referência: escala do partido (Bolognesi)</p>
          <p>
            Desvio do partido = <code>score calibrado − ideologia do partido</code>. Quão longe o voto
            do deputado está do rótulo ideológico atribuído ao seu partido. Tolerância de ±{ALIGNMENT_TOLERANCE} para “alinhado”.
          </p>
        </article>
        <article className="methodology-summary__concept">
          <h4>Coesão da bancada</h4>
          <p className="methodology-summary__ref">Referência: média de voto da própria bancada</p>
          <p>
            Desvio da bancada = <code>comportamento do deputado − média do partido</code>. Mede a
            uniformidade interna: quão parecido os deputados votam entre si (independe do Bolognesi).
          </p>
        </article>
      </div>

      {example ? (
        <div className="methodology-summary__example">
          <div className="methodology-summary__example-head">
            <DeputyAvatar id={example.deputy.deputyId} nome={example.deputy.name} size={44} />
            <div>
              <strong>{example.deputy.name}</strong>
              <span>
                {example.deputy.party}
                {example.deputy.partyBand ? ` · ${example.deputy.partyBand}` : ''} · exemplo real (maior desvio do partido)
              </span>
            </div>
          </div>

          <table className="methodology-summary__table">
            <tbody>
              <tr>
                <th scope="row">Ideologia do partido (Bolognesi)</th>
                <td>{fmt(example.deputy.partyScore)}</td>
                <td className="methodology-summary__note">posição atribuída ao partido</td>
              </tr>
              <tr>
                <th scope="row">Comportamento calibrado (W-NOMINATE)</th>
                <td>{fmt(example.deputy.calibratedScore)}</td>
                <td className="methodology-summary__note">como ele realmente votou</td>
              </tr>
              <tr className="methodology-summary__highlight">
                <th scope="row">→ Desvio do partido</th>
                <td>
                  {example.deputy.partyDeviation > 0 ? '+' : ''}
                  {fmt(example.deputy.partyDeviation)}
                </td>
                <td className="methodology-summary__note">
                  {example.deputy.partyDeviationDirection} — aparece em “fora da curva”
                </td>
              </tr>
              <tr className="methodology-summary__highlight">
                <th scope="row">→ Desvio da bancada</th>
                <td>
                  {example.deputy.caucusDeviation > 0 ? '+' : ''}
                  {fmt(example.deputy.caucusDeviation)}
                </td>
                <td className="methodology-summary__note">
                  distância da média do próprio partido — usado na coesão
                </td>
              </tr>
              {example.caucus ? (
                <tr>
                  <th scope="row">Coesão da bancada do {example.deputy.party}</th>
                  <td>{fmt(example.caucus.deviationMeanAbs)}</td>
                  <td className="methodology-summary__note">
                    desvio médio interno (máx. {fmt(example.caucus.deviationMaxAbs)})
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <p className="methodology-summary__takeaway">
            Repare: os dois “desvios” do mesmo deputado têm valores diferentes porque medem coisas
            diferentes. O <strong>desvio do partido</strong> ({example.deputy.partyDeviation > 0 ? '+' : ''}
            {fmt(example.deputy.partyDeviation)}) o compara com o rótulo ideológico do partido; o
            <strong> desvio da bancada</strong> ({example.deputy.caucusDeviation > 0 ? '+' : ''}
            {fmt(example.deputy.caucusDeviation)}) o compara com a média de voto dos colegas de partido.
          </p>
        </div>
      ) : null}
    </div>
  )
}
