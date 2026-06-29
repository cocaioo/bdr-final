/**
 * WNominateStory — apresentação narrativa e didática do algoritmo W-NOMINATE.
 * Projetada como uma aula de 5 minutos, focada em intuição visual.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PARTY_COLORS = ['#5b84a2', '#b39ddb', '#66bb6a', '#ffb74d', '#ef9a9a', '#80deea']
const PARTY_NAMES  = ['PT', 'PL', 'MDB', 'PP', 'PDT', 'UNIÃO']
const TOTAL_SLIDES = 11

// ─── Helpers Gerais ───────────────────────────────────────────────────────────

function makeRand(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(v: number, lo = -1, hi = 1) { return Math.max(lo, Math.min(hi, v)) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

const SVG_STYLE = { width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' } as const

// Eixo 1D padrão reutilizado nos slides
function Axis1D({ W, cy, PAD }: { W: number; cy: number; PAD: number }) {
  return (
    <>
      <defs>
        <linearGradient id="ax-grad" x1="0%" x2="100%">
          <stop offset="0%"   stopColor="#5b84a2" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ef9a9a" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x={PAD} y={cy - 8} width={W - 2 * PAD} height={16} rx={8} fill="url(#ax-grad)" />
      <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
      <text x={PAD + 4}     y={cy - 12} textAnchor="start" fontSize={8} fill="#7bb8e0">◀ Esquerda</text>
      <text x={W - PAD - 4} y={cy - 12} textAnchor="end"   fontSize={8} fill="#f08080">Direita ▶</text>
    </>
  )
}

// Bolinha de deputado no eixo
function DepDot({ cx, cy, r = 12, color, label }: { cx: number; cy: number; r?: number; color: string; label: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.92} stroke="white" strokeWidth={1.2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">{label}</text>
    </g>
  )
}

// ─── Componentes Específicos de Cada Slide ───────────────────────────────────

// Slide 1: Matriz de Votos
function SlideMatrix1() {
  const W = 500, H = 200
  const cols = ['V1', 'V2', 'V3', 'V4', 'V5']
  const rows = ['Dep. A', 'Dep. B', 'Dep. C', 'Dep. D', 'Dep. E']
  const votes = [
    [1, 0, 1, 0, 2], // 1=SIM, 0=NÃO, 2=Ausente
    [1, 1, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 1, 2],
    [0, 0, 1, 0, 1]
  ]
  const colW = 55
  const rowH = 26
  const startX = 140
  const startY = 40

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <style>{`
        @keyframes cellPulse {
          0% { fill-opacity: 0.12; stroke-opacity: 0.6; }
          50% { fill-opacity: 0.28; stroke-opacity: 1; }
          100% { fill-opacity: 0.12; stroke-opacity: 0.6; }
        }
        .animated-cell {
          animation: cellPulse 2.5s infinite ease-in-out;
        }
      `}</style>
      <rect width={W} height={H} fill="transparent" />
      {cols.map((c, i) => (
        <text key={c} x={startX + i * colW + colW/2} y={startY - 10} textAnchor="middle" fontSize={9} fill="#8a9ba8" fontWeight="bold">{c}</text>
      ))}
      {rows.map((r, i) => (
        <text key={r} x={startX - 15} y={startY + i * rowH + 16} textAnchor="end" fontSize={9} fill="#c8dce8">{r}</text>
      ))}
      {votes.map((rowVotes, rIdx) => 
        rowVotes.map((v, cIdx) => {
          const color = v === 1 ? '#66bb6a' : v === 0 ? '#ef9a9a' : '#8a9ba8'
          const label = v === 1 ? 'SIM' : v === 0 ? 'NÃO' : 'AUS'
          return (
            <g key={`${rIdx}-${cIdx}`}>
              <rect 
                x={startX + cIdx * colW} 
                y={startY + rIdx * rowH} 
                width={colW - 4} 
                height={rowH - 4} 
                rx={4} 
                fill={`${color}20`} 
                stroke={color} 
                strokeWidth={1.2}
                className="animated-cell"
                style={{ animationDelay: `${(rIdx + cIdx) * 150}ms` }}
              />
              <text 
                x={startX + cIdx * colW + (colW - 4)/2} 
                y={startY + rIdx * rowH + (rowH - 4)/2 + 3} 
                textAnchor="middle" 
                fontSize={8} 
                fill={color} 
                fontWeight="bold"
              >
                {label}
              </text>
            </g>
          )
        })
      )}
    </svg>
  )
}

// Slide 2: Forças de Atração e Repulsão
function SlideForces2() {
  const [phase, setPhase] = useState(0) // 0: neutro, 1: atração, 2: repulsão
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const W = 500, H = 200, cy = H / 2
  
  let posA = 160, posB = 340
  let msg = 'Deputados em posições iniciais'
  let labelEcon = 'Economia: Ambos votaram SIM'
  let labelHealth = 'Saúde: A votou SIM, B votou NÃO'

  if (phase === 1) {
    posA = 220; posB = 280
    msg = 'Votos Iguais → Força de Atração!'
  } else if (phase === 2) {
    posA = 120; posB = 380
    msg = 'Votos Diferentes → Força de Repulsão!'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <line x1={50} y1={cy} x2={W - 50} y2={cy} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
      
      {phase === 1 && (
        <path d={`M ${posA + 12} ${cy} Q ${(posA + posB)/2} ${cy - 20} ${posB - 12} ${cy}`} 
          fill="none" stroke="#66bb6a" strokeWidth={2.5} strokeDasharray="4 2" />
      )}
      {phase === 2 && (
        <g>
          <line x1={posA - 12} y1={cy} x2={posA - 40} y2={cy} stroke="#ef9a9a" strokeWidth={2} markerEnd="url(#arrow-left)" />
          <line x1={posB + 12} y1={cy} x2={posB + 40} y2={cy} stroke="#ef9a9a" strokeWidth={2} markerEnd="url(#arrow-right)" />
        </g>
      )}

      <defs>
        <marker id="arrow-left" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#ef9a9a" />
        </marker>
        <marker id="arrow-right" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef9a9a" />
        </marker>
      </defs>

      <g style={{ transition: 'transform 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <DepDot cx={posA} cy={cy} color="#5b84a2" label="A" />
        <text x={posA} y={cy + 26} textAnchor="middle" fontSize={9} fill="#c8dce8">Dep. A</text>
      </g>

      <g style={{ transition: 'transform 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <DepDot cx={posB} cy={cy} color="#b39ddb" label="B" />
        <text x={posB} y={cy + 26} textAnchor="middle" fontSize={9} fill="#c8dce8">Dep. B</text>
      </g>

      <text x={W/2} y={35} textAnchor="middle" fontSize={11} fill="#ffb74d" fontWeight="bold">{msg}</text>
      
      {phase === 1 && (
        <text x={W/2} y={cy - 28} textAnchor="middle" fontSize={9} fill="#66bb6a">{labelEcon}</text>
      )}
      {phase === 2 && (
        <text x={W/2} y={cy - 28} textAnchor="middle" fontSize={9} fill="#ef9a9a">{labelHealth}</text>
      )}
    </svg>
  )
}

// Slide 3: O Problema Impossível
function SlideScale3() {
  const [scaleUp, setScaleUp] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setScaleUp(true), 800)
    return () => clearTimeout(t)
  }, [])

  const W = 500, H = 200
  const rowsCount = scaleUp ? 18 : 4
  const colsCount = scaleUp ? 32 : 4
  const gridW = 380, gridH = 110
  const startX = (W - gridW) / 2
  const startY = (H - gridH) / 2

  const dots = []
  for (let r = 0; r < rowsCount; r++) {
    for (let c = 0; c < colsCount; c++) {
      dots.push({ r, c })
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <rect width={W} height={H} fill="transparent" />
      <g style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        {dots.map((d, idx) => {
          const x = startX + (d.c / (colsCount - 1 || 1)) * gridW
          const y = startY + (d.r / (rowsCount - 1 || 1)) * gridH
          const color = (d.r + d.c) % 3 === 0 ? '#66bb6a' : (d.r + d.c) % 3 === 1 ? '#ef9a9a' : 'rgba(255,255,255,0.15)'
          return (
            <circle 
              key={idx} 
              cx={x} 
              cy={y} 
              r={scaleUp ? 2.2 : 5.5} 
              fill={color} 
              style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }} 
            />
          )
        })}
      </g>

      <text x={W/2} y={22} textAnchor="middle" fontSize={11} fill="#8a9ba8" fontWeight="bold">
        {scaleUp ? '513 Deputados × 2.000+ Votações = 1.000.000+ Decisões' : 'Escala reduzida'}
      </text>

      {scaleUp && (
        <g opacity={1} style={{ transition: 'opacity 0.8s ease', transitionDelay: '1.2s' }}>
          <rect x={W/2 - 120} y={H/2 - 25} width={240} height={50} rx={8} fill="rgba(20,24,30,0.92)" stroke="#ffb74d" strokeWidth={1.5} />
          <text x={W/2} y={H/2 - 5} textAnchor="middle" fontSize={9.5} fill="#c8dce8" fontWeight="bold">Como organizar tudo isso manualmente?</text>
          <text x={W/2} y={H/2 + 13} textAnchor="middle" fontSize={10.5} fill="#ffb74d" fontWeight="bold">Nenhum humano consegue.</text>
        </g>
      )}
    </svg>
  )
}

// Slide 4: Da Matriz à Geometria
function SlideTransform4() {
  const [step, setStep] = useState(0) // 0: Matriz, 1: Dissolve/Pontos soltos, 2: Reta (1D)
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1500)
    const t2 = setTimeout(() => setStep(2), 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const W = 500, H = 200, PAD = 50
  const cy = 110

  const deputiesData = [
    { label: 'D1', startX: 140, startY: 45, finalX: 95, party: 0 },
    { label: 'D2', startX: 200, startY: 45, finalX: 135, party: 0 },
    { label: 'D3', startX: 260, startY: 45, finalX: 185, party: 1 },
    { label: 'D4', startX: 320, startY: 45, finalX: 235, party: 2 },
    { label: 'D5', startX: 380, startY: 45, finalX: 275, party: 2 },
    { label: 'D6', startX: 140, startY: 95, finalX: 315, party: 3 },
    { label: 'D7', startX: 200, startY: 95, finalX: 355, party: 3 },
    { label: 'D8', startX: 260, startY: 95, finalX: 395, party: 4 },
    { label: 'D9', startX: 320, startY: 95, finalX: 420, party: 4 },
    { label: 'D10', startX: 380, startY: 95, finalX: 445, party: 5 },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {step === 2 && (
        <g style={{ transition: 'opacity 1s ease' }}>
          <Axis1D W={W} cy={cy} PAD={PAD} />
        </g>
      )}

      {step === 0 && (
        <g stroke="rgba(255,255,255,0.12)" strokeWidth={1} style={{ transition: 'opacity 0.8s ease' }}>
          <line x1={110} y1={25} x2={410} y2={25} />
          <line x1={110} y1={70} x2={410} y2={70} />
          <line x1={110} y1={115} x2={410} y2={115} />
          <line x1={110} y1={25} x2={110} y2={115} />
          <line x1={260} y1={25} x2={260} y2={115} />
          <line x1={410} y1={25} x2={410} y2={115} />
          <text x={260} y={16} textAnchor="middle" fontSize={9} fill="#8a9ba8">Estrutura de Tabela (Matriz de Votos)</text>
        </g>
      )}

      {deputiesData.map((d, i) => {
        let x = d.startX
        let y = d.startY
        if (step === 1) {
          x = d.startX + (i % 2 === 0 ? 20 : -20)
          y = d.startY + (i % 2 === 0 ? 15 : -15)
        } else if (step === 2) {
          x = d.finalX
          y = cy
        }

        return (
          <g key={d.label} style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
            <circle cx={x} cy={y} r={7.5} fill={PARTY_COLORS[d.party]} stroke="white" strokeWidth={0.8} />
            {step === 0 && (
              <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="white">{d.label}</text>
            )}
          </g>
        )
      })}

      <text x={W/2} y={175} textAnchor="middle" fontSize={11} fill="#ffb74d" fontWeight="bold">
        {step === 0 && 'Grade de votos estrutura as informações'}
        {step === 1 && 'Colunas somem: restam apenas parlamentares'}
        {step === 2 && 'Geometria do eixo ideal (1D) toma forma'}
      </text>
    </svg>
  )
}

// Slide 5: Divisões e Limites
function SlideCutPoints5() {
  const W = 500, H = 200, PAD = 50, cy = 90
  const [animateCut, setAnimateCut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimateCut(true), 600)
    return () => clearTimeout(t)
  }, [])

  const deps = [
    { name: 'A', x: 100, vote: 'SIM', color: '#66bb6a' },
    { name: 'B', x: 150, vote: 'SIM', color: '#66bb6a' },
    { name: 'C', x: 210, vote: 'SIM', color: '#66bb6a' },
    { name: 'D', x: 300, vote: 'NÃO', color: '#ef9a9a' },
    { name: 'E', x: 360, vote: 'NÃO', color: '#ef9a9a' },
    { name: 'F', x: 420, vote: 'NÃO', color: '#ef9a9a' },
  ]

  const cutX = animateCut ? 255 : 50

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <Axis1D W={W} cy={cy} PAD={PAD} />

      {animateCut && (
        <g style={{ transition: 'opacity 1s ease' }}>
          <rect x={PAD} y={cy - 20} width={255 - PAD} height={40} fill="#66bb6a" fillOpacity={0.07} rx={4} />
          <rect x={255} y={cy - 20} width={W - PAD - 255} height={40} fill="#ef9a9a" fillOpacity={0.07} rx={4} />
          <text x={(PAD + 255)/2} y={cy - 28} textAnchor="middle" fontSize={10} fill="#66bb6a" fontWeight="bold">ZONA DO SIM</text>
          <text x={(255 + W - PAD)/2} y={cy - 28} textAnchor="middle" fontSize={10} fill="#ef9a9a" fontWeight="bold">ZONA DO NÃO</text>
        </g>
      )}

      <line x1={cutX} y1={cy - 40} x2={cutX} y2={cy + 40} 
        stroke="#ffb74d" strokeWidth={2} strokeDasharray="5 3" 
        style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }} />
      <text x={cutX} y={cy - 45} textAnchor="middle" fontSize={8.5} fill="#ffb74d" fontWeight="bold"
        style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        Ponto de Corte (Votação 1)
      </text>

      {deps.map(d => (
        <g key={d.name}>
          <circle cx={d.x} cy={cy} r={8.5} fill={d.color} stroke="white" strokeWidth={0.8} />
          <text x={d.x} y={cy + 3} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">{d.name}</text>
          <text x={d.x} y={cy + 18} textAnchor="middle" fontSize={9} fill={d.color} fontWeight="bold">{d.vote}</text>
        </g>
      ))}
    </svg>
  )
}

// Slide 6: Proximidade e Probabilidade
function SlideProbability6() {
  const [phase, setPhase] = useState(0) // 0: longe em SIM, 1: perto do corte, 2: longe em NÃO
  useEffect(() => {
    const iv = setInterval(() => {
      setPhase(p => (p + 1) % 3)
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const W = 500, H = 200, cy = 90, PAD = 60
  const cutX = 250

  let depX = 100
  let probVal = 99
  let probText = 'Previsão de SIM: 99% (Alta Certeza)'
  let probColor = '#66bb6a'

  if (phase === 0) {
    depX = 100
    probVal = 99
    probText = 'Previsão de SIM: 99% (Alta Certeza)'
    probColor = '#66bb6a'
  } else if (phase === 1) {
    depX = 230
    probVal = 58
    probText = 'Previsão de SIM: 58% (Muita Incerteza)'
    probColor = '#ffb74d'
  } else {
    depX = 390
    probVal = 98
    probText = 'Previsão de NÃO: 98% (Alta Certeza)'
    probColor = '#ef9a9a'
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <Axis1D W={W} cy={cy} PAD={PAD} />
      
      <line x1={cutX} y1={cy - 35} x2={cutX} y2={cy + 35} stroke="#ffb74d" strokeWidth={1.8} strokeDasharray="3 2" />
      <text x={cutX} y={cy - 40} textAnchor="middle" fontSize={8} fill="#ffb74d">Ponto de Corte</text>

      <g style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <circle cx={depX} cy={cy} r={11} fill="#5b84a2" stroke="white" strokeWidth={1} />
        <text x={depX} y={cy - 16} textAnchor="middle" fontSize={8} fill="#c8dce8" fontWeight="bold">Deputado</text>
      </g>

      <g transform="translate(100, 145)">
        <rect x={0} y={0} width={300} height={12} rx={6} fill="rgba(255,255,255,0.08)" />
        <rect x={0} y={0} width={probVal * 3} height={12} rx={6} fill={probColor}
          style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }} />
        <text x={150} y={-8} textAnchor="middle" fontSize={9.5} fill="#c8dce8" fontWeight="bold">
          {probText}
        </text>
      </g>
    </svg>
  )
}

// Slide 7: Ajuste Alternado
function SlideOptimization7() {
  const [step, setStep] = useState(0) // 0: Deputados se movem, 1: Cortes se movem
  useEffect(() => {
    const iv = setInterval(() => {
      setStep(s => (s + 1) % 2)
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const W = 500, H = 200, cy = 95, PAD = 60
  
  const depA_X = step === 0 ? 120 : 155
  const depB_X = step === 0 ? 370 : 335
  const cut_X  = step === 1 ? 210 : 245

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <Axis1D W={W} cy={cy} PAD={PAD} />

      <g style={{ transition: 'all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <line x1={cut_X} y1={cy - 35} x2={cut_X} y2={cy + 35} stroke="#ffb74d" strokeWidth={1.8} strokeDasharray="3 2" />
        <text x={cut_X} y={cy - 40} textAnchor="middle" fontSize={8} fill="#ffb74d">
          Corte {step === 1 ? ' (Ajustando…)' : ' (Travado 🔒)'}
        </text>
      </g>

      <g style={{ transition: 'all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <circle cx={depA_X} cy={cy} r={8.5} fill="#5b84a2" stroke="white" strokeWidth={0.8} />
        <text x={depA_X} y={cy + 18} textAnchor="middle" fontSize={8} fill="#c8dce8">
          A {step === 0 ? ' (Movendo…)' : ' (🔒)'}
        </text>
      </g>

      <g style={{ transition: 'all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
        <circle cx={depB_X} cy={cy} r={8.5} fill="#b39ddb" stroke="white" strokeWidth={0.8} />
        <text x={depB_X} y={cy + 18} textAnchor="middle" fontSize={8} fill="#c8dce8">
          B {step === 0 ? ' (Movendo…)' : ' (🔒)'}
        </text>
      </g>

      <rect x={W/2 - 125} y={15} width={250} height={22} rx={4} fill="rgba(255,255,255,0.05)" />
      <text x={W/2} y={29} textAnchor="middle" fontSize={9.5} fill="#ffb74d" fontWeight="bold">
        {step === 0 ? 'Passo 1: Fixa Cortes 🔒, Ajusta Coordenadas' : 'Passo 2: Fixa Coordenadas 🔒, Ajusta Cortes'}
      </text>
    </svg>
  )
}

// Slide 8: Convergência
function SlideConvergence8() {
  const [iter, setIter] = useState(1)
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const start = Date.now()
    const duration = 3500
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const easedT = easeInOut(t)
      setPct(Math.round(easedT * 100))
      
      const currentIter = Math.round(easedT * 60)
      setIter(Math.max(1, currentIter))

      if (t >= 1) {
        clearInterval(interval)
        setDone(true)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: 400, margin: '20px auto', padding: '0 16px' }}>
      <div style={{ fontSize: 13, color: '#ffb74d', fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
        {done ? '✓ Convergência Atingida!' : `Calculando ajustes alternados... (Ciclo ${iter}/60)`}
      </div>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #5b84a2, #66bb6a)', borderRadius: 5, transition: 'width 60ms linear' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#8a9ba8' }}>
        <span>Posições dos deputados estabilizadas</span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}

// Slide 9: A Segunda Dimensão
function SlidePlane9() {
  const [expand, setExpand] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setExpand(true), 800)
    return () => clearTimeout(t)
  }, [])

  const W = 500, H = 220, cx = W / 2, cy = H / 2
  const sc = 170

  const rand = makeRand(2026)
  const deps = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    color: PARTY_COLORS[i % 5],
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      {expand && (
        <g stroke="rgba(255,255,255,0.04)" strokeWidth={1} style={{ transition: 'opacity 1s ease' }}>
          <line x1={40} y1={cy - 50} x2={W - 40} y2={cy - 50} />
          <line x1={40} y1={cy + 50} x2={W - 40} y2={cy + 50} />
          <line x1={cx - 90} y1={25} x2={cx - 90} y2={H - 25} />
          <line x1={cx + 90} y1={25} x2={cx + 90} y2={H - 25} />
        </g>
      )}

      <line x1={40} y1={cy} x2={W - 40} y2={cy} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      {expand && (
        <line x1={cx} y1={25} x2={cx} y2={H - 25} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5}
          style={{ transition: 'opacity 1s ease' }} />
      )}

      <text x={W - 40} y={cy - 5} textAnchor="end" fontSize={8.5} fill="#8a9ba8">Dimensão 1 (Esq/Dir)</text>
      {expand && (
        <text x={cx + 5} y={30} fontSize={8.5} fill="#8a9ba8"
          style={{ transition: 'opacity 1s ease' }}>Dimensão 2 (Governo/Oposição)</text>
      )}

      {deps.map(d => {
        const x = cx + d.x * sc
        const y = expand ? (cy - d.y * 60) : cy
        return (
          <circle 
            key={d.id} 
            cx={x} 
            cy={y} 
            r={5.5} 
            fill={d.color} 
            stroke="white" 
            strokeWidth={0.7}
            style={{ transition: 'all 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)' }} 
          />
        )
      })}
    </svg>
  )
}

// Slide 10: Tabela de Coordenadas
function SlideOutput10() {
  const [plotted, setPlotted] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => {
      setPlotted(n => {
        if (n >= 4) {
          clearInterval(iv)
          return n
        }
        return n + 1
      })
    }, 700)
    return () => clearInterval(iv)
  }, [])

  const W = 500, H = 200
  const tableData = [
    { label: 'Dep. A', x: -0.78, y: 0.25, color: '#5b84a2' },
    { label: 'Dep. B', x: 0.65, y: -0.42, color: '#ef9a9a' },
    { label: 'Dep. C', x: 0.08, y: 0.61, color: '#66bb6a' },
    { label: 'Dep. D', x: -0.32, y: -0.15, color: '#ffb74d' },
  ]

  const gridCx = 370, gridCy = 100
  const gridSc = 80

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={SVG_STYLE}>
      <g transform="translate(15, 20)">
        <rect x={0} y={0} width={200} height={160} rx={6} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
        <text x={10} y={18} fontSize={9.5} fill="#ffb74d" fontWeight="bold">Output: Tabela Coordenadas (.ORD)</text>
        
        <text x={10} y={42} fontSize={8.5} fill="#8a9ba8" fontWeight="bold">Deputado</text>
        <text x={100} y={42} fontSize={8.5} fill="#8a9ba8" fontWeight="bold">Dim. 1</text>
        <text x={150} y={42} fontSize={8.5} fill="#8a9ba8" fontWeight="bold">Dim. 2</text>
        <line x1={10} y1={48} x2={190} y2={48} stroke="rgba(255,255,255,0.08)" />

        {tableData.map((row, idx) => {
          const isPlotted = plotted > idx
          return (
            <g key={row.label} transform={`translate(0, ${56 + idx * 24})`} 
              opacity={isPlotted ? 1 : 0.2} style={{ transition: 'opacity 0.5s ease' }}>
              <circle cx={14} cy={5} r={4.5} fill={row.color} />
              <text x={24} y={8} fontSize={8.5} fill="white">{row.label}</text>
              <text x={100} y={8} fontSize={8.5} fill="white">{row.x.toFixed(2)}</text>
              <text x={150} y={8} fontSize={8.5} fill="white">{row.y.toFixed(2)}</text>
            </g>
          )
        })}
      </g>

      <g>
        <line x1={260} y1={gridCy} x2={480} y2={gridCy} stroke="rgba(255,255,255,0.25)" />
        <line x1={gridCx} y1={20} x2={gridCx} y2={180} stroke="rgba(255,255,255,0.25)" />
        <text x={480} y={gridCy - 4} textAnchor="end" fontSize={8} fill="#8a9ba8">Dim 1</text>
        <text x={gridCx + 4} y={28} fontSize={8} fill="#8a9ba8">Dim 2</text>

        {tableData.map((row, idx) => {
          const isPlotted = plotted > idx
          if (!isPlotted) return null
          const dx = gridCx + row.x * gridSc
          const dy = gridCy - row.y * gridSc
          return (
            <g key={row.label} style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <circle cx={dx} cy={dy} r={6.5} fill={row.color} stroke="white" strokeWidth={0.8} />
              <text x={dx} y={dy - 9} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">{row.label}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// Slide 11: O Mapa Final
function SlideFinal11({ navigate }: { navigate: any }) {
  const rand = makeRand(2026)
  const W = 500, H = 200, PAD = 40
  const cx = W / 2, cy = H / 2
  const sc = 75
  const toX = (v: number) => cx + v * sc
  const toY = (v: number) => cy - v * sc

  const partyPositions = [
    { x: -0.72, y:  0.22 },
    { x: -0.38, y:  0.05 },
    { x:  0.02, y:  0.15 },
    { x:  0.48, y: -0.08 },
    { x:  0.78, y: -0.25 },
  ]

  const deps = Array.from({ length: 65 }, (_, i) => {
    const p = i % 5
    const c = partyPositions[p]
    return { id: i, x: clamp(c.x + (rand() - 0.5) * 0.35), y: clamp(c.y + (rand() - 0.5) * 0.28),
      color: PARTY_COLORS[p] }
  })

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ ...SVG_STYLE, maxHeight: 145 }}>
        {[-0.5, 0, 0.5].map(v => (
          <g key={v}>
            <line x1={toX(v)} y1={PAD} x2={toX(v)} y2={H - PAD} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <line x1={PAD} y1={toY(v)} x2={W - PAD} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          </g>
        ))}
        <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <text x={PAD + 2}   y={cy - 6} fontSize={8} fill="#7bb8e0">◀ Esquerda</text>
        <text x={W - PAD - 2} y={cy - 6} textAnchor="end" fontSize={8} fill="#f08080">Direita ▶</text>

        {deps.map(d => (
          <circle key={d.id} cx={toX(d.x)} cy={toY(d.y)} r={4}
            fill={d.color} fillOpacity={0.8} stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
        ))}
      </svg>
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="wn-story__btn wn-story__btn--primary"
          onClick={() => navigate('/grupos/partidos-votacoes')}
          style={{ padding: '9px 24px', fontSize: '0.9rem', fontWeight: 'bold' }}
        >
          Explorar Resultados Reais ✓
        </button>
      </div>
    </div>
  )
}

// ─── Definição dos slides e conteúdo ─────────────────────────────────────────

interface SlideData { 
  title: string
  text: string
  component: React.ReactNode
  technicalDetails?: React.ReactNode 
}

function buildSlides(navigate: any): SlideData[] {
  return [
    {
      title: '1. O Ponto de Partida: A Matriz de Votos',
      text: 'Toda análise ideológica começa com o histórico de votações nominais de um parlamento. Organizamos essa montanha de dados em uma tabela simples: a Matriz de Votos. Cada linha é um deputado, cada coluna é um projeto e cada célula registra o voto.',
      component: <SlideMatrix1 />,
      technicalDetails: (
        <>
          <p><strong>Definição Formal:</strong> Representamos a matriz de Roll Call como uma matriz Y de dimensão N x M, onde N é o número de parlamentares e M o número de votações nominais.</p>
          <p>Cada célula Y(i,j) (sendo 1 para Sim, 0 para Não ou NA para Ausente) representa o voto do parlamentar i na votação j:</p>
          <ul>
            <li>1: Voto favorável (SIM)</li>
            <li>0: Voto contrário (NÃO)</li>
            <li>NA: Ausência, abstenção ou obstrução (tratada como dado faltante e desconsiderada no cálculo da verossimilhança daquela célula).</li>
          </ul>
        </>
      )
    },
    {
      title: '2. As Forças da Afinidade',
      text: 'Quando dois deputados votam igual no mesmo projeto (ambos SIM ou ambos NÃO), surge uma força que os aproxima. Se votam de maneira oposta em outro projeto, surge uma força que os afasta. O acúmulo dessas votações funciona como ímãs, determinando a distância natural entre eles.',
      component: <SlideForces2 />,
      technicalDetails: (
        <>
          <p><strong>Afiliação Bipartite:</strong> A matriz de votação representa uma rede de afiliação de dois tipos de nós (Deputados e Projetos). A distância ideológica entre deputados é uma propriedade emergente da similaridade de suas escolhas.</p>
          <p>Matematicamente, se dois parlamentares votam de forma idêntica em todas as proposições, a distância latente entre eles tende a zero sob a métrica de distância Euclidiana no espaço de utilidade:</p>
          <p style={{ fontFamily: 'monospace', textAlign: 'center', margin: '8px 0' }}>d_i,k = ||x_i - x_k||</p>
        </>
      )
    },
    {
      title: '3. O Problema Impossível',
      text: 'Com apenas dois deputados, é fácil ajustar o mapa à mão. Mas a Câmara real possui 513 deputados e mais de 2.000 votações. São mais de 1 milhão de votos: um quebra-cabeça de forças gigante que nenhum humano consegue resolver manualmente.',
      component: <SlideScale3 />,
      technicalDetails: (
        <>
          <p><strong>Alta Dimensionalidade e Esparsidade:</strong> Organizar $N$ deputados no espaço bidimensional de forma a minimizar os erros de previsão para $M$ votações é um problema clássico de otimização combinatória.</p>
          <p>Com dados do mundo real, a matriz contém um alto grau de ruído (parlamentares que negociam emendas ou mudam de opinião) e dados ausentes, tornando inviável qualquer heurística ou posicionamento ad-hoc sem modelagem estatística robusta.</p>
        </>
      )
    },
    {
      title: '4. Da Matriz à Geometria',
      text: 'Para resolver o quebra-cabeça, o algoritmo transforma a tabela em coordenadas físicas. As linhas e colunas da matriz dissolvem-se, restando apenas os deputados como pontos soltos. Puxados pelas forças de atração e repulsão, esses pontos se alinham de forma organizada.',
      component: <SlideTransform4 />,
      technicalDetails: (
        <>
          <p><strong>Projeção Espacial:</strong> A conversão de dados categoriais/ordinais (votos) em espaço contínuo é feita projetando a matriz de votos em dimensões de menor ordem.</p>
          <p>O algoritmo assume que a ideologia pode ser representada como um espaço euclidiano contínuo, usualmente de uma ou duas dimensões (eixos variando de -1.0 a 1.0), onde a proximidade geométrica reflete a correlação de comportamento político.</p>
        </>
      )
    },
    {
      title: '5. Pontos de Corte',
      text: 'Cada votação atua como uma barreira divisória no mapa, chamada de Ponto de Corte. Esse ponto corta a reta ideológica em duas metades: a zona do SIM e a zona do NÃO. Um mapa ideológico correto é aquele onde os pontos de corte das votações conseguem separar os deputados com precisão.',
      component: <SlideCutPoints5 />,
      technicalDetails: (
        <>
          <p><strong>Geometria do Voto:</strong> Para cada votação $j$, o algoritmo estima um ponto de corte $z_j$. Em um espaço 1D, o ponto de corte vira um valor único no espectro. Em espaços multidimensionais (ex: 2D), o ponto de corte vira uma reta ou hiperplano divisório perpendicular ao vetor de polarização da votação.</p>
          <p>Se o ponto ideal do deputado $x_i$ está de um lado do corte, a alternativa de utilidade estimada prediz que ele deve votar SIM; se está do outro, prediz NÃO.</p>
        </>
      )
    },
    {
      title: '6. A Regra da Probabilidade',
      text: 'Deputados não são robôs: às vezes, fogem do comportamento esperado e votam contra seus aliados. Para modelar isso, o algoritmo assume que a probabilidade de um deputado votar SIM diminui à medida que ele se afasta do ponto de corte daquela proposição. O algoritmo busca a posição onde a probabilidade estimada é o mais próxima possível das decisões reais.',
      component: <SlideProbability6 />,
      technicalDetails: (
        <>
          <p><strong>Modelo de Utilidade Espacial:</strong> A utilidade que o parlamentar $i$ extrai de votar SIM ou NÃO na votação $j$ é baseada na distância euclidiana até a opção escolhida, somada a um erro estocástico (ruído).</p>
          <p>A probabilidade de votar SIM diminui à medida que o deputado está do lado oposto do ponto de corte de forma contínua, usando uma função de distribuição acumulada normal ou logística.</p>
        </>
      )
    },
    {
      title: '7. O Ajuste Alternado',
      text: 'Para resolver o quebra-cabeça de forças, o algoritmo faz ajustes de forma alternada: Passo 1: Congela os pontos de corte e move os deputados para a posição que melhor prevê seus votos. Passo 2: Congela os deputados e move os pontos de corte para melhorar a divisão das votações.',
      component: <SlideOptimization7 />,
      technicalDetails: (
        <>
          <p><strong>Estimação de Três Passos (Three-Step Estimation):</strong> O W-NOMINATE utiliza um estimador de máxima verossimilhança (MLE) alternado para resolver o problema de parâmetros incidentais. O problema global consiste em encontrar as coordenadas de todos os deputados $X$ e os parâmetros de votação $Z$ que maximizam a função de Log-Verossimilhança conjunta.</p>
          <p>Como resolver para $X$ e $Z$ ao mesmo tempo é não-convexo, o algoritmo alterna entre maximizar em relação a $X$ mantendo $Z$ constante, e maximizar em relação a $Z$ mantendo $X$ constante.</p>
        </>
      )
    },
    {
      title: '8. Convergência: O Mapa Congela',
      text: 'Esse ciclo de ajustes alternados repete-se dezenas de vezes. A cada iteração, os movimentos ficam menores e a taxa de acerto do modelo estabiliza. Quando as coordenadas e pontos de corte param de se mover, atingimos a convergência.',
      component: <SlideConvergence8 />,
      technicalDetails: (
        <>
          <p><strong>Critérios de Parada:</strong> A convergência é avaliada monitorando a taxa de variação da log-verossimilhança global entre iterações sucessivas.</p>
          <p>Quando a melhoria se torna menor que uma tolerância numérica pré-definida (ex: 0.00001), o algoritmo cessa os ajustes. Em bases reais, o W-NOMINATE costuma convergir em menos de 50 iterações globais.</p>
        </>
      )
    },
    {
      title: '9. A Segunda Dimensão',
      text: 'Um único eixo (Esquerda-Direita) consegue prever cerca de 80% das decisões de voto. Para explicar o restante dos votos (como disputas entre Governo e Oposição, ou alas regionais), o algoritmo abre uma segunda dimensão. A reta se dobra e se desdobra em um plano bidimensional.',
      component: <SlidePlane9 />,
      technicalDetails: (
        <>
          <p><strong>Análise Dimensional:</strong> A primeira dimensão do W-NOMINATE quase sempre captura a clivagem redistributiva / econômica tradicional. A segunda dimensão captura conflitos secundários (no Brasil, frequentemente a divisão Governo-Oposição ou regionalismos; nos EUA, questões sociais/direitos civis na segunda metade do século XX).</p>
          <p>A adequação do número de dimensões é avaliada por métricas como a variação marginal de classificação correta e APRE (Aggregate Proportion of Votes Readily Explained).</p>
        </>
      )
    },
    {
      title: '10. O Output: Tabela de Coordenadas',
      text: 'O resultado bruto gerado pelo algoritmo é uma tabela matemática pura de coordenadas. Cada deputado recebe um número exato para a Dimensão 1 e outro para a Dimensão 2. Agora, desenhar o mapa ideológico é simplesmente uma questão de plotar esses números no gráfico.',
      component: <SlideOutput10 />,
      technicalDetails: (
        <>
          <p><strong>Estrutura do Arquivo de Output (.ORD):</strong> O output clássico de programas de escalonamento espacial contém uma tabela com os seguintes dados:</p>
          <ul>
            <li>Identificação do Deputado e Partido</li>
            <li>Coordenada Estimada na Dimensão 1 (normalmente normalizada em [-1.0, 1.0])</li>
            <li>Coordenada Estimada na Dimensão 2 (normalmente normalizada em [-1.0, 1.0])</li>
            <li>Métricas de qualidade individual: Classificação correta individual e APRE individual</li>
          </ul>
        </>
      )
    },
    {
      title: '11. O Mapa Ideológico Final',
      text: 'Ao plotar todas as coordenadas estimadas, o mapa ideológico da Câmara dos Deputados surge completo. Esse processo de traduzir votos em posições é a base científica de todos os gráficos e análises do nosso dashboard. Explore os resultados reais coletados do Congresso para ver o W-NOMINATE em ação.',
      component: <SlideFinal11 navigate={navigate} />,
      technicalDetails: (
        <>
          <p><strong>Aplicações Práticas:</strong> Com as coordenadas em mãos, cientistas políticos podem:</p>
          <ul>
            <li>Medir a polarização média de uma legislatura ao longo do tempo.</li>
            <li>Avaliar a coesão partidária (disciplina de voto) calculando o desvio-padrão das coordenadas intrapartido.</li>
            <li>Estimar a proximidade ideológica real do governo com partidos do centro para prever a probabilidade de aprovação de novos projetos de lei.</li>
          </ul>
        </>
      )
    }
  ]
}

// ─── Componente Principal ───────────────────────────────────────────────────

export function WNominateStory() {
  const [slide, setSlide]       = useState(0)
  const [slideKey, setSlideKey] = useState(0)
  
  const navigate = useNavigate()
  const slides = buildSlides(navigate)

  const goTo = useCallback((idx: number) => {
    setSlide(idx)
    setSlideKey(k => k + 1)
  }, [])

  const prev = useCallback(() => { if (slide > 0) goTo(slide - 1) }, [slide, goTo])
  const next = useCallback(() => {
    if (slide < TOTAL_SLIDES - 1) goTo(slide + 1)
  }, [slide, goTo])

  const current  = slides[slide]
  const progress = ((slide + 1) / TOTAL_SLIDES) * 100

  // Estilos inline de apoio para o componente expansível de detalhes
  const detailsStyle = {
    width: '100%',
    maxWidth: 620,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: '8px 12px',
    marginTop: 12,
    textAlign: 'left' as const,
    cursor: 'pointer',
  }
  const summaryStyle = {
    fontWeight: 'bold',
    fontSize: '0.85rem',
    color: '#ffb74d',
    outline: 'none',
    userSelect: 'none' as const,
  }
  const detailsContentStyle = {
    marginTop: 8,
    fontSize: '0.8rem',
    lineHeight: '1.5',
    color: '#c8dce8',
    cursor: 'default',
  }

  return (
    <div className="wn-story" data-testid="wnominate-story">
      {/* Progresso e Tempo Estimado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>
          Tempo estimado: ~4 minutos
        </span>
        <div className="wn-story__counter" style={{ margin: 0 }} aria-live="polite">
          Slide {slide + 1} de {TOTAL_SLIDES}
        </div>
      </div>

      <div className="wn-story__progress-bar" style={{ marginBottom: 18 }}>
        <div className="wn-story__progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Slide Area com altura dinâmica para permitir expansão dos detalhes sem cortar */}
      <div className="wn-story__slide-area" style={{ height: 'auto', minHeight: 460, overflow: 'visible' }}>
        <div key={slideKey} className="wn-story__slide" style={{ height: 'auto', paddingBottom: 20 }}>
          <h3 className="wn-story__slide-title">{current.title}</h3>
          
          <div className="wn-story__vis" aria-label={`Visualização: ${current.title}`}>
            {current.component}
          </div>
          
          <p className="wn-story__text" style={{ minHeight: 50 }}>{current.text}</p>

          {/* Seção Expansível para Detalhes Técnicos */}
          {current.technicalDetails && (
            <details style={detailsStyle} onClick={(e) => e.stopPropagation()}>
              <summary style={summaryStyle}>Detalhes Técnicos & Matemática</summary>
              <div style={detailsContentStyle} onClick={(e) => e.stopPropagation()}>
                {current.technicalDetails}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Controles de Navegação */}
      <div className="wn-story__nav">
        <button 
          type="button" 
          className="wn-story__btn wn-story__btn--secondary"
          onClick={prev} 
          disabled={slide === 0} 
          aria-label="Revisar slide anterior"
        >
          ← Revisar
        </button>

        <div className="wn-story__dots" role="tablist" aria-label="Navegação por slides">
          {slides.map((_, i) => (
            <button 
              key={i} 
              type="button" 
              role="tab"
              aria-selected={i === slide} 
              aria-label={`Ir para slide ${i + 1}`}
              className={`wn-story__dot${i === slide ? ' wn-story__dot--active' : ''}${i < slide ? ' wn-story__dot--done' : ''}`}
              onClick={() => goTo(i)} 
            />
          ))}
        </div>

        <button 
          type="button" 
          className="wn-story__btn wn-story__btn--primary"
          onClick={next}
          disabled={slide === TOTAL_SLIDES - 1}
          aria-label="Continuar para próximo slide"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
