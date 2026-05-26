import { useMemo } from 'react'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'

import type { TableSpec, TableState } from '../types'
import { formatCellValue } from '../utils/format'

interface DataTablePanelProps {
  table: TableSpec
  state: TableState
  onChange: (next: TableState) => void
  lockPageSize?: boolean
}

type DataRow = Record<string, unknown>

export function DataTablePanel({ table, state, onChange, lockPageSize = false }: DataTablePanelProps) {
  const columns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      table.columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: (context) => formatCellValue(context.getValue()),
      })),
    [table.columns],
  )

  const data = table.rows as DataRow[]
  const instance = useReactTable<DataRow>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const pageCount = Math.max(1, Math.ceil(table.total / state.pageSize))

  const toggleSort = (columnKey: string) => {
    if (state.sortBy === columnKey) {
      onChange({ ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc', page: 1 })
      return
    }
    onChange({ ...state, sortBy: columnKey, sortDir: 'asc', page: 1 })
  }

  return (
    <section className="table-section stagger-item">
      <header className="table-header">
        <h2>{table.title}</h2>
        <p>
          {table.total.toLocaleString('pt-BR')} registros | pagina {state.page} de {pageCount}
        </p>
      </header>
      <div className="table-wrapper">
        <table>
          <thead>
            {instance.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id}>
                    <button type="button" onClick={() => toggleSort(String(header.column.id))}>
                      {String(header.column.columnDef.header)}
                      {state.sortBy === header.column.id ? (
                        <span>{state.sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {instance.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{String(cell.renderValue() ?? '-')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <button
          type="button"
          onClick={() => onChange({ ...state, page: Math.max(1, state.page - 1) })}
          disabled={state.page <= 1}
        >
          Pagina anterior
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...state, page: Math.min(pageCount, state.page + 1) })}
          disabled={state.page >= pageCount}
        >
          Proxima pagina
        </button>
        {lockPageSize ? (
          <span>Linhas: {state.pageSize}</span>
        ) : (
          <label>
            Linhas:
            <select
              value={state.pageSize}
              onChange={(event) =>
                onChange({ ...state, pageSize: Number(event.target.value), page: 1 })
              }
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </footer>
    </section>
  )
}

