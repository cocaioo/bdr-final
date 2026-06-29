import '@testing-library/jest-dom'

// jsdom nao implementa ResizeObserver; componentes que renderizam graficos
// reais (ex.: ChartPanel) usam essa API para reagir a mudancas de layout.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
}
