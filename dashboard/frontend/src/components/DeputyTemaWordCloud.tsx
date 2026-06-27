import { useMemo, useRef, useState } from 'react'
import type { DeputyTemaItem } from '../types'

const COLOR_PALETTE = [
  'var(--avatar-gradient-1a)',
  'var(--avatar-gradient-2a)',
  'var(--avatar-gradient-3a)',
  'var(--avatar-gradient-4a)',
  'var(--avatar-gradient-5a)',
  'var(--avatar-gradient-6a)',
  'var(--avatar-gradient-7a)',
  'var(--avatar-gradient-1b)',
  'var(--avatar-gradient-2b)',
  'var(--avatar-gradient-3b)',
  'var(--avatar-gradient-4b)',
  'var(--avatar-gradient-5b)',
  'var(--avatar-gradient-6b)',
  'var(--avatar-gradient-7b)',
  'var(--gastos-blue)',
  'var(--gastos-green)',
  'var(--gastos-purple)',
  'var(--gastos-orange)',
  'var(--gastos-teal)',
  'var(--gastos-rose)',
  'var(--gastos-indigo)',
  'var(--gastos-amber)',
]

const MIN_FONT_REM = 0.95
const MAX_FONT_REM = 2.6

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function colorForTema(tema: string): string {
  return COLOR_PALETTE[hashString(tema) % COLOR_PALETTE.length]
}

function rotationForTema(tema: string): number {
  return (hashString(`rot:${tema}`) % 9) - 4
}

function fontSizeFor(qtd: number, minQtd: number, maxQtd: number): number {
  if (maxQtd === minQtd) return (MIN_FONT_REM + MAX_FONT_REM) / 2
  const logMin = Math.log(minQtd + 1)
  const logMax = Math.log(maxQtd + 1)
  const logVal = Math.log(qtd + 1)
  const t = (logVal - logMin) / (logMax - logMin)
  return MIN_FONT_REM + t * (MAX_FONT_REM - MIN_FONT_REM)
}

interface WordEntry extends DeputyTemaItem {
  fontSize: number
  color: string
  rotation: number
}

function buildWords(temas: DeputyTemaItem[]): WordEntry[] {
  const sorted = [...temas].sort((a, b) => b.qtd_proposicoes - a.qtd_proposicoes)
  const counts = sorted.map((item) => item.qtd_proposicoes)
  const maxQtd = counts.length ? Math.max(...counts) : 0
  const minQtd = counts.length ? Math.min(...counts) : 0

  const decorated = sorted.map((item) => ({
    ...item,
    fontSize: fontSizeFor(item.qtd_proposicoes, minQtd, maxQtd),
    color: colorForTema(item.tema),
    rotation: rotationForTema(item.tema),
  }))

  // Intercala maior/menor para nao parecer uma lista ranqueada.
  const half = Math.ceil(decorated.length / 2)
  const bigger = decorated.slice(0, half)
  const smaller = decorated.slice(half)
  const interleaved: WordEntry[] = []
  for (let i = 0; i < bigger.length; i += 1) {
    interleaved.push(bigger[i])
    if (smaller[i]) interleaved.push(smaller[i])
  }
  return interleaved
}

interface TooltipState {
  word: WordEntry
  left: number
  top: number
  placement: 'above' | 'below'
}

const TOOLTIP_CLEARANCE = 48

interface DeputyTemaWordCloudProps {
  temas: DeputyTemaItem[]
}

export function DeputyTemaWordCloud({ temas }: DeputyTemaWordCloudProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const words = useMemo(() => buildWords(temas), [temas])

  const showTooltipFor = (word: WordEntry, target: HTMLElement) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasRect = canvas.getBoundingClientRect()
    const wordRect = target.getBoundingClientRect()
    const spaceAbove = wordRect.top - canvasRect.top
    const placement = spaceAbove < TOOLTIP_CLEARANCE ? 'below' : 'above'
    setTooltip({
      word,
      left: wordRect.left - canvasRect.left + wordRect.width / 2,
      top: placement === 'above' ? wordRect.top - canvasRect.top : wordRect.bottom - canvasRect.top,
      placement,
    })
  }

  return (
    <div className="deputy-tema-cloud">
      <div
        ref={canvasRef}
        className="deputy-tema-cloud__canvas"
        onMouseLeave={() => setTooltip(null)}
      >
        {words.map((word) => (
          <span
            key={word.tema}
            className="deputy-tema-cloud__word"
            style={{
              fontSize: `${word.fontSize}rem`,
              color: word.color,
              transform: `rotate(${word.rotation}deg)`,
            }}
            onMouseEnter={(event) => showTooltipFor(word, event.currentTarget)}
            aria-label={`${word.tema}: ${word.qtd_proposicoes} proposições`}
          >
            {word.tema}
          </span>
        ))}
        {tooltip ? (
          <div
            className={`deputy-tema-cloud__tooltip deputy-tema-cloud__tooltip--${tooltip.placement}`}
            style={{ left: tooltip.left, top: tooltip.top }}
            role="tooltip"
          >
            <strong>{tooltip.word.tema}</strong>
            <span>{tooltip.word.qtd_proposicoes} proposições</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
