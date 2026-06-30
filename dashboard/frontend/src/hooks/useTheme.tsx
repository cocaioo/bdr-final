import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const STORAGE_KEY = 'bdr-theme'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStoredTheme()
    // Aplica a classe imediatamente na inicialização (antes do primeiro render)
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('theme-dark', stored === 'dark')
    }
    return stored
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      // Aplica a classe ANTES do re-render do React, para que o useMemo dos
      // gráficos leia os tokens CSS corretos durante o render seguinte.
      document.body.classList.toggle('theme-dark', next === 'dark')
      return next
    })

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider')
  }
  return context
}
