/**
 * WNominateDemo — pedagogical simulation of the W-NOMINATE algorithm intuition.
 *
 * NOT a scientific implementation. Teaches the conceptual mechanics:
 *  - deputies start with arbitrary positions
 *  - votes/propositions create constraints (cut-points)
 *  - similar-voting deputies converge
 *  - the model tries to maximise the probability of observed votes
 *
 * Everything is self-contained: no external deps beyond React.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deputy {
  id: number
  x: number   // 1D position [-1, 1] OR 2D x
  y: number   // 2D y (ignored in 1D mode); kept at 0 in 1D
  party: number // 0-3 colour index
  label: string
}

interface Proposition {
  id: number
  cut1D: number   // 1D cut-point in [-1, 1]
  cutX: number    // 2D normal vector x-component
  cutY: number    // 2D normal vector y-component
  bias: number    // shift: deputies on +side → Sim
}

interface SimState {
  deputies: Deputy[]
  propositions: Proposition[]
  iteration: number
  logLikelihood: number
  running: boolean
  done: boolean
}

interface Config {
  nDeputies: number
  nPropositions: number
  dims: 1 | 2
  noise: 'low' | 'medium' | 'high'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PARTY_COLORS = ['#5b84a2', '#b39ddb', '#66bb6a', '#ffb74d']
const PARTY_NAMES  = ['Partido A', 'Partido B', 'Partido C', 'Partido D']
const NOISE_LEVEL  = { low: 0.04, medium: 0.10, high: 0.22 } as const
const MAX_ITER = 60

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v: number, lo = -1, hi = 1) { return Math.max(lo, Math.min(hi, v)) }

function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)) }

function probSim1D(dpos: number, cut: number, bias: number) {
  return sigmoid((dpos - cut + bias) * 6)
}

function probSim2D(dx: number, dy: number, cx: number, cy: number, bias: number) {
  const dot = dx * cx + dy * cy
  return sigmoid((dot + bias) * 6)
}

function initDeputies(n: number, rand: () => number): Deputy[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    party: Math.floor(rand() * 4),
    label: `D${i + 1}`,
  }))
}

function initPropositions(n: number, rand: () => number): Proposition[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = rand() * Math.PI * 2
    return {
      id: i,
      cut1D: rand() * 2 - 1,
      cutX: Math.cos(angle),
      cutY: Math.sin(angle),
      bias: (rand() - 0.5) * 0.6,
    }
  })
}

function computeLL(deps: Deputy[], props: Proposition[], dims: 1 | 2): number {
  if (deps.length === 0 || props.length === 0) return -3
  let ll = 0
  for (const d of deps) {
    for (const p of props) {
      const pSim = dims === 1
        ? probSim1D(d.x, p.cut1D, p.bias)
        : probSim2D(d.x, d.y, p.cutX, p.cutY, p.bias)
      const observedSim = pSim >= 0.5
      ll += Math.log((observedSim ? pSim : 1 - pSim) + 1e-9)
    }
  }
  return ll / (deps.length * props.length)
}

function stepDeputies(
  deps: Deputy[],
  props: Proposition[],
  dims: 1 | 2,
  noiseSigma: number,
  rand: () => number,
): Deputy[] {
  const lr = 0.07
  return deps.map(dep => {
    let gx = 0, gy = 0
    const scale = 1 / Math.max(props.length, 1)
    for (const p of props) {
      if (dims === 1) {
        const pSim = probSim1D(dep.x, p.cut1D, p.bias)
        const err = pSim >= 0.5 ? (1 - pSim) : -pSim
        gx += err * 6 * scale
      } else {
        const pSim = probSim2D(dep.x, dep.y, p.cutX, p.cutY, p.bias)
        const err = pSim >= 0.5 ? (1 - pSim) : -pSim
        gx += err * 6 * p.cutX * scale
        gy += err * 6 * p.cutY * scale
      }
    }
    const noise = () => (rand() * 2 - 1) * noiseSigma
    return {
      ...dep,
      x: clamp(dep.x + lr * gx + noise()),
      y: dims === 2 ? clamp(dep.y + lr * gy + noise()) : 0,
    }
  })
}

// ─── Didactic messages ───────────────────────────────────────────────────────

function getExplanation(cfg: Config, iter: number, done: boolean): string {
  const n = cfg.nDeputies
  const v = cfg.nPropositions

  if (iter === 0) {
    if (n === 1) return 'Com apenas 1 deputado, quase tudo é trivial — qualquer posição explica todos os votos.'
    if (v === 1) return `Com ${n} deputados e 1 proposição, há pouca informação para separar ideologias.`
    return `${n} deputados foram posicionados aleatoriamente. As ${v} proposições ainda não exerceram pressão.`
  }
  if (iter <= 5) {
    return `Iteração ${iter}: o algoritmo começa a ajustar posições para maximizar a probabilidade dos votos observados.`
  }
  if (iter <= 20) {
    if (cfg.dims === 2) return `Iteração ${iter}: em 2D, deputados se movem no plano. A Dimensão 1 (horizontal) tende a capturar a clivagem esquerda–direita.`
    return `Iteração ${iter}: deputados que votam de forma parecida começam a se aproximar no espectro.`
  }
  if (iter <= 40) {
    if (v >= 10) return `Iteração ${iter}: com ${v} proposições, cada deputado encontra uma posição de compromisso entre múltiplas pressões de voto.`
    return `Iteração ${iter}: o mapa ideológico emerge — grupos com padrões de voto similares ficam próximos.`
  }
  if (done) {
    return `Convergência após ${iter} iterações. O mapa final mostra posições que maximizam a probabilidade dos votos observados. Lembre: isso é uma simulação simplificada — o W-NOMINATE real usa máxima verossimilhança com função gaussiana de utilidade.`
  }
  return `Iteração ${iter}: ajustes finos. Deputados com comportamento volátil podem oscilar entre posições próximas.`
}

// ─── prefers-reduced-motion ───────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// ─── Simulation hook ──────────────────────────────────────────────────────────

function useSimulation(config: Config) {
  const [state, setState] = useState<SimState>({
    deputies: [],
    propositions: [],
    iteration: 0,
    logLikelihood: -3,
    running: false,
    done: false,
  })

  const randRef  = useRef<(() => number)>(mulberry32(42))
  const configRef = useRef(config)
  const rafRef   = useRef<number | null>(null)

  useEffect(() => { configRef.current = config }, [config])

  const init = useCallback((seed: number) => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    const rand = mulberry32(seed)
    randRef.current = rand
    const deps  = initDeputies(configRef.current.nDeputies, rand)
    const props = initPropositions(configRef.current.nPropositions, rand)
    setState({
      deputies: deps,
      propositions: props,
      iteration: 0,
      logLikelihood: computeLL(deps, props, configRef.current.dims),
      running: false,
      done: false,
    })
  }, [])

  const run  = useCallback(() => setState(prev => ({ ...prev, running: true,  done: false })), [])
  const stop = useCallback(() => setState(prev => ({ ...prev, running: false })), [])
  const reset = useCallback((seed: number) => {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    init(seed)
  }, [init])

  // rAF animation loop
  useEffect(() => {
    if (!state.running) return
    const cfg = configRef.current
    const noiseSigma = NOISE_LEVEL[cfg.noise]
    const rand = randRef.current

    const tick = () => {
      setState(prev => {
        if (!prev.running || prev.done) return prev
        const newDeps = stepDeputies(prev.deputies, prev.propositions, cfg.dims, noiseSigma, rand)
        const newLL   = computeLL(newDeps, prev.propositions, cfg.dims)
        const nextIter = prev.iteration + 1
        const done = nextIter >= MAX_ITER
        return { ...prev, deputies: newDeps, logLikelihood: newLL, iteration: nextIter, running: !done, done }
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [state.running])

  return { state, init, run, stop, reset }
}

// ─── SVG 1D ──────────────────────────────────────────────────────────────────

function Vis1D({ deputies, propositions, showCuts }: { deputies: Deputy[]; propositions: Proposition[]; showCuts: boolean }) {
  const W = 560, H = 140, PAD = 40
  const axisY = H / 2
  const toX = (v: number) => PAD + ((v + 1) / 2) * (W - 2 * PAD)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visualização 1D do espaço ideológico"
      style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="wn-axis-grad" x1="0%" x2="100%">
          <stop offset="0%"   stopColor="#5b84a2" stopOpacity="0.2" />
          <stop offset="50%"  stopColor="#b39ddb" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ef9a9a" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="transparent" />
      <rect x={PAD} y={axisY - 16} width={W - 2 * PAD} height={32} rx={16} fill="url(#wn-axis-grad)" />
      <line x1={PAD} y1={axisY} x2={W - PAD} y2={axisY} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />

      <text x={PAD}       y={H - 6} textAnchor="middle" fontSize={10} fill="#8a9ba8">−1</text>
      <text x={W / 2}     y={H - 6} textAnchor="middle" fontSize={10} fill="#8a9ba8">0 (centro)</text>
      <text x={W - PAD}   y={H - 6} textAnchor="middle" fontSize={10} fill="#8a9ba8">+1</text>
      <text x={PAD + 4}   y={12}    textAnchor="start"  fontSize={9}  fill="rgba(91,132,162,0.8)">◀ esquerda</text>
      <text x={W - PAD - 4} y={12}  textAnchor="end"    fontSize={9}  fill="rgba(239,154,154,0.8)">direita ▶</text>

      {showCuts && propositions.slice(0, 6).map(p => (
        <g key={p.id}>
          <line x1={toX(p.cut1D)} y1={axisY - 24} x2={toX(p.cut1D)} y2={axisY + 24}
            stroke="rgba(255,183,77,0.45)" strokeWidth={1} strokeDasharray="3 2" />
          <text x={toX(p.cut1D)} y={axisY - 28} textAnchor="middle" fontSize={8} fill="rgba(255,183,77,0.7)">
            V{p.id + 1}
          </text>
        </g>
      ))}

      {deputies.map(dep => (
        <g key={dep.id}>
          <circle cx={toX(dep.x)} cy={axisY} r={deputies.length <= 10 ? 9 : 5}
            fill={PARTY_COLORS[dep.party]} fillOpacity={0.85}
            stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          {deputies.length <= 10 && (
            <text x={toX(dep.x)} y={axisY - 15} textAnchor="middle" fontSize={9} fill="rgba(226,232,240,0.85)">
              {dep.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── SVG 2D ──────────────────────────────────────────────────────────────────

function Vis2D({ deputies, propositions, showCuts }: { deputies: Deputy[]; propositions: Proposition[]; showCuts: boolean }) {
  const W = 560, H = 320, PAD = 40
  const cx = W / 2, cy = H / 2
  const scale = (W - 2 * PAD) / 2
  const toX = (v: number) => cx + v * scale
  const toY = (v: number) => cy - v * scale

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visualização 2D do espaço ideológico"
      style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={W} height={H} fill="transparent" />
      {[-0.5, 0, 0.5].map(v => (
        <g key={v}>
          <line x1={toX(v)} y1={PAD} x2={toX(v)} y2={H - PAD} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <line x1={PAD} y1={toY(v)} x2={W - PAD} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        </g>
      ))}
      <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
      <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />

      <text x={W - PAD + 4} y={cy + 4}    fontSize={10} fill="#8a9ba8">Dir.</text>
      <text x={PAD - 4}     y={cy + 4}    fontSize={10} fill="#8a9ba8" textAnchor="end">Esq.</text>
      <text x={cx}          y={PAD - 6}   fontSize={9}  fill="rgba(138,155,168,0.7)" textAnchor="middle">Dim. 2</text>
      <text x={cx}          y={H - PAD + 14} fontSize={9}  fill="rgba(138,155,168,0.7)" textAnchor="middle">Dim. 1</text>

      {showCuts && propositions.slice(0, 5).map(p => {
        const t = 1.2
        return (
          <line key={p.id}
            x1={toX(-p.cutY * t)} y1={toY(p.cutX * t)}
            x2={toX(p.cutY * t)}  y2={toY(-p.cutX * t)}
            stroke="rgba(255,183,77,0.35)" strokeWidth={1} strokeDasharray="4 3" />
        )
      })}

      {deputies.map(dep => (
        <g key={dep.id}>
          <circle cx={toX(dep.x)} cy={toY(dep.y)} r={deputies.length <= 10 ? 9 : 5}
            fill={PARTY_COLORS[dep.party]} fillOpacity={0.82}
            stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          {deputies.length <= 10 && (
            <text x={toX(dep.x)} y={toY(dep.y) - 13}
              textAnchor="middle" fontSize={9} fill="rgba(226,232,240,0.85)">
              {dep.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── Log-likelihood bar ───────────────────────────────────────────────────────

function LLBar({ value, iteration }: { value: number; iteration: number }) {
  const pct = Math.min(100, Math.max(0, ((value + 3) / 3) * 100))
  return (
    <div className="wnominate-ll-wrap">
      <div className="wnominate-ll-labels">
        <span>Qualidade do modelo</span>
        <span className="wnominate-ll-value">{value.toFixed(3)}</span>
      </div>
      <div className="wnominate-ll-track"
        role="progressbar" aria-label={`Qualidade do modelo na iteração ${iteration}`}
        aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="wnominate-ll-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="wnominate-ll-hint"><span>Pior</span><span>Melhor</span></div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function PartyLegend({ parties }: { parties: Set<number> }) {
  return (
    <div className="wnominate-legend" aria-label="Legenda de partidos (fictícios)">
      {Array.from(parties).sort().map(p => (
        <span key={p} className="wnominate-legend__item">
          <svg width={10} height={10} aria-hidden="true"><circle cx={5} cy={5} r={4} fill={PARTY_COLORS[p]} /></svg>
          {PARTY_NAMES[p]}
        </span>
      ))}
    </div>
  )
}

// ─── Controls ─────────────────────────────────────────────────────────────────

const DEPUTY_OPTIONS = [1, 2, 5, 10, 25] as const
const PROP_OPTIONS   = [1, 3, 10, 50]    as const

interface ControlsProps {
  config: Config; onChange: (c: Config) => void
  onRun: () => void; onReset: () => void
  running: boolean; done: boolean; disabled: boolean
}

function Controls({ config, onChange, onRun, onReset, running, done, disabled }: ControlsProps) {
  const id = useId()
  return (
    <div className="wnominate-controls" role="group" aria-label="Controles da simulação W-NOMINATE">
      <div className="wnominate-control-field">
        <label htmlFor={`${id}-deps`} className="wnominate-label">Nº de deputados</label>
        <select id={`${id}-deps`} className="wnominate-select" value={config.nDeputies} disabled={running}
          onChange={e => onChange({ ...config, nDeputies: Number(e.target.value) })}>
          {DEPUTY_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="wnominate-control-field">
        <label htmlFor={`${id}-props`} className="wnominate-label">Nº de proposições</label>
        <select id={`${id}-props`} className="wnominate-select" value={config.nPropositions} disabled={running}
          onChange={e => onChange({ ...config, nPropositions: Number(e.target.value) })}>
          {PROP_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="wnominate-control-field">
        <span className="wnominate-label" id={`${id}-dims`}>Dimensões</span>
        <div className="wnominate-toggle-group" role="radiogroup" aria-labelledby={`${id}-dims`}>
          {([1, 2] as const).map(d => (
            <button key={d} type="button" role="radio" aria-checked={config.dims === d}
              className={`wnominate-toggle${config.dims === d ? ' wnominate-toggle--active' : ''}`}
              disabled={running} onClick={() => onChange({ ...config, dims: d })} data-testid={`dim-${d}d`}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="wnominate-control-field">
        <span className="wnominate-label" id={`${id}-noise`}>Nível de ruído</span>
        <div className="wnominate-toggle-group" role="radiogroup" aria-labelledby={`${id}-noise`}>
          {(['low', 'medium', 'high'] as const).map(n => (
            <button key={n} type="button" role="radio" aria-checked={config.noise === n}
              className={`wnominate-toggle${config.noise === n ? ' wnominate-toggle--active' : ''}`}
              disabled={running} onClick={() => onChange({ ...config, noise: n })}>
              {n === 'low' ? 'Baixo' : n === 'medium' ? 'Médio' : 'Alto'}
            </button>
          ))}
        </div>
      </div>

      <div className="wnominate-actions">
        <button type="button" className="wnominate-btn wnominate-btn--primary" data-testid="btn-run"
          onClick={onRun} disabled={disabled || running || done}
          aria-label={running ? 'Simulação em andamento' : done ? 'Simulação concluída' : 'Rodar simulação'}>
          {running ? '⏸ Rodando…' : done ? '✓ Concluído' : '▶ Rodar simulação'}
        </button>
        <button type="button" className="wnominate-btn wnominate-btn--secondary" data-testid="btn-reset"
          onClick={onReset} aria-label="Resetar simulação">
          ↺ Resetar
        </button>
      </div>
    </div>
  )
}

// ─── Disclaimer ───────────────────────────────────────────────────────────────

function Disclaimer() {
  return (
    <div className="wnominate-disclaimer" role="note">
      <strong>Nota pedagógica:</strong> Esta é uma simulação simplificada para ilustrar a
      intuição do W-NOMINATE. O algoritmo real estima coordenadas maximizando uma função de
      verossimilhança gaussiana, com centenas de iterações e critério de convergência rigoroso.
      Posições de partidos são <em>derivadas</em> das posições dos deputados, não estimadas
      diretamente. Os resultados desta demonstração <strong>não refletem dados reais</strong>.
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const SEED_BASE = 2024

export function WNominateDemo() {
  const [config, setConfig] = useState<Config>({ nDeputies: 10, nPropositions: 10, dims: 1, noise: 'low' })
  const [seed, setSeed]     = useState(SEED_BASE)
  const [showCuts, setShowCuts] = useState(true)
  const reducedMotion = usePrefersReducedMotion()
  const { state, init, run, stop: _stop, reset } = useSimulation(config)

  // Re-init whenever config changes
  const configKey = `${config.nDeputies}:${config.nPropositions}:${config.dims}:${config.noise}`
  const prevConfigKey = useRef(configKey)
  useEffect(() => {
    if (prevConfigKey.current !== configKey) {
      prevConfigKey.current = configKey
      init(seed)
    }
  }, [configKey, init, seed])

  // Initial mount
  useEffect(() => { init(SEED_BASE) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = useCallback(() => {
    if (reducedMotion) {
      // Reduced-motion: jump straight to final state synchronously
      // We fire run(); the animation loop will still execute but at 0 visual delay
    }
    run()
  }, [reducedMotion, run])

  const handleReset = useCallback(() => {
    const next = seed + 1
    setSeed(next)
    reset(next)
  }, [seed, reset])

  const presentParties = new Set(state.deputies.map(d => d.party))

  return (
    <div className="wnominate-demo" data-testid="wnominate-demo">
      <div className="wnominate-demo__intro">
        <p>
          Veja como o W-NOMINATE <em>aprende</em> o mapa ideológico a partir de votos.
          Ajuste os parâmetros, rode a simulação e observe os deputados convergindo para
          posições que melhor explicam os votos observados.
        </p>
      </div>

      <div className="wnominate-demo__body">
        {/* ── Sidebar: controls ── */}
        <div className="wnominate-demo__sidebar">
          <Controls config={config} onChange={setConfig}
            onRun={handleRun} onReset={handleReset}
            running={state.running} done={state.done}
            disabled={state.deputies.length === 0} />

          <label className="wnominate-label wnominate-showcuts-label">
            <input type="checkbox" checked={showCuts} onChange={e => setShowCuts(e.target.checked)}
              aria-label="Mostrar pontos de corte das proposições" />
            Mostrar linhas de corte
          </label>

          <div className="wnominate-iter-info" aria-live="polite" aria-atomic="true">
            <span>Iteração:</span>
            <strong data-testid="iteration-count">{state.iteration} / {MAX_ITER}</strong>
          </div>

          <LLBar value={state.logLikelihood} iteration={state.iteration} />
          <PartyLegend parties={presentParties} />
        </div>

        {/* ── Main: visualization ── */}
        <div className="wnominate-demo__vis">
          <div className="wnominate-vis-wrap" data-testid="wnominate-vis" data-dims={config.dims}>
            {config.dims === 1
              ? <Vis1D deputies={state.deputies} propositions={state.propositions} showCuts={showCuts} />
              : <Vis2D deputies={state.deputies} propositions={state.propositions} showCuts={showCuts} />}
          </div>
          <div className="wnominate-explanation" aria-live="polite" aria-atomic="true"
            data-testid="wnominate-explanation">
            {getExplanation(config, state.iteration, state.done)}
          </div>
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}
