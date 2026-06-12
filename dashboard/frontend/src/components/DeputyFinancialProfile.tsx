import { useMemo } from 'react'
import { DeputyAvatar } from './DeputyAvatar'
import { formatCurrency } from '../utils/format'
import type { QuestionPayload } from '../types'

interface DeputyFinancialProfileProps {
  deputyId: string | number
  deputyName: string
  q1Data: QuestionPayload | null
  q7Data: QuestionPayload | null
  q12Data: QuestionPayload | null
  q13Data: QuestionPayload | null
  onClose: () => void
}

export function DeputyFinancialProfile({
  deputyId,
  deputyName,
  q1Data,
  q7Data,
  q12Data,
  q13Data,
  onClose,
}: DeputyFinancialProfileProps) {
  const depIdStr = String(deputyId)

  // 1. Q1 info
  const q1Info = useMemo(() => {
    if (!q1Data) return null
    const rows = q1Data.table_spec.rows
    const idx = rows.findIndex((r) => String(r.id_deputado || '') === depIdStr)
    if (idx === -1) return null
    return {
      row: rows[idx],
      rank: idx + 1,
      totalSpend: Number(rows[idx].gasto_total || 0),
      party: String(rows[idx].sigla_partido || ''),
      uf: String(rows[idx].sigla_uf || ''),
    }
  }, [q1Data, depIdStr])

  // 2. Q7 info
  const q7Info = useMemo(() => {
    if (!q7Data) return null
    const rows = q7Data.table_spec.rows
    const row = rows.find((r) => String(r.id_deputado || '') === depIdStr)
    if (!row) return null
    return {
      custoBeneficio: Number(row.custo_beneficio || 0),
      beneficio: Number(row.beneficio || 0),
      proposicoes: Number(row.qtd_proposicoes || 0),
      aprovadas: Number(row.proposicoes_aprovadas || 0),
      presenca: Number(row.presenca_total || 0),
    }
  }, [q7Data, depIdStr])

  // 3. Q12 info (Top suppliers for this deputy)
  const topSuppliers = useMemo(() => {
    if (!q12Data) return []
    const rows = q12Data.table_spec.rows
    return rows
      .filter((r) => String(r.id_deputado || '') === depIdStr)
      .slice(0, 5)
  }, [q12Data, depIdStr])

  // 4. Q13 info (Categories for this deputy)
  const topCategories = useMemo(() => {
    if (!q13Data) return []
    const rows = q13Data.table_spec.rows
    return rows
      .filter((r) => String(r.id_deputado || '') === depIdStr)
      .slice(0, 5)
  }, [q13Data, depIdStr])

  const party = q1Info?.party || ''
  const uf = q1Info?.uf || ''

  return (
    <div className="deputy-profile-panel stagger-item">
      <div className="profile-header-row">
        <div className="profile-title-group">
          <DeputyAvatar id={depIdStr} nome={deputyName} size={64} />
          <div className="profile-meta">
            <h2>{deputyName}</h2>
            <p className="profile-sub">
              {party && uf ? `${party} - ${uf}` : 'Dados do deputado'} | ID: {depIdStr}
            </p>
          </div>
        </div>
        <button type="button" className="close-profile-btn" onClick={onClose} aria-label="Fechar perfil">
          &times; Limpar Busca
        </button>
      </div>

      <div className="profile-grid">
        {/* Bloco de Resumo Financeiro */}
        <div className="profile-card">
          <h3>Resumo Financeiro</h3>
          <div className="profile-stat-box">
            <div className="profile-main-stat">
              <span className="stat-label">Gasto Total Geral</span>
              <span className="stat-value highlight-currency">
                {q1Info ? formatCurrency(q1Info.totalSpend) : '---'}
              </span>
              {q1Info && (
                <span className="stat-rank-desc">
                  Posição #{q1Info.rank} no recorte atual
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bloco de Custo-Benefício */}
        <div className="profile-card">
          <h3>Métricas de Custo-Benefício</h3>
          {q7Info ? (
            <div className="profile-cb-stats">
              <div className="profile-stat-row">
                <span>Score Custo-Benefício:</span>
                <strong className="score-badge">
                  {q7Info.custoBeneficio.toLocaleString('pt-BR', { maximumFractionDigits: 5 })}
                </strong>
              </div>
              <div className="profile-stat-row">
                <span>Benefício Estimado:</span>
                <strong>{q7Info.beneficio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="profile-stat-grid">
                <div className="profile-mini-stat">
                  <span className="mini-label">Presença</span>
                  <span className="mini-value">{q7Info.presenca}</span>
                </div>
                <div className="profile-mini-stat">
                  <span className="mini-label">Proposições</span>
                  <span className="mini-value">{q7Info.proposicoes}</span>
                </div>
                <div className="profile-mini-stat">
                  <span className="mini-label">Aprovadas</span>
                  <span className="mini-value">{q7Info.aprovadas}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="profile-info-empty">Métricas de custo-benefício não encontradas neste recorte.</p>
          )}
        </div>

        {/* Bloco de Fornecedores Preferenciais */}
        <div className="profile-card">
          <h3>Principais Fornecedores</h3>
          <div className="profile-mini-list">
            {topSuppliers.map((sup, idx) => {
              const supName = String(sup.fornecedor || '')
              const total = Number(sup.total_pago || 0)
              const count = Number(sup.qtd_lancamentos || 0)
              return (
                <div key={idx} className="profile-mini-item">
                  <div className="item-label-group">
                    <span className="item-label" title={supName}>{supName}</span>
                    <span className="item-sub-desc">{count} lançamento(s)</span>
                  </div>
                  <strong className="item-value">{formatCurrency(total)}</strong>
                </div>
              )
            })}
            {topSuppliers.length === 0 && (
              <p className="profile-info-empty">Nenhum fornecedor encontrado neste recorte.</p>
            )}
          </div>
        </div>

        {/* Bloco de Categorias de Gasto */}
        <div className="profile-card">
          <h3>Maiores Categorias de Despesa</h3>
          <div className="profile-mini-list">
            {topCategories.map((cat, idx) => {
              const catName = String(cat.descricao_despesa || '')
              const total = Number(cat.gasto_total || 0)
              const pct = Number(cat.pct_total || 0)
              return (
                <div key={idx} className="profile-mini-item">
                  <div className="item-label-group">
                    <span className="item-label" title={catName}>{catName}</span>
                    <span className="item-sub-desc">{pct.toFixed(2)}% do total</span>
                  </div>
                  <strong className="item-value">{formatCurrency(total)}</strong>
                </div>
              )
            })}
            {topCategories.length === 0 && (
              <p className="profile-info-empty">Nenhuma categoria encontrada neste recorte.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
