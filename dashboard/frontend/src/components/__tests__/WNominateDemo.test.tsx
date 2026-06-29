import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WNominateDemo } from '../WNominateDemo'

// ── rAF stub ─────────────────────────────────────────────────────────────────
// jsdom does not implement requestAnimationFrame with real timing.
// We replace it with an immediate callback so async state updates resolve.
let rafCallbacks: FrameRequestCallback[] = []
let rafIdCounter = 0

beforeEach(() => {
  rafCallbacks = []
  rafIdCounter = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafIdCounter
    rafCallbacks.push(cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1)
  })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Drain one rAF tick
function flushRaf() {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach(cb => cb(performance.now()))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WNominateDemo', () => {
  it('renders without crashing', () => {
    render(<WNominateDemo />)
    expect(screen.getByTestId('wnominate-demo')).toBeInTheDocument()
  })

  it('shows the visualization panel', () => {
    render(<WNominateDemo />)
    expect(screen.getByTestId('wnominate-vis')).toBeInTheDocument()
  })

  it('shows an explanation text area', () => {
    render(<WNominateDemo />)
    expect(screen.getByTestId('wnominate-explanation')).toBeInTheDocument()
  })

  it('renders run and reset buttons', () => {
    render(<WNominateDemo />)
    expect(screen.getByTestId('btn-run')).toBeInTheDocument()
    expect(screen.getByTestId('btn-reset')).toBeInTheDocument()
  })

  it('defaults to 1D mode', () => {
    render(<WNominateDemo />)
    const vis = screen.getByTestId('wnominate-vis')
    expect(vis.getAttribute('data-dims')).toBe('1')
  })

  it('switches to 2D mode when 2D button is clicked', async () => {
    render(<WNominateDemo />)
    const btn2D = screen.getByTestId('dim-2d')
    await act(async () => { fireEvent.click(btn2D) })
    const vis = screen.getByTestId('wnominate-vis')
    expect(vis.getAttribute('data-dims')).toBe('2')
  })

  it('switches back to 1D mode', async () => {
    render(<WNominateDemo />)
    const btn2D = screen.getByTestId('dim-2d')
    const btn1D = screen.getByTestId('dim-1d')
    await act(async () => { fireEvent.click(btn2D) })
    await act(async () => { fireEvent.click(btn1D) })
    const vis = screen.getByTestId('wnominate-vis')
    expect(vis.getAttribute('data-dims')).toBe('1')
  })

  it('run button becomes disabled while running', async () => {
    render(<WNominateDemo />)
    const runBtn = screen.getByTestId('btn-run')
    await act(async () => { fireEvent.click(runBtn) })
    // After click the button should reflect running state
    expect(runBtn).toBeDisabled()
  })

  it('reset button re-enables run button', async () => {
    render(<WNominateDemo />)
    const runBtn   = screen.getByTestId('btn-run')
    const resetBtn = screen.getByTestId('btn-reset')
    // Start
    await act(async () => { fireEvent.click(runBtn) })
    // Stop via rAF flush to reach done=true faster, then reset
    // Drain all rAF so the loop terminates
    await act(async () => { for (let i = 0; i < 70; i++) flushRaf() })
    // Reset should make run button available again
    await act(async () => { fireEvent.click(resetBtn) })
    expect(runBtn).not.toBeDisabled()
  })

  it('iteration count starts at 0', () => {
    render(<WNominateDemo />)
    const iterEl = screen.getByTestId('iteration-count')
    expect(iterEl.textContent).toMatch(/^0\s*\//)
  })

  it('iteration count increments after one rAF tick', async () => {
    render(<WNominateDemo />)
    const runBtn = screen.getByTestId('btn-run')
    await act(async () => { fireEvent.click(runBtn) })
    await act(async () => { flushRaf() })
    const iterEl = screen.getByTestId('iteration-count')
    const iter = parseInt(iterEl.textContent ?? '0')
    expect(iter).toBeGreaterThanOrEqual(1)
  })

  it('shows deputy count select with correct options', () => {
    render(<WNominateDemo />)
    const labels = screen.getAllByRole('combobox')
    // First combobox is deputies; check option 25 exists
    const option25 = Array.from(labels[0].querySelectorAll('option'))
      .find(o => o.textContent === '25')
    expect(option25).toBeTruthy()
  })

  it('1D SVG has correct aria-label', () => {
    render(<WNominateDemo />)
    expect(screen.getByRole('img', { name: /1D/i })).toBeInTheDocument()
  })

  it('2D SVG appears when switching to 2D', async () => {
    render(<WNominateDemo />)
    await act(async () => { fireEvent.click(screen.getByTestId('dim-2d')) })
    expect(screen.getByRole('img', { name: /2D/i })).toBeInTheDocument()
  })

  it('noise buttons are present and clickable', async () => {
    render(<WNominateDemo />)
    const medBtn = screen.getByRole('radio', { name: /Médio/i })
    await act(async () => { fireEvent.click(medBtn) })
    expect(medBtn).toHaveAttribute('aria-checked', 'true')
  })

  it('disclaimer note is present', () => {
    render(<WNominateDemo />)
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByRole('note').textContent).toMatch(/simulação simplificada/i)
  })

  it('changing deputy count re-initialises (iteration resets to 0)', async () => {
    render(<WNominateDemo />)
    const runBtn = screen.getByTestId('btn-run')
    await act(async () => { fireEvent.click(runBtn) })
    await act(async () => { for (let i = 0; i < 5; i++) flushRaf() })

    // Now change deputy count
    const selects = screen.getAllByRole('combobox')
    await act(async () => { fireEvent.change(selects[0], { target: { value: '5' } }) })

    const iterEl = screen.getByTestId('iteration-count')
    const iter = parseInt(iterEl.textContent ?? '99')
    expect(iter).toBe(0)
  })
})
