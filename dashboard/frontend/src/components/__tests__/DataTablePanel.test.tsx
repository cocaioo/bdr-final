import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { DataTablePanel } from '../DataTablePanel'
import type { TableSpec, TableState } from '../../types'

const table: TableSpec = {
  title: 'Tabela teste',
  columns: [
    { key: 'nome', label: 'Nome', numeric: false },
    { key: 'valor', label: 'Valor', numeric: true },
  ],
  rows: [{ nome: 'Deputado A', valor: 100 }],
  total: 9,
  page: 2,
  page_size: 10,
  sort_dir: 'desc',
}

const state: TableState = {
  page: 2,
  pageSize: 10,
  sortDir: 'desc',
}

describe('DataTablePanel', () => {
  it('clamps the page when current page exceeds filtered page count', async () => {
    const onChange = vi.fn()

    render(<DataTablePanel table={table} state={state} onChange={onChange} />)

    expect(screen.getByText('9 registros | pagina 1 de 1')).toBeInTheDocument()

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ ...state, page: 1 })
    })
  })
})
