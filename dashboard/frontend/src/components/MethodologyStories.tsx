/**
 * MethodologyStories — interactive slide presentations for each methodology.
 * Design standard: follows WNominateStory visual language exactly.
 * Each story answers ONE concept per slide.
 * No autoplay — user controls progression.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Shared utilities ──────────────────────────────────────────────────────────

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

// ─── Color palette (same as WNominateStory) ───────────────────────────────────
// Blue  → inputs / data
// Green → correct / positive / agreement
// Orange → processing / warning
// Purple → algorithm / computation
// Red   → error / disagreement / exclusion
// Gray  → metadata / neutral

const C = {
  blue:   '#5b84a2',
  purple: '#b39ddb',
  green:  '#66bb6a',
  orange: '#ffb74d',
  red:    '#ef9a9a',
  teal:   '#80deea',
  ink:    '#e2e8f0',
  muted:  '#8a9ba8',
  dim:    'rgba(200,215,228,0.7)',
}

const SVG_STYLE = { width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' } as const

// ─── Shared slide shell ────────────────────────────────────────────────────────

interface StoryShellProps {
  slides: { title: string; text: string; component: React.ReactNode }[]
  testId?: string
}

export function StoryShell({ slides, testId }: StoryShellProps) {
  const total = slides.length
  const [slide, setSlide]       = useState(0)
  const [finished, setFinished] = useState(false)
  const [key, setKey]           = useState(0)

  const goTo = useCallback((idx: number) => {
    setSlide(idx)
    setKey(k => k + 1)
    if (idx >= total - 1) setFinished(true)
  }, [total])

  const prev = useCallback(() => { if (slide > 0) goTo(slide - 1) }, [slide, goTo])
  const next = useCallback(() => {
    if (slide < total - 1) goTo(slide + 1); else setFinished(true)
  }, [slide, total, goTo])

  const current  = slides[slide]
  const progress = ((slide + 1) / total) * 100

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  return (
    <div className="wn-story" data-testid={testId}>
      {/* Progress bar */}
      <div className="wn-story__progress-bar">
        <div className="wn-story__progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Counter */}
      <div className="wn-story__counter" aria-live="polite">
        Slide {slide + 1} de {total}
      </div>

      {/* Slide area */}
      <div className="wn-story__slide-area">
        <div key={key} className="wn-story__slide">
          <h3 className="wn-story__slide-title">{current.title}</h3>
          <div className="wn-story__vis" aria-label={`Visualização: ${current.title}`}>
            {current.component}
          </div>
          <p className="wn-story__text">{current.text}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="wn-story__nav">
        <button type="button" className="wn-story__btn wn-story__btn--secondary"
          onClick={prev} disabled={slide === 0} aria-label="Slide anterior">
          ← Anterior
        </button>

        <div className="wn-story__dots" role="tablist" aria-label="Navegação por slides">
          {slides.map((_, i) => (
            <button key={i} type="button" role="tab"
              aria-selected={i === slide} aria-label={`Ir para slide ${i + 1}`}
              className={`wn-story__dot${i === slide ? ' wn-story__dot--active' : ''}${i < slide ? ' wn-story__dot--done' : ''}`}
              onClick={() => goTo(i)} />
          ))}
        </div>

        <button type="button" className="wn-story__btn wn-story__btn--primary"
          onClick={next}
          aria-label={slide < total - 1 ? 'Próximo slide' : 'Finalizar apresentação'}>
          {slide < total - 1 ? 'Próximo →' : 'Finalizar ✓'}
        </button>
      </div>

      {finished && (
        <div className="wn-story__cta" role="complementary">
          <p className="wn-story__cta-text">
            🎓 Apresentação concluída!
          </p>
          <button type="button" className="wn-story__btn wn-story__btn--secondary"
            onClick={() => { setSlide(0); setKey(k => k + 1); setFinished(false) }}>
            ↺ Recomeçar
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q1 — Gastos parlamentares (CEAP)
// Story: dados brutos → filtro → agregação → ranking → visualização
// ═══════════════════════════════════════════════════════════════════════════════

// Slide Q1-1: a fonte — API da Câmara
function Q1S1() {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t) }, [])
  const W = 520, H = 200
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* API box */}
      <rect x={30} y={60} width={160} height={80} rx={12}
        fill={`${C.blue}22`} stroke={`${C.blue}88`} strokeWidth={1.5} />
      <text x={110} y={96} textAnchor="middle" fontSize={11} fill={C.blue} fontWeight="bold">
        API da Câmara
      </text>
      <text x={110} y={114} textAnchor="middle" fontSize={9} fill={C.dim}>
        dadosabertos.camara.leg.br
      </text>
      <text x={110} y={130} textAnchor="middle" fontSize={9} fill={C.dim}>
        endpoint: /deputados/gastos
      </text>

      {/* Arrow */}
      <g opacity={show ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <line x1={190} y1={100} x2={270} y2={100}
          stroke={`${C.orange}99`} strokeWidth={2} strokeDasharray="5 4" />
        <polygon points="270,95 280,100 270,105" fill={C.orange} />
      </g>

      {/* Data record */}
      <g opacity={show ? 1 : 0} style={{ transition: 'opacity 700ms ease' }}>
        <rect x={285} y={44} width={200} height={112} rx={10}
          fill={`${C.orange}18`} stroke={`${C.orange}77`} strokeWidth={1.5} />
        <text x={385} y={64} textAnchor="middle" fontSize={9} fill={C.orange} fontWeight="bold">
          Registro de despesa
        </text>
        {[
          ['id_deputado', '1234'],
          ['nome', 'Dep. Silva'],
          ['descricao', 'Passagem aérea'],
          ['valor_liquido', 'R$ 1.850,00'],
          ['data_documento', '2024-03-15'],
        ].map(([k, v], i) => (
          <g key={k}>
            <text x={298} y={82 + i * 16} fontSize={8} fill={C.muted}>{k}:</text>
            <text x={398} y={82 + i * 16} fontSize={8} fill={C.ink}>{v}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// Slide Q1-2: deduplicação e limpeza
function Q1S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const rows = [
    { id: '1234', val: 'R$ 1.850,00', date: '2024-03-15', dup: false },
    { id: '1234', val: 'R$ 1.850,00', date: '2024-03-15', dup: true },
    { id: '5678', val: 'R$ 320,00',   date: '2024-03-18', dup: false },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Registros brutos recebidos da API:</div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6,
          padding: '8px 12px', borderRadius: 8,
          background: r.dup && phase >= 1 ? `${C.red}18` : `${C.blue}12`,
          border: `1px solid ${r.dup && phase >= 1 ? `${C.red}55` : `${C.blue}33`}`,
          transition: 'all 600ms ease',
          opacity: r.dup && phase >= 2 ? 0.25 : 1,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, minWidth: 24 }}>#{i + 1}</span>
          <span style={{ fontSize: 10, color: C.ink, flex: 1 }}>
            dep {r.id} · {r.val} · {r.date}
          </span>
          {r.dup && phase >= 1 && (
            <span style={{ fontSize: 9, color: C.red, fontWeight: 700 }}>DUPLICADO</span>
          )}
          {!r.dup && (
            <span style={{ fontSize: 9, color: C.green }}>✓</span>
          )}
        </div>
      ))}
      <div style={{
        marginTop: 16, fontSize: 10, color: C.green,
        opacity: phase >= 2 ? 1 : 0, transition: 'opacity 600ms ease',
      }}>
        ✓ Duplicado removido por chave (id_deputado, data, valor, cnpj)
      </div>
    </div>
  )
}

// Slide Q1-3: agregação por deputado
function Q1S3() {
  const deps = [
    { name: 'Dep. Silva',    total: 47200, party: 'PT' },
    { name: 'Dep. Costa',    total: 38500, party: 'PL' },
    { name: 'Dep. Almeida',  total: 29100, party: 'MDB' },
  ]
  const max = 50000
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const timers = deps.map((_, i) =>
      setTimeout(() => setShown(n => Math.max(n, i + 1)), 300 + i * 350)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
        SUM(valor_liquido) GROUP BY id_deputado:
      </div>
      {deps.map((d, i) => (
        <div key={i} style={{ marginBottom: 14, opacity: shown > i ? 1 : 0.1, transition: 'opacity 500ms ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: C.ink }}>{d.name}</span>
            <span style={{ fontFamily: 'monospace', color: C.orange, fontSize: 10 }}>
              R$ {d.total.toLocaleString('pt-BR')}
            </span>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: shown > i ? `${(d.total / max) * 100}%` : '0%',
              background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`,
              borderRadius: 6,
              transition: 'width 700ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Slide Q1-4: ranking final
function Q1S4() {
  const deps = [
    { rank: 1, name: 'Dep. Oliveira', val: 'R$ 89.430', uf: 'AM' },
    { rank: 2, name: 'Dep. Santos',   val: 'R$ 84.210', uf: 'PA' },
    { rank: 3, name: 'Dep. Lima',     val: 'R$ 76.800', uf: 'AC' },
    { rank: 4, name: 'Dep. Souza',    val: 'R$ 71.050', uf: 'RR' },
  ]
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const timers = deps.map((_, i) =>
      setTimeout(() => setShown(n => Math.max(n, i + 1)), 200 + i * 280)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const medal = ['🥇', '🥈', '🥉', '4️⃣']

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        ORDER BY gasto_total DESC:
      </div>
      {deps.map((d, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
          padding: '10px 14px', borderRadius: 10,
          background: i === 0 ? `${C.orange}20` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${i === 0 ? `${C.orange}55` : 'rgba(255,255,255,0.08)'}`,
          opacity: shown > i ? 1 : 0,
          transform: shown > i ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 500ms ease',
        }}>
          <span style={{ fontSize: 16 }}>{medal[i]}</span>
          <span style={{ flex: 1, fontSize: 11, color: C.ink }}>{d.name}</span>
          <span style={{ fontSize: 9, color: C.muted }}>{d.uf}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.orange }}>{d.val}</span>
        </div>
      ))}
    </div>
  )
}

// Slide Q1-5: resultado no painel
function Q1S5() {
  const W = 520, H = 200
  const bars = [89, 84, 77, 71, 65, 52]
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, bars.length)), 180)
    return () => clearInterval(iv)
  }, [])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* Panel frame */}
      <rect x={20} y={10} width={480} height={175} rx={12}
        fill="rgba(22,28,38,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={36} y={32} fontSize={10} fill={C.blue} fontWeight="bold">
        Ranking de Gastos — CEAP
      </text>
      <line x1={36} y1={38} x2={484} y2={38} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

      {/* Bars */}
      {bars.map((v, i) => {
        const y = 50 + i * 20
        const bw = shown > i ? (v / 100) * 340 : 0
        return (
          <g key={i}>
            <rect x={80} y={y} width={bw} height={12} rx={3}
              fill={`url(#q1-bar-grad)`}
              style={{ transition: 'width 500ms ease' }} />
            <text x={75} y={y + 9} textAnchor="end" fontSize={7} fill={C.muted}>
              Dep {i + 1}
            </text>
            <text x={84 + bw} y={y + 9} fontSize={7} fill={C.orange}>
              {shown > i ? `R$ ${v}k` : ''}
            </text>
          </g>
        )
      })}
      <defs>
        <linearGradient id="q1-bar-grad" x1="0" x2="1">
          <stop offset="0%" stopColor={C.blue} />
          <stop offset="100%" stopColor={C.purple} />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Q1Story() {
  return (
    <StoryShell testId="q1-story" slides={[
      {
        title: 'A fonte: API de Dados Abertos',
        text: 'Cada despesa dos deputados é registrada na CEAP (Cota para Exercício da Atividade Parlamentar) e publicada na API oficial da Câmara. Cada registro contém: quem gastou, quanto, com quem e quando.',
        component: <Q1S1 />,
      },
      {
        title: 'Limpeza: removendo duplicatas',
        text: 'A API pode retornar o mesmo registro mais de uma vez. Identificamos duplicatas por chave composta (deputado + data + valor + fornecedor) e removemos, garantindo que cada despesa seja contada apenas uma vez.',
        component: <Q1S2 />,
      },
      {
        title: 'Agregação: somando por deputado',
        text: 'Com os dados limpos, somamos valor_liquido agrupando por id_deputado. O resultado é um único número por parlamentar: o total gasto no período.',
        component: <Q1S3 />,
      },
      {
        title: 'Ranking: do maior ao menor',
        text: 'Os deputados são ordenados do maior para o menor gasto. Deputies de estados mais distantes de Brasília tendem a aparecer no topo — voos mais longos e caros justificam parte da diferença.',
        component: <Q1S4 />,
      },
      {
        title: 'Resultado no painel',
        text: 'O ranking final aparece no painel como um gráfico de barras interativo. Você pode filtrar por partido, UF ou ano — e ver o SQL exato que gerou cada número clicando em "ver consulta".',
        component: <Q1S5 />,
      },
    ]} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q3 — Classificação de votos por tema
// Story: registros → extração → classificação → agregação → dashboard
// ═══════════════════════════════════════════════════════════════════════════════

// Slide Q3-1: registros brutos de votação
function Q3S1() {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t) }, [])
  const votes = [
    { dep: 'Dep. A', prop: 'PL 1234/2023 — Reforma tributária', vote: 'SIM', color: C.green },
    { dep: 'Dep. B', prop: 'PL 5678/2023 — Segurança pública',  vote: 'NÃO', color: C.red },
    { dep: 'Dep. C', prop: 'PL 9012/2023 — Meio ambiente',       vote: 'SIM', color: C.green },
  ]
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        Cada voto vem com o título da proposição:
      </div>
      {votes.map((v, i) => (
        <div key={i} style={{
          marginBottom: 8, padding: '10px 12px', borderRadius: 9,
          background: `${C.blue}12`, border: `1px solid ${C.blue}33`,
          opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(6px)',
          transition: `all ${500 + i * 150}ms ease`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: C.ink }}>{v.dep}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: v.color }}>{v.vote}</span>
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{v.prop}</div>
        </div>
      ))}
    </div>
  )
}

// Slide Q3-2: extração de tema do título
function Q3S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const examples = [
    { text: 'PL 1234 — Reforma tributária e fiscal', keyword: 'tributária', tema: 'Economia' },
    { text: 'PL 5678 — Código Penal, segurança pública', keyword: 'segurança', tema: 'Segurança' },
    { text: 'PL 9012 — Proteção de áreas de preservação', keyword: 'preservação', tema: 'Meio Ambiente' },
  ]
  const temaColors: Record<string, string> = {
    'Economia': C.orange, 'Segurança': C.red, 'Meio Ambiente': C.green,
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        Palavras-chave no título → classificação por tema:
      </div>
      {examples.map((e, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, lineHeight: 1.4 }}>
            {phase >= 1
              ? e.text.replace(e.keyword, `[${e.keyword}]`)
              : e.text}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: phase >= 2 ? 1 : 0, transition: 'opacity 600ms ease',
          }}>
            <span style={{ fontSize: 9, color: C.muted }}>→ tema:</span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: temaColors[e.tema],
              background: `${temaColors[e.tema]}18`,
              padding: '2px 8px', borderRadius: 999,
              border: `1px solid ${temaColors[e.tema]}55`,
            }}>{e.tema}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Slide Q3-3: contagem por tema
function Q3S3() {
  const temas = [
    { name: 'Economia',      count: 312, color: C.orange },
    { name: 'Segurança',     count: 198, color: C.red },
    { name: 'Saúde',         count: 165, color: C.teal },
    { name: 'Meio Ambiente', count: 134, color: C.green },
    { name: 'Educação',      count: 121, color: C.purple },
  ]
  const max = 350
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, temas.length)), 250)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
        Proposições classificadas por tema (2023–2026):
      </div>
      {temas.map((t, i) => (
        <div key={i} style={{ marginBottom: 10, opacity: shown > i ? 1 : 0.1, transition: 'opacity 400ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
            <span style={{ color: C.ink }}>{t.name}</span>
            <span style={{ fontFamily: 'monospace', color: t.color }}>{t.count} votações</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: shown > i ? `${(t.count / max) * 100}%` : '0%',
              background: t.color,
              opacity: 0.8,
              borderRadius: 5,
              transition: 'width 600ms ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Slide Q3-4: votos por tema + partido
function Q3S4() {
  const W = 520, H = 180
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const data = [
    { party: 'PT',   eco: 82, seg: 34 },
    { party: 'PL',   eco: 71, seg: 91 },
    { party: 'MDB',  eco: 65, seg: 61 },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <text x={30} y={22} fontSize={10} fill={C.muted}>% votos SIM por tema e partido</text>

      {/* Legend */}
      <rect x={320} y={10} width={10} height={10} rx={2} fill={C.orange} />
      <text x={334} y={20} fontSize={9} fill={C.ink}>Economia</text>
      <rect x={390} y={10} width={10} height={10} rx={2} fill={C.red} />
      <text x={404} y={20} fontSize={9} fill={C.ink}>Segurança</text>

      {data.map((d, i) => {
        const y = 40 + i * 42
        return (
          <g key={i}>
            <text x={30} y={y + 18} fontSize={10} fill={C.ink}>{d.party}</text>
            {/* Eco bar */}
            <rect x={80} y={y} width={phase >= 1 ? (d.eco / 100) * 200 : 0} height={14} rx={3}
              fill={C.orange} fillOpacity={0.7}
              style={{ transition: 'width 700ms ease' }} />
            <text x={84 + (phase >= 1 ? (d.eco / 100) * 200 : 0)} y={y + 10} fontSize={8} fill={C.orange}>
              {phase >= 1 ? `${d.eco}%` : ''}
            </text>
            {/* Seg bar */}
            <rect x={80} y={y + 18} width={phase >= 2 ? (d.seg / 100) * 200 : 0} height={14} rx={3}
              fill={C.red} fillOpacity={0.7}
              style={{ transition: 'width 700ms ease' }} />
            <text x={84 + (phase >= 2 ? (d.seg / 100) * 200 : 0)} y={y + 28} fontSize={8} fill={C.red}>
              {phase >= 2 ? `${d.seg}%` : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Slide Q3-5: nuvem de palavras no painel
function Q3S5() {
  const words = [
    { word: 'economia', size: 22, x: 200, y: 80, color: C.orange },
    { word: 'saúde', size: 17, x: 100, y: 110, color: C.teal },
    { word: 'segurança', size: 19, x: 310, y: 95, color: C.red },
    { word: 'educação', size: 15, x: 150, y: 145, color: C.purple },
    { word: 'ambiente', size: 14, x: 350, y: 130, color: C.green },
    { word: 'tributação', size: 13, x: 90, y: 65, color: C.blue },
    { word: 'infraestrutura', size: 12, x: 270, y: 150, color: C.muted },
  ]
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, words.length)), 180)
    return () => clearInterval(iv)
  }, [])

  const W = 520, H = 190
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <rect x={10} y={10} width={500} height={170} rx={12}
        fill="rgba(22,28,38,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={26} y={30} fontSize={9} fill={C.blue} fontWeight="bold">
        Nuvem de Temas — Proposições votadas
      </text>
      {words.slice(0, shown).map((w, i) => (
        <text key={i} x={w.x} y={w.y}
          textAnchor="middle" fontSize={w.size} fill={w.color} fillOpacity={0.85}
          style={{ animation: 'wn-fade-in 400ms ease both' }}>
          {w.word}
        </text>
      ))}
    </svg>
  )
}

export function Q3Story() {
  return (
    <StoryShell testId="q3-story" slides={[
      {
        title: 'Ponto de partida: registros de votação',
        text: 'Cada votação nominal tem um título de proposição. Esses títulos são o insumo da classificação temática — precisamos descobrir o assunto de cada projeto.',
        component: <Q3S1 />,
      },
      {
        title: 'Extração: palavras-chave revelam o tema',
        text: 'O título da proposição é analisado em busca de palavras-chave associadas a categorias temáticas: "tributária" → Economia; "preservação" → Meio Ambiente. Quando não há match, o tema é "Outros".',
        component: <Q3S2 />,
      },
      {
        title: 'Agregação: contando votações por tema',
        text: 'Com todas as proposições classificadas, contamos quantas votações ocorreram em cada tema. Isso revela quais assuntos dominam a agenda legislativa.',
        component: <Q3S3 />,
      },
      {
        title: 'Comparação: como cada partido vota por tema',
        text: 'Cruzando tema com partido, calculamos o percentual de votos SIM de cada bancada por categoria. Diferenças acentuadas revelam posições ideológicas em áreas específicas.',
        component: <Q3S4 />,
      },
      {
        title: 'Resultado: nuvem temática no painel',
        text: 'Os temas mais frequentes aparecem maiores na nuvem de palavras. Clicar em um tema filtra as votações e mostra o alinhamento de cada partido naquela área.',
        component: <Q3S5 />,
      },
    ]} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q5 — Ranking de fornecedores
// Story: reembolsos brutos → normalização → agrupamento → ranking → dashboard
// ═══════════════════════════════════════════════════════════════════════════════

function Q5S1() {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t) }, [])
  const records = [
    { dep: '1001', val: 'R$ 850', cnpj: '12.345.678/0001-99', nome: 'Aéreas Brasil Ltda' },
    { dep: '1002', val: 'R$ 920', cnpj: '12.345.678/0001-99', nome: 'AEREAS BRASIL LTDA' },
    { dep: '1003', val: 'R$ 310', cnpj: '98.765.432/0001-11', nome: 'Hospedagem Boa Vista' },
  ]
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        Reembolsos brutos — note o mesmo CNPJ com nomes diferentes:
      </div>
      {records.map((r, i) => (
        <div key={i} style={{
          marginBottom: 7, padding: '9px 12px', borderRadius: 8,
          background: `${C.blue}12`, border: `1px solid ${C.blue}33`,
          opacity: show ? 1 : 0, transition: `opacity ${400 + i * 150}ms ease`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: C.ink }}>{r.nome}</span>
            <span style={{ color: C.orange, fontFamily: 'monospace' }}>{r.val}</span>
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
            CNPJ: {r.cnpj} · dep {r.dep}
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 10, fontSize: 10, color: C.orange, fontStyle: 'italic',
        opacity: show ? 1 : 0, transition: 'opacity 800ms ease',
      }}>
        ⚠ Mesmo CNPJ, nomes diferentes → precisam ser unificados
      </div>
    </div>
  )
}

function Q5S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const W = 500, H = 160
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* Before */}
      <rect x={20} y={30} width={180} height={100} rx={10}
        fill={`${C.orange}15`} stroke={`${C.orange}55`} strokeWidth={1.5} />
      <text x={110} y={50} textAnchor="middle" fontSize={9} fill={C.orange}>Antes</text>
      <text x={110} y={70} textAnchor="middle" fontSize={9} fill={C.ink}>Aéreas Brasil Ltda</text>
      <text x={110} y={88} textAnchor="middle" fontSize={9} fill={C.ink}>AEREAS BRASIL LTDA</text>
      <text x={110} y={106} textAnchor="middle" fontSize={9} fill={C.ink}>AÉREAS BRASIL LTDA.</text>
      <text x={110} y={118} textAnchor="middle" fontSize={8} fill={C.muted}>3 registros distintos</text>

      {/* Arrow */}
      <g opacity={phase >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <text x={250} y={70} textAnchor="middle" fontSize={9} fill={C.purple}>
          normalizar
        </text>
        <text x={250} y={84} textAnchor="middle" fontSize={9} fill={C.purple}>
          por CNPJ
        </text>
        <polygon points="300,80 315,74 315,86" fill={C.purple} />
      </g>

      {/* After */}
      <g opacity={phase >= 2 ? 1 : 0} style={{ transition: 'opacity 700ms ease' }}>
        <rect x={320} y={40} width={155} height={80} rx={10}
          fill={`${C.green}15`} stroke={`${C.green}55`} strokeWidth={1.5} />
        <text x={397} y={62} textAnchor="middle" fontSize={9} fill={C.green}>Depois</text>
        <text x={397} y={82} textAnchor="middle" fontSize={9} fill={C.ink}>Aéreas Brasil Ltda</text>
        <text x={397} y={100} textAnchor="middle" fontSize={8} fill={C.green}>
          ✓ 1 entidade unificada
        </text>
      </g>
    </svg>
  )
}

function Q5S3() {
  const suppliers = [
    { name: 'Aéreas Brasil Ltda',  total: 284500, deps: 42 },
    { name: 'Hotel Nobre S.A.',    total: 197800, deps: 31 },
    { name: 'Telecom Corp Ltda',   total: 156300, deps: 58 },
    { name: 'Combustíveis RO Ltda',total: 132100, deps: 19 },
  ]
  const max = 300000
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, suppliers.length)), 280)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        SUM(valor) GROUP BY cnpj_fornecedor:
      </div>
      {suppliers.map((s, i) => (
        <div key={i} style={{ marginBottom: 12, opacity: shown > i ? 1 : 0.1, transition: 'opacity 400ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
            <span style={{ color: C.ink }}>{s.name}</span>
            <span style={{ color: C.muted, fontSize: 9 }}>{s.deps} deputados</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: shown > i ? `${(s.total / max) * 100}%` : '0%',
              background: `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
              borderRadius: 5, transition: 'width 650ms ease',
            }} />
          </div>
          <div style={{ fontSize: 9, color: C.teal, marginTop: 2, fontFamily: 'monospace' }}>
            {shown > i ? `R$ ${(s.total / 1000).toFixed(0)}k` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

function Q5S4() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, 4)), 300)
    return () => clearInterval(iv)
  }, [])
  const items = [
    { rank: 1, name: 'Aéreas Brasil Ltda',   total: 'R$ 284k', deps: 42, cat: 'Passagens' },
    { rank: 2, name: 'Hotel Nobre S.A.',      total: 'R$ 198k', deps: 31, cat: 'Hospedagem' },
    { rank: 3, name: 'Telecom Corp Ltda',     total: 'R$ 156k', deps: 58, cat: 'Telefonia' },
  ]
  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 8px' }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
          padding: '11px 14px', borderRadius: 10,
          background: i === 0 ? `${C.teal}18` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${i === 0 ? `${C.teal}44` : 'rgba(255,255,255,0.08)'}`,
          opacity: shown > i ? 1 : 0,
          transform: shown > i ? 'translateY(0)' : 'translateY(6px)',
          transition: 'all 500ms ease',
        }}>
          <span style={{ fontSize: 18, minWidth: 28 }}>
            {['🏆', '🥈', '🥉'][i]}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.ink }}>{it.name}</div>
            <div style={{ fontSize: 9, color: C.muted }}>{it.cat} · {it.deps} deputados atendidos</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.teal }}>{it.total}</span>
        </div>
      ))}
    </div>
  )
}

function Q5S5() {
  const W = 520, H = 185
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const cards = [
    { name: 'Aéreas Brasil', val: 'R$ 284k', deps: '42 deps', color: C.teal },
    { name: 'Hotel Nobre',   val: 'R$ 198k', deps: '31 deps', color: C.blue },
    { name: 'Telecom Corp',  val: 'R$ 156k', deps: '58 deps', color: C.purple },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <rect x={10} y={10} width={500} height={165} rx={12}
        fill="rgba(22,28,38,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={28} y={32} fontSize={10} fill={C.teal} fontWeight="bold">
        Fornecedores com maior total recebido
      </text>
      <line x1={28} y1={38} x2={484} y2={38} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      {cards.map((c, i) => (
        <g key={i} opacity={phase >= (i === 0 ? 1 : 2) ? 1 : 0}
          style={{ transition: `opacity ${500 + i * 100}ms ease` }}>
          <rect x={28 + i * 162} y={50} width={148} height={100} rx={10}
            fill={`${c.color}15`} stroke={`${c.color}44`} strokeWidth={1.5} />
          <text x={102 + i * 162} y={76} textAnchor="middle" fontSize={10} fill={c.color} fontWeight="bold">
            {c.name}
          </text>
          <text x={102 + i * 162} y={100} textAnchor="middle" fontSize={13} fill={C.ink} fontWeight="bold">
            {c.val}
          </text>
          <text x={102 + i * 162} y={120} textAnchor="middle" fontSize={9} fill={C.muted}>
            {c.deps}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function Q5Story() {
  return (
    <StoryShell testId="q5-story" slides={[
      {
        title: 'O problema: nomes inconsistentes',
        text: 'A mesma empresa pode aparecer com grafias diferentes nos registros de reembolso. Se não tratarmos isso, cada variação conta como um fornecedor separado — distorcendo o ranking.',
        component: <Q5S1 />,
      },
      {
        title: 'Normalização: CNPJ como chave única',
        text: 'Usamos o CNPJ/CPF como identificador canônico do fornecedor. Independente de como o nome aparece no texto, o CNPJ é estável. Todas as variações são agrupadas sob o nome mais frequente.',
        component: <Q5S2 />,
      },
      {
        title: 'Agrupamento: somando por fornecedor',
        text: 'Com os CNPJs normalizados, somamos o total pago a cada fornecedor e contamos quantos deputados diferentes o utilizaram. Essa dupla informação revela tanto o volume financeiro quanto o alcance.',
        component: <Q5S3 />,
      },
      {
        title: 'Ranking: maiores recebedores',
        text: 'Os fornecedores são ordenados pelo total recebido. Empresas de passagens aéreas dominam o topo — reflexo do alto custo de deslocamento de parlamentares de estados distantes.',
        component: <Q5S4 />,
      },
      {
        title: 'Resultado: cards interativos no painel',
        text: 'Cada fornecedor aparece como um card com total recebido, número de deputados atendidos e categoria. Você pode clicar para ver quais parlamentares utilizaram cada empresa.',
        component: <Q5S5 />,
      },
    ]} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 — Índice custo-benefício
// Story: produção + gastos → ajuste → score → ranking
// ═══════════════════════════════════════════════════════════════════════════════

function Q7S1() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const W = 500, H = 190
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* Produção box */}
      <rect x={30} y={55} width={160} height={80} rx={12}
        fill={`${C.green}18`} stroke={`${C.green}66`} strokeWidth={1.5} />
      <text x={110} y={82} textAnchor="middle" fontSize={10} fill={C.green} fontWeight="bold">
        Produção
      </text>
      <text x={110} y={100} textAnchor="middle" fontSize={9} fill={C.ink}>proposições</text>
      <text x={110} y={116} textAnchor="middle" fontSize={9} fill={C.ink}>aprovadas</text>

      {/* Plus */}
      <g opacity={phase >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <text x={220} y={100} textAnchor="middle" fontSize={22} fill={C.ink} opacity="0.4">+</text>
      </g>

      {/* Gastos box */}
      <g opacity={phase >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <rect x={250} y={55} width={160} height={80} rx={12}
          fill={`${C.red}18`} stroke={`${C.red}66`} strokeWidth={1.5} />
        <text x={330} y={82} textAnchor="middle" fontSize={10} fill={C.red} fontWeight="bold">
          Gastos
        </text>
        <text x={330} y={100} textAnchor="middle" fontSize={9} fill={C.ink}>total CEAP</text>
        <text x={330} y={116} textAnchor="middle" fontSize={9} fill={C.ink}>por deputado</text>
      </g>

      {/* Arrow down */}
      <g opacity={phase >= 2 ? 1 : 0} style={{ transition: 'opacity 700ms ease' }}>
        <polygon points="220,150 215,165 225,165" fill={C.orange} />
        <text x={220} y={182} textAnchor="middle" fontSize={9} fill={C.orange}>
          Índice custo-benefício
        </text>
      </g>
    </svg>
  )
}

function Q7S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10,
        background: 'rgba(13,17,23,0.6)', border: `1px solid ${C.blue}44`,
        fontFamily: 'monospace', fontSize: 12, color: C.ink, lineHeight: 1.8 }}>
        <span style={{ color: C.orange }}>score</span> ={' '}
        <span style={{ color: C.green }}>proposições_aprovadas</span>{' '}
        <span style={{ color: C.ink }}>÷</span>{' '}
        <span style={{ color: C.red }}>gasto_total</span>
      </div>

      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
        Exemplos práticos:
      </div>

      {[
        { dep: 'Dep. A', props: 12, gasto: 45000, score: '0,27', good: true },
        { dep: 'Dep. B', props:  3, gasto: 85000, score: '0,035', good: false },
      ].map((d, i) => (
        <div key={i} style={{
          marginBottom: 8, padding: '10px 14px', borderRadius: 9,
          background: d.good ? `${C.green}12` : `${C.red}12`,
          border: `1px solid ${d.good ? C.green : C.red}44`,
          opacity: phase >= i + 1 ? 1 : 0, transition: `opacity 600ms ease`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: C.ink, fontWeight: 700 }}>{d.dep}</span>
            <span style={{ color: d.good ? C.green : C.red, fontFamily: 'monospace' }}>
              score: {d.score}
            </span>
          </div>
          <div style={{ fontSize: 9, color: C.muted }}>
            {d.props} proposições aprovadas · R$ {(d.gasto / 1000).toFixed(0)}k gastos
          </div>
        </div>
      ))}
    </div>
  )
}

function Q7S3() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setShown(n => Math.min(n + 1, 5)), 250)
    return () => clearInterval(iv)
  }, [])
  const deps = [
    { name: 'Dep. Martins', score: 0.42, props: 18, gasto: 'R$ 42k' },
    { name: 'Dep. Fonseca', score: 0.35, props: 14, gasto: 'R$ 40k' },
    { name: 'Dep. Aguiar',  score: 0.27, props: 12, gasto: 'R$ 44k' },
    { name: 'Dep. Braga',   score: 0.14, props:  8, gasto: 'R$ 56k' },
    { name: 'Dep. Cunha',   score: 0.04, props:  3, gasto: 'R$ 72k' },
  ]
  const max = 0.45

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        ORDER BY score DESC:
      </div>
      {deps.map((d, i) => (
        <div key={i} style={{ marginBottom: 10, opacity: shown > i ? 1 : 0.1, transition: 'opacity 400ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
            <span style={{ color: C.ink }}>{d.name}</span>
            <span style={{ color: C.muted, fontSize: 9 }}>{d.props} props · {d.gasto}</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: shown > i ? `${(d.score / max) * 100}%` : '0%',
              background: `linear-gradient(90deg, ${C.green}, ${C.teal})`,
              borderRadius: 5, transition: 'width 600ms ease',
            }} />
          </div>
          <div style={{ fontSize: 9, color: C.green, marginTop: 2, fontFamily: 'monospace' }}>
            {shown > i ? `score: ${d.score}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

function Q7S4() {
  const W = 500, H = 200
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Scatter plot: x = gasto, y = produção
  const deps = [
    { x: 0.2, y: 0.8, name: 'A', color: C.green },
    { x: 0.5, y: 0.5, name: 'B', color: C.orange },
    { x: 0.8, y: 0.2, name: 'C', color: C.red },
    { x: 0.3, y: 0.6, name: 'D', color: C.green },
    { x: 0.7, y: 0.3, name: 'E', color: C.red },
  ]
  const PAD = 50, CW = W - 2 * PAD, CH = 130
  const px = (v: number) => PAD + v * CW
  const py = (v: number) => PAD + 10 + (1 - v) * CH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* Axes */}
      <g opacity={phase >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <line x1={PAD} y1={PAD + 10} x2={PAD} y2={PAD + 10 + CH}
          stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <line x1={PAD} y1={PAD + 10 + CH} x2={PAD + CW} y2={PAD + 10 + CH}
          stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <text x={PAD - 6} y={PAD + 14} textAnchor="end" fontSize={8} fill={C.green}>Alto</text>
        <text x={PAD - 6} y={PAD + 10 + CH} textAnchor="end" fontSize={8} fill={C.red}>Baixo</text>
        <text x={PAD} y={PAD + 10 + CH + 16} fontSize={8} fill={C.red}>Baixo gasto</text>
        <text x={PAD + CW} y={PAD + 10 + CH + 16} textAnchor="end" fontSize={8} fill={C.red}>Alto gasto</text>
        <text x={PAD - 8} y={PAD + 10 + CH / 2} textAnchor="middle" fontSize={8} fill={C.muted}
          transform={`rotate(-90, ${PAD - 8}, ${PAD + 10 + CH / 2})`}>Produção</text>
      </g>

      {/* Dots */}
      {deps.map((d, i) => (
        <g key={i} opacity={phase >= 2 ? 1 : 0}
          style={{ transition: `opacity ${400 + i * 100}ms ease` }}>
          <circle cx={px(d.x)} cy={py(d.y)} r={10}
            fill={d.color} fillOpacity={0.8} stroke="white" strokeWidth={1} />
          <text x={px(d.x)} y={py(d.y) + 4} textAnchor="middle" fontSize={8}
            fill="white" fontWeight="bold">{d.name}</text>
        </g>
      ))}

      {/* Diagonal guide */}
      <g opacity={phase >= 2 ? 1 : 0} style={{ transition: 'opacity 800ms ease' }}>
        <line x1={px(0.1)} y1={py(0.9)} x2={px(0.9)} y2={py(0.1)}
          stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={px(0.2)} y={py(0.75)} fontSize={7} fill="rgba(255,255,255,0.35)">
          melhor custo-benefício ↗
        </text>
      </g>
    </svg>
  )
}

export function Q7Story() {
  return (
    <StoryShell testId="q7-story" slides={[
      {
        title: 'Dois ingredientes: produção e gasto',
        text: 'O índice custo-benefício responde: quem faz mais com menos? Para isso, combinamos duas métricas — a produção legislativa de cada deputado (proposições aprovadas) e o total de gastos com a CEAP.',
        component: <Q7S1 />,
      },
      {
        title: 'A fórmula: produção ÷ gasto',
        text: 'Score alto = muitas proposições aprovadas com gasto relativamente baixo. Score baixo = pouca produção com alto gasto. O índice penaliza quem gasta muito e entrega pouco.',
        component: <Q7S2 />,
      },
      {
        title: 'Ranking: do mais eficiente ao menos',
        text: 'Os deputados são ordenados pelo score. Parlamentares de estados próximos a Brasília tendem a ter custo de deslocamento menor, o que favorece o score — isso deve ser considerado na interpretação.',
        component: <Q7S3 />,
      },
      {
        title: 'Visualizando: o mapa produção × gasto',
        text: 'No canto superior esquerdo estão os mais eficientes: alta produção, baixo gasto. No inferior direito, o oposto. Deputados próximos à diagonal têm relação equilibrada.',
        component: <Q7S4 />,
      },
    ]} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q10 — Alinhamento e posicionamento partidário
// Story: votos → matriz → estimação → mapa ideológico
// ═══════════════════════════════════════════════════════════════════════════════

function Q10S1() {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t) }, [])

  const votes = [
    { dep: 'Dep. A', party: 'PT', vote: 'SIM', orient: 'SIM', align: true },
    { dep: 'Dep. B', party: 'PT', vote: 'NÃO', orient: 'SIM', align: false },
    { dep: 'Dep. C', party: 'PL', vote: 'NÃO', orient: 'NÃO', align: true },
    { dep: 'Dep. D', party: 'PL', vote: 'SIM', orient: 'NÃO', align: false },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        Cada voto tem: deputado, partido, voto emitido e orientação da bancada:
      </div>
      {votes.map((v, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          padding: '8px 12px', borderRadius: 8,
          background: v.align ? `${C.green}10` : `${C.red}10`,
          border: `1px solid ${v.align ? C.green : C.red}33`,
          opacity: show ? 1 : 0,
          transition: `opacity ${300 + i * 150}ms ease`,
        }}>
          <span style={{ fontSize: 10, color: C.ink, minWidth: 72 }}>{v.dep}</span>
          <span style={{ fontSize: 9, color: C.muted, minWidth: 32 }}>{v.party}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: v.vote === 'SIM' ? C.green : C.red, minWidth: 32 }}>
            {v.vote}
          </span>
          <span style={{ fontSize: 9, color: C.muted }}>orient: {v.orient}</span>
          <span style={{ marginLeft: 'auto', fontSize: 9,
            color: v.align ? C.green : C.red, fontWeight: 700 }}>
            {v.align ? '✓ alinhado' : '✗ contrário'}
          </span>
        </div>
      ))}
    </div>
  )
}

function Q10S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const W = 500, H = 185
  const parties = ['PT', 'PL', 'MDB', 'UNIÃO']
  const pct = [72, 91, 68, 84]
  const colors = [C.red, C.blue, C.teal, C.orange]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <text x={30} y={22} fontSize={10} fill={C.muted}>
        pct_alinhamento = votos_alinhados ÷ total_votos_com_diretriz × 100
      </text>
      {parties.map((p, i) => {
        const y = 38 + i * 33
        return (
          <g key={i} opacity={phase >= 1 ? 1 : 0} style={{ transition: `opacity ${400 + i * 150}ms ease` }}>
            <text x={30} y={y + 16} fontSize={10} fill={C.ink}>{p}</text>
            <rect x={80} y={y} width={phase >= 2 ? (pct[i] / 100) * 340 : 0} height={20} rx={4}
              fill={colors[i]} fillOpacity={0.7}
              style={{ transition: 'width 700ms ease' }} />
            <text x={84 + (phase >= 2 ? (pct[i] / 100) * 340 : 0)} y={y + 14}
              fontSize={9} fill={colors[i]}>
              {phase >= 2 ? `${pct[i]}%` : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Q10S3() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const W = 500, H = 190
  const PAD = 50
  const cx = W / 2, cy = H / 2 + 10
  const sc = (W - 2 * PAD) / 2

  const parties = [
    { x: -0.75, name: 'PT',    pct: 72, color: C.red },
    { x: -0.2,  name: 'PSB',   pct: 78, color: '#ff8a65' },
    { x:  0.1,  name: 'MDB',   pct: 68, color: C.teal },
    { x:  0.55, name: 'PL',    pct: 91, color: C.blue },
    { x:  0.82, name: 'NOVO',  pct: 88, color: C.orange },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {/* Axis */}
      <g opacity={phase >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease' }}>
        <defs>
          <linearGradient id="q10-ax" x1="0%" x2="100%">
            <stop offset="0%" stopColor={C.red} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect x={PAD} y={cy - 8} width={W - 2 * PAD} height={16} rx={8} fill="url(#q10-ax)" />
        <text x={PAD + 4} y={cy - 14} fontSize={9} fill={C.red}>◀ Esquerda</text>
        <text x={W - PAD - 4} y={cy - 14} textAnchor="end" fontSize={9} fill={C.blue}>Direita ▶</text>
      </g>

      {/* Party dots */}
      {parties.map((p, i) => {
        const px = cx + p.x * sc
        return (
          <g key={i} opacity={phase >= 2 ? 1 : 0}
            style={{ transition: `opacity ${500 + i * 100}ms ease` }}>
            <circle cx={px} cy={cy} r={14} fill={p.color} fillOpacity={0.85}
              stroke="white" strokeWidth={1.5} />
            <text x={px} y={cy + 4} textAnchor="middle" fontSize={8}
              fill="white" fontWeight="bold">{p.name}</text>
            <text x={px} y={cy + 28} textAnchor="middle" fontSize={8} fill={p.color}>
              {p.pct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Q10S4() {
  const W = 520, H = 190
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <rect x={10} y={10} width={500} height={170} rx={12}
        fill="rgba(22,28,38,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={26} y={32} fontSize={10} fill={C.blue} fontWeight="bold">
        Ranking de Alinhamento Partidário
      </text>
      <line x1={26} y1={38} x2={484} y2={38} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

      {[
        { party: 'PL',    pct: '91%', color: C.blue,   pos: 1 },
        { party: 'NOVO',  pct: '88%', color: C.orange,  pos: 2 },
        { party: 'PSB',   pct: '78%', color: '#ff8a65', pos: 3 },
        { party: 'PT',    pct: '72%', color: C.red,     pos: 4 },
        { party: 'MDB',   pct: '68%', color: C.teal,    pos: 5 },
      ].map((r, i) => (
        <g key={i} opacity={phase >= (i < 2 ? 1 : 2) ? 1 : 0}
          style={{ transition: `opacity ${400 + i * 120}ms ease` }}>
          <text x={42} y={60 + i * 24} fontSize={10} fill={C.muted}>{r.pos}</text>
          <text x={62} y={60 + i * 24} fontSize={10} fill={C.ink}>{r.party}</text>
          <rect x={110} y={48 + i * 24} width={(parseInt(r.pct) / 100) * 320} height={12} rx={3}
            fill={r.color} fillOpacity={0.7} />
          <text x={116 + (parseInt(r.pct) / 100) * 320} y={60 + i * 24}
            fontSize={8} fill={r.color}>{r.pct}</text>
        </g>
      ))}
    </svg>
  )
}

export function Q10Story() {
  return (
    <StoryShell testId="q10-story" slides={[
      {
        title: 'O que mede o alinhamento partidário',
        text: 'Alinhamento partidário é a proporção de vezes que um deputado votou igual à orientação da sua bancada. Quanto mais alto, mais disciplinado é o parlamentar — ou mais coeso é o partido.',
        component: <Q10S1 />,
      },
      {
        title: 'O cálculo: votos alinhados ÷ total',
        text: 'Contamos apenas votações em que o partido emitiu diretriz clara (Sim ou Não). Abstenções, obstruções e "Liberado" são excluídos do denominador — não há posição oficial a seguir.',
        component: <Q10S2 />,
      },
      {
        title: 'Posicionando partidos no espectro',
        text: 'Cada partido ocupa uma posição no eixo ideológico (escala Bolognesi). A combinação de posição ideológica com percentual de alinhamento revela o perfil de disciplina de cada campo.',
        component: <Q10S3 />,
      },
      {
        title: 'Resultado: ranking no painel',
        text: 'O painel mostra os partidos ordenados por alinhamento, com cores por campo ideológico. Você pode filtrar por ano e ver como a disciplina varia ao longo da legislatura.',
        component: <Q10S4 />,
      },
    ]} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q14 — Coesão interna de bancada
// Story: votos → concordância → coesão → visualização
// ═══════════════════════════════════════════════════════════════════════════════

function Q14S1() {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t) }, [])

  const deps = [
    { name: 'A', votes: ['S', 'S', 'N', 'S'] },
    { name: 'B', votes: ['S', 'S', 'N', 'N'] },
    { name: 'C', votes: ['S', 'N', 'N', 'S'] },
    { name: 'D', votes: ['N', 'S', 'N', 'S'] },
  ]
  const voteColor = (v: string) => v === 'S' ? C.green : C.red

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        4 deputados do mesmo partido, 4 votações:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(4, 1fr)', gap: 4 }}>
        <div style={{ fontSize: 9, color: C.muted }} />
        {['V1', 'V2', 'V3', 'V4'].map(v => (
          <div key={v} style={{ textAlign: 'center', fontSize: 9, color: C.muted }}>{v}</div>
        ))}
        {deps.map((d, i) => (
          <div key={`row${i}`} style={{ display: 'contents' }}>
            <div style={{
              fontSize: 10, color: C.ink, display: 'flex', alignItems: 'center',
              opacity: show ? 1 : 0, transition: `opacity ${300 + i * 150}ms ease`,
            }}>
              Dep. {d.name}
            </div>
            {d.votes.map((v, j) => (
              <div key={`${i}${j}`} style={{
                textAlign: 'center', padding: '6px 0', borderRadius: 6,
                background: `${voteColor(v)}20`,
                border: `1px solid ${voteColor(v)}55`,
                fontSize: 10, fontWeight: 700, color: voteColor(v),
                opacity: show ? 1 : 0,
                transition: `opacity ${400 + i * 150 + j * 80}ms ease`,
              }}>{v}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Q14S2() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const W = 500, H = 185
  // Agreement matrix: deps A,B,C,D
  const names = ['A', 'B', 'C', 'D']
  // A vs others: B=75%, C=50%, D=50%
  // B vs C: 50%, B vs D: 50%, C vs D: 75%
  const matrix = [
    [100, 75, 50, 50],
    [75, 100, 50, 50],
    [50, 50, 100, 75],
    [50, 50, 75, 100],
  ]
  const cellColor = (v: number) => {
    if (v === 100) return C.purple
    if (v >= 75)  return C.green
    if (v >= 50)  return C.orange
    return C.red
  }

  const cellSize = 55, startX = 110, startY = 30

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <text x={10} y={18} fontSize={9} fill={C.muted}>
        % de votos iguais entre cada par de deputados:
      </text>

      {names.map((n, i) => (
        <g key={i}>
          <text x={startX + i * cellSize + cellSize / 2} y={startY - 6}
            textAnchor="middle" fontSize={9} fill={C.ink}>Dep {n}</text>
          <text x={startX - 8} y={startY + i * cellSize + cellSize / 2 + 4}
            textAnchor="end" fontSize={9} fill={C.ink}>Dep {n}</text>
        </g>
      ))}

      {matrix.map((row, i) =>
        row.map((v, j) => (
          <g key={`${i}${j}`}
            opacity={phase >= 1 ? 1 : 0}
            style={{ transition: `opacity ${300 + (i * 4 + j) * 80}ms ease` }}>
            <rect x={startX + j * cellSize} y={startY + i * cellSize}
              width={cellSize - 4} height={cellSize - 4} rx={6}
              fill={`${cellColor(v)}25`} stroke={`${cellColor(v)}66`} strokeWidth={1} />
            <text x={startX + j * cellSize + (cellSize - 4) / 2}
              y={startY + i * cellSize + (cellSize - 4) / 2 + 4}
              textAnchor="middle" fontSize={11} fill={cellColor(v)} fontWeight="bold">
              {phase >= 2 ? `${v}%` : ''}
            </text>
          </g>
        ))
      )}
    </svg>
  )
}

function Q14S3() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 8px' }}>
      <div style={{
        padding: '14px 16px', borderRadius: 10, marginBottom: 16,
        background: 'rgba(13,17,23,0.6)', border: `1px solid ${C.blue}44`,
        fontFamily: 'monospace', fontSize: 11, color: C.ink, lineHeight: 2,
      }}>
        <div><span style={{ color: C.blue }}>score_bancada</span> = média dos scores W-NOMINATE do partido</div>
        <div><span style={{ color: C.purple }}>desvio_bancada</span> = score_deputado − score_bancada</div>
        <div><span style={{ color: C.green }}>coesão</span> = 10 − desvio_médio_absoluto</div>
      </div>

      {[
        { party: 'PT',    coesao: 8.7, desvio: 1.3, color: C.red },
        { party: 'PL',    coesao: 7.9, desvio: 2.1, color: C.blue },
        { party: 'MDB',   coesao: 6.2, desvio: 3.8, color: C.teal },
      ].map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
          padding: '9px 12px', borderRadius: 8,
          background: `${p.color}10`, border: `1px solid ${p.color}33`,
          opacity: phase >= 2 ? 1 : 0,
          transition: `opacity ${400 + i * 150}ms ease`,
        }}>
          <span style={{ fontSize: 11, color: C.ink, minWidth: 48, fontWeight: 700 }}>{p.party}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(p.coesao / 10) * 100}%`,
              background: p.color, opacity: 0.8, borderRadius: 4,
              transition: 'width 700ms ease',
            }} />
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: p.color, minWidth: 32 }}>
            {p.coesao}/10
          </span>
        </div>
      ))}
    </div>
  )
}

function Q14S4() {
  const W = 520, H = 190
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <rect x={10} y={10} width={500} height={170} rx={12}
        fill="rgba(22,28,38,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={26} y={32} fontSize={10} fill={C.purple} fontWeight="bold">
        Coesão Interna de Bancada
      </text>
      <line x1={26} y1={38} x2={484} y2={38} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

      {[
        { party: 'PDT',    coesao: 9.1, color: C.green },
        { party: 'PT',     coesao: 8.7, color: C.red },
        { party: 'PL',     coesao: 7.9, color: C.blue },
        { party: 'PSOL',   coesao: 7.3, color: C.teal },
        { party: 'MDB',    coesao: 6.2, color: C.orange },
      ].map((p, i) => (
        <g key={i} opacity={phase >= (i < 3 ? 1 : 2) ? 1 : 0}
          style={{ transition: `opacity ${400 + i * 120}ms ease` }}>
          <text x={42} y={58 + i * 24} fontSize={9} fill={C.muted}>{i + 1}.</text>
          <text x={60} y={58 + i * 24} fontSize={10} fill={C.ink}>{p.party}</text>
          <rect x={110} y={46 + i * 24} width={(p.coesao / 10) * 330} height={12} rx={3}
            fill={p.color} fillOpacity={0.75} />
          <text x={114 + (p.coesao / 10) * 330} y={58 + i * 24}
            fontSize={8} fill={p.color}>{p.coesao}/10</text>
        </g>
      ))}
    </svg>
  )
}

export function Q14Story() {
  return (
    <StoryShell testId="q14-story" slides={[
      {
        title: 'O que é coesão interna de bancada',
        text: 'Coesão interna mede o quanto os deputados de um mesmo partido votam de forma parecida entre si — independente de seguir ou não a orientação da liderança. Alta coesão = bancada homogênea. Baixa coesão = bancada heterogênea.',
        component: <Q14S1 />,
      },
      {
        title: 'A matriz de concordância par-a-par',
        text: 'Para cada par de deputados do mesmo partido, calculamos a porcentagem de votações em que emitiram o mesmo voto. Isso cria uma matriz de similaridade dentro da bancada.',
        component: <Q14S2 />,
      },
      {
        title: 'O índice de coesão: 0 a 10',
        text: 'Usamos os scores W-NOMINATE de cada deputado. O desvio médio absoluto em relação à média da bancada mede a dispersão. O índice de coesão é 10 − desvio_médio_absoluto: 10 = bancada perfeitamente unida.',
        component: <Q14S3 />,
      },
      {
        title: 'Resultado: ranking de coesão no painel',
        text: 'Partidos são ordenados do mais coeso ao mais heterogêneo. Legendas menores e mais ideologicamente definidas tendem a ter coesão mais alta. Partidos de centro frequentemente abrigam perfis mais variados.',
nt: <Q14S4 />,
      },
    ]} />
  )
}
