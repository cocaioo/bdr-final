import { useState } from 'react'

import type { QueryPanel } from '../types'

interface QueryDrawerProps {
  panel: QueryPanel
}

export function QueryDrawer({ panel }: QueryDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="query-section">
      <button type="button" className="query-toggle" onClick={() => setOpen((current) => !current)}>
        {open ? 'Ocultar query' : 'Ver query'}
      </button>
      {open ? (
        <aside className="query-drawer">
          <p className="query-path">{panel.sql_path}</p>
          <p className="query-explanation">{panel.explanation}</p>
          <pre>{panel.sql_text}</pre>
        </aside>
      ) : null}
    </section>
  )
}

