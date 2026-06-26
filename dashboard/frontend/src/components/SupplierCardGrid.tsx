import { formatCurrency } from '../utils/format'

interface SupplierCardGridProps {
  rows: Array<Record<string, unknown>>
  limit?: number
}

export function SupplierCardGrid({ rows, limit = 6 }: SupplierCardGridProps) {
  const items = rows.slice(0, limit)

  return (
    <div className="supplier-card-grid">
      {items.map((row, index) => {
        const name = String(row.fornecedor || '')
        const total = Number(row.total_pago || 0)
        const count = Number(row.qtd_lancamentos || 0)
        const pct = Number(row.pct_total || 0)

        return (
          <div key={index} className="supplier-card">
            <div className="supplier-card-header">
              <span className="supplier-card-rank">#{index + 1}</span>
              <span className="supplier-card-pct">{pct.toFixed(2)}%</span>
            </div>
            <h4 className="supplier-card-name" title={name}>{name}</h4>
            <div className="supplier-card-stats">
              <div className="supplier-stat">
                <span className="stat-label">Total Pago</span>
                <span className="stat-value">{formatCurrency(total)}</span>
              </div>
              <div className="supplier-stat">
                <span className="stat-label">Lançamentos</span>
                <span className="stat-value">{count.toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div className="supplier-card-progress-track">
              <div
                className="supplier-card-progress-bar"
                style={{ width: `${Math.min(100, Math.max(1, pct))}%` }}
              />
            </div>
          </div>
        )
      })}
      {items.length === 0 && (
        <p className="supplier-empty">Nenhum fornecedor encontrado.</p>
      )}
    </div>
  )
}
