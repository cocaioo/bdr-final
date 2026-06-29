import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchDeputies, fetchDeputyAlignmentScores, fetchDeputyGastosSummary, fetchDeputyIdentityFromGastos, fetchDeputyTemasNuvem, fetchQuestionForDeputy, fetchDeputyPresenca } from '../api'
import type { DeputyAlignmentScores } from '../api'
import { ChartPanel } from '../components/ChartPanel'
import { DeputyAvatar } from '../components/DeputyAvatar'
import { DeputySearch } from '../components/DeputySearch'
import { DeputyTemaWordCloud } from '../components/DeputyTemaWordCloud'
import type { ChartSpec, DeputyGastosProfile, DeputyIdentityEnrichment, DeputyOption, DeputyTemaItem, DeputyPresencaItem } from '../types'
import * as echarts from 'echarts'
import { formatCurrency } from '../utils/format'

function optionalLabel(value?: string): string {
  return value && value.trim() ? value : 'Não informado'
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

// Cortes derivados do min/max real de ideologia_score por ideologia_faixa em
// dados_padronizados/partidos_ideologia.csv (ponto medio entre o max de uma
// faixa e o min da proxima) — mais fiel aos dados reais do que dividir 0-10
// em 6 partes iguais.
function classifyScoreCalibrado(score: number): string {
  if (score < 1.6) return 'Extrema esquerda'
  if (score < 3.13) return 'Esquerda'
  if (score < 5.07) return 'Centro-esquerda'
  if (score < 7.19) return 'Centro-direita'
  if (score < 8.54) return 'Direita'
  return 'Extrema direita'
}

function numericValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

interface RatingInfo {
  label: string
  color: string
  bg: string
  border: string
  description: string
}

function getDeputyRating(posicao: number | null, elegivel: boolean): RatingInfo {
  if (!elegivel || posicao === null) {
    return {
      label: 'Não classificado',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
      border: '1px solid #94a3b8',
      description: 'Este deputado não atende aos requisitos mínimos de atividade parlamentar para integrar o ranking principal da Q7.'
    }
  }
  if (posicao <= 50) {
    return {
      label: 'Excelente custo-benefício',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: '1px solid #10b981',
      description: 'Entre os 50 deputados mais eficientes (Top 10%). Excelente relação de produção legislativa ponderada por gasto.'
    }
  }
  if (posicao <= 150) {
    return {
      label: 'Bom custo-benefício',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid #3b82f6',
      description: 'Desempenho acima da média nacional (Top 30%). Boa eficiência legislativa em relação às despesas do mandato.'
    }
  }
  if (posicao <= 350) {
    return {
      label: 'Regular',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid #f59e0b',
      description: 'Atuação e despesas de mandato dentro da média esperada do parlamento brasileiro (Top 70%).'
    }
  }
  return {
    label: 'Abaixo da média',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    description: 'Baixa eficiência legislativa ou gasto de mandato elevado em relação ao volume de proposições substantivas (Bottom 30%).'
  }
}

interface DeputyGaugeProps {
  posicao: number | null
  elegivel: boolean
}

function DeputyGauge({ posicao, elegivel }: DeputyGaugeProps) {
  const cx = 100
  const cy = 90
  const r = 70
  const strokeWidth = 14

  const polarToCartesian = (x: number, y: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0
    return {
      x: x + radius * Math.cos(angleInRadians),
      y: y - radius * Math.sin(angleInRadians)
    }
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, startAngle)
    const end = polarToCartesian(x, y, radius, endAngle)
    const largeArcFlag = startAngle - endAngle <= 180 ? '0' : '1'
    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y
    ].join(' ')
  }

  let rotation = 0
  let hasNeedle = false

  if (elegivel && posicao !== null) {
    hasNeedle = true
    let angle = 90

    if (posicao <= 50) {
      // Green zone: 43 to 3 degrees (with gaps)
      // Map 1 to 10 deg, 50 to 40 deg
      const pct = (posicao - 1) / 49
      angle = 10 + pct * 30
    } else if (posicao <= 150) {
      // Blue zone: 87 to 47 degrees
      // Map 51 to 50 deg, 150 to 85 deg
      const pct = (posicao - 51) / 99
      angle = 50 + pct * 35
    } else if (posicao <= 350) {
      // Yellow zone: 133 to 93 degrees
      // Map 151 to 95 deg, 350 to 130 deg
      const pct = (posicao - 151) / 199
      angle = 95 + pct * 35
    } else {
      // Red zone: 177 to 137 degrees
      // Map 351 to 140 deg, 500+ to 170 deg
      const maxPos = Math.max(500, posicao)
      const pct = (posicao - 351) / (maxPos - 351)
      angle = 140 + pct * 30
    }

    rotation = 90 - angle
  }

  const redColor = elegivel ? '#ef4444' : '#cbd5e1'
  const yellowColor = elegivel ? '#f59e0b' : '#e2e8f0'
  const blueColor = elegivel ? '#3b82f6' : '#cbd5e1'
  const greenColor = elegivel ? '#10b981' : '#e2e8f0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '200px', flexShrink: 0 }}>
      <svg width="200" height="110" viewBox="0 0 200 110" style={{ overflow: 'visible' }}>
        {/* Gray background track */}
        <path
          d={describeArc(cx, cy, r, 180, 0)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ opacity: 0.3 }}
        />
        {/* Red segment (left: 177 to 137 deg) */}
        <path
          d={describeArc(cx, cy, r, 177, 137)}
          fill="none"
          stroke={redColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Yellow segment (133 to 93 deg) */}
        <path
          d={describeArc(cx, cy, r, 133, 93)}
          fill="none"
          stroke={yellowColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Blue segment (87 to 47 deg) */}
        <path
          d={describeArc(cx, cy, r, 87, 47)}
          fill="none"
          stroke={blueColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />
        {/* Green segment (right: 43 to 3 deg) */}
        <path
          d={describeArc(cx, cy, r, 43, 3)}
          fill="none"
          stroke={greenColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Labels */}
        <text x="18" y="105" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600" style={{ opacity: 0.8 }}>Pior</text>
        <text x="182" y="105" fill="var(--muted)" fontSize="9" textAnchor="middle" fontWeight="600" style={{ opacity: 0.8 }}>Melhor</text>

        {/* Needle pointer */}
        {hasNeedle && (
          <g transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
            <path d="M -4.5,0 L 0,-56 L 4.5,0 Z" fill="#334155" />
            <circle cx="0" cy="0" r="7" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
            <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
          </g>
        )}
      </svg>
      {elegivel && posicao !== null && (
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', marginTop: '-4px', color: 'var(--muted)' }}>
          Posição: #{posicao}
        </span>
      )}
    </div>
  )
}

interface DeputyCostBenefitProfile {
  posicao: number | null
  indice: number
  gastoTotal: number
  gastoAjustado: number
  totalProposicoes: number
  scoreTotal: number
  scoreAjustado: number
  periodoLabel: string
  anoParcial: boolean
  totalProposicoesSubstantivas: number
  totalProposicoesAprovadas: number
  elegivel: boolean
  motivoInelegibilidade: string | null
}

function LoadingSkeleton() {
  return (
    <main className="deputy-profile" aria-busy="true">
      <section className="deputy-profile__hero deputy-profile__hero--loading">
        <div className="deputy-profile__loading-identity">
          <div className="skeleton deputy-profile__avatar-skeleton" />
          <div className="deputy-profile__loading-copy">
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 180px)', height: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 320px)', height: 28 }} />
            <div className="skeleton skeleton-text" style={{ width: 'min(100%, 240px)', height: 12 }} />
          </div>
        </div>
      </section>
    </main>
  )
}

function ProfileField({ label, value, helpText }: { label: string; value: React.ReactNode; helpText?: string }) {
  return (
    <div className="deputy-profile__fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {helpText && (
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--muted)',
            fontWeight: 'normal',
            marginTop: '4px',
            lineHeight: '1.3'
          }}
        >
          {helpText}
        </span>
      )}
    </div>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="deputy-profile__section-heading">
      <div>
        <span className="deputy-profile__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </header>
  )
}

function buildGastosDonutSpec(
  title: string,
  description: string,
  rows: Array<{ name: string; valor_total: number; qtd_despesas: number }>,
): ChartSpec {
  return {
    type: 'donut',
    title,
    description,
    x_field: null,
    y_fields: ['valor_total'],
    categories: rows.map((row) => row.name),
    series: [
      {
        name: title,
        data: rows.map((row) => ({ name: row.name, value: row.valor_total, qtd_despesas: row.qtd_despesas })),
      },
    ],
    options: { chart_height: 340 },
  }
}

function EmptyGastos() {
  return (
    <div className="deputy-profile__empty" role="status">
      <strong>Nenhum dado de gasto disponível para este deputado.</strong>
      <span>O perfil cadastral continua disponível; esta seção será preenchida quando houver dados nos endpoints atuais.</span>
    </div>
  )
}

function GastosSection({ data, loading, error }: { data: DeputyGastosProfile | null; loading: boolean; error: string | null }) {
  if (loading) {
    return <div className="deputy-profile__empty" role="status">Carregando dados reais de despesas…</div>
  }
  if (error) {
    return (
      <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
        <strong>Não foi possível carregar os gastos agora.</strong>
        <span>O restante do perfil permanece disponível.</span>
      </div>
    )
  }
  if (!data?.hasData) return <EmptyGastos />

  const annualMax = Math.max(...data.evolution.map((item) => item.valor_total), 1)

  return (
    <>
      {data.summary ? (
        <div className="deputy-profile__metrics" aria-label="Resumo de gastos">
          <ProfileField label="Despesas realizadas" value={formatCurrency(data.summary.valor_total)} />
          <ProfileField label="Quantidade de despesas" value={formatNumber(data.summary.qtd_despesas)} />
          <ProfileField label="Despesa média" value={formatCurrency(data.summary.ticket_medio)} />
          <ProfileField label="Fornecedores" value={formatNumber(data.summary.qtd_fornecedores)} />
        </div>
      ) : null}

      <div className="deputy-profile__analytics-grid">
        {data.categories.length ? (
          <ChartPanel
            spec={buildGastosDonutSpec(
              'Principais categorias',
              'Distribuição dos gastos por categoria de despesa.',
              data.categories.map((item) => ({ name: item.categoria, valor_total: item.valor_total, qtd_despesas: item.qtd_despesas })),
            )}
          />
        ) : (
          <article className="deputy-profile__data-card">
            <h3>Principais categorias</h3>
            <p className="deputy-profile__inline-empty">Categorias não disponíveis.</p>
          </article>
        )}

        {data.suppliers.length ? (
          <ChartPanel
            spec={buildGastosDonutSpec(
              'Principais fornecedores',
              'Distribuição dos gastos por fornecedor.',
              data.suppliers.map((item) => ({ name: item.fornecedor, valor_total: item.valor_total, qtd_despesas: item.qtd_despesas })),
            )}
          />
        ) : (
          <article className="deputy-profile__data-card">
            <h3>Principais fornecedores</h3>
            <p className="deputy-profile__inline-empty">Fornecedores não disponíveis.</p>
          </article>
        )}
      </div>

      {data.evolution.length ? (
        <article className="deputy-profile__data-card">
          <h3>Evolução anual</h3>
          <div className="deputy-profile__year-chart" aria-label="Gastos por ano">
            {data.evolution.map((item) => (
              <div key={item.ano} className="deputy-profile__year-item">
                <strong>{formatCurrency(item.valor_total)}</strong>
                <div className="deputy-profile__year-bar"><span style={{ height: `${Math.max((item.valor_total / annualMax) * 100, 3)}%` }} /></div>
                <span>{item.ano}</span>
                <small>{formatNumber(item.qtd_despesas)} despesas</small>
              </div>
            ))}
          </div>
        </article>
      ) : null}


      {data.partialErrors.length ? (
        <p className="deputy-profile__partial-note">Alguns recortes não puderam ser carregados: {data.partialErrors.join(', ')}.</p>
      ) : null}
    </>
  )
}

function PresenceChart({ data, type }: { data: DeputyPresencaItem[]; type: 'plenario' | 'comissoes' }) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);

    const years = ['2023', '2024', '2025', '2026'];
    
    const mapByYear = (field: keyof DeputyPresencaItem) => {
      return years.map(y => {
        const item = data.find(d => String(d.ano_dados) === y);
        return item ? Number(item[field]) : 0;
      });
    };

    const presencas = mapByYear(type === 'plenario' ? 'plenario_presencas' : 'comissoes_presencas');
    const justificadas = mapByYear(type === 'plenario' ? 'plenario_ausencias_justificadas' : 'comissoes_ausencias_justificadas');
    const nao_justificadas = mapByYear(type === 'plenario' ? 'plenario_ausencias_nao_justificadas' : 'comissoes_ausencias_nao_justificadas');

    const unit = type === 'plenario' ? 'dias' : 'reuniões';

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        formatter: (params: any) => {
          let res = `<div style="font-weight: bold; margin-bottom: 4px; color: #f1f5f9;">Ano ${params[0].name}</div>`;
          params.forEach((p: any) => {
            res += `<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 0.85rem; color: #cbd5e1;">
              <span>${p.marker} ${p.seriesName}:</span>
              <span style="font-weight: bold; color: #f1f5f9;">${p.value} ${unit}</span>
            </div>`;
          });
          return res;
        }
      },
      legend: {
        data: ['Presenças', 'Ausências Justificadas', 'Ausências Não Justificadas'],
        textStyle: { color: '#334155', fontSize: 11 },
        top: 0
      },
      grid: {
        top: '40px',
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#475569' }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        axisLabel: { color: '#475569' }
      },
      series: [
        {
          name: 'Presenças',
          type: 'bar',
          stack: 'total',
          data: presencas,
          itemStyle: { color: '#16a34a' }
        },
        {
          name: 'Ausências Justificadas',
          type: 'bar',
          stack: 'total',
          data: justificadas,
          itemStyle: { color: '#d97706' }
        },
        {
          name: 'Ausências Não Justificadas',
          type: 'bar',
          stack: 'total',
          data: nao_justificadas,
          itemStyle: { color: '#dc2626' }
        }
      ]
    };

    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [data, type]);

  return <div ref={chartRef} style={{ width: '100%', height: '300px' }} />;
}

import { useRef } from 'react';

function PresenceDashboard({ data }: { data: DeputyPresencaItem[] }) {
  const availableYears = useMemo(() => {
    return Array.from(new Set(data.map(d => d.ano_dados))).sort((a, b) => b - a);
  }, [data]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears.includes(2026) ? 2026 : (availableYears[0] ?? 2026);
  });

  const yearData = useMemo(() => {
    return data.find(d => d.ano_dados === selectedYear) || {
      plenario_presencas: 0,
      plenario_ausencias_justificadas: 0,
      plenario_ausencias_nao_justificadas: 0,
      comissoes_presencas: 0,
      comissoes_ausencias_justificadas: 0,
      comissoes_ausencias_nao_justificadas: 0,
      source_url: '',
      scraped_at: ''
    };
  }, [data, selectedYear]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          Dados de presença obtidos via scraping do portal da Câmara.
          {yearData.scraped_at && (
            <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>
              Atualizado em: {new Date(yearData.scraped_at).toLocaleDateString('pt-BR')} {yearData.source_url && (
                <>
                  (Fonte: <a href={yearData.source_url} target="_blank" rel="noreferrer">Portal Câmara</a>)
                </>
              )}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              style={{
                background: selectedYear === year ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                color: selectedYear === year ? '#fff' : 'var(--primary)',
                border: '1px solid',
                borderColor: selectedYear === year ? 'var(--primary)' : 'var(--border)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <article className="deputy-profile__data-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
            Plenário ({selectedYear})
          </h3>
          <div className="deputy-profile__metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Presenças</span>
              <strong style={{ color: 'var(--ok)', fontSize: '1.3rem' }}>{yearData.plenario_presencas} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--muted)' }}>dias</span></strong>
            </div>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Justificadas</span>
              <strong style={{ color: 'var(--warn)', fontSize: '1.3rem' }}>{yearData.plenario_ausencias_justificadas} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--muted)' }}>dias</span></strong>
            </div>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Não Justif.</span>
              <strong style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>{yearData.plenario_ausencias_nao_justificadas} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--muted)' }}>dias</span></strong>
            </div>
          </div>
        </article>

        <article className="deputy-profile__data-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
            Comissões ({selectedYear})
          </h3>
          <div className="deputy-profile__metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Presenças</span>
              <strong style={{ color: 'var(--ok)', fontSize: '1.3rem' }}>{yearData.comissoes_presencas} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--muted)' }}>reuniões</span></strong>
            </div>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Justificadas</span>
              <strong style={{ color: 'var(--warn)', fontSize: '1.3rem' }}>{yearData.comissoes_ausencias_justificadas} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--muted)' }}>reuniões</span></strong>
            </div>
            <div className="deputy-profile__fact" style={{ minHeight: '80px', justifyContent: 'center' }}>
              <span>Não Justif.</span>
              <strong style={{ color: 'var(--danger)', fontSize: '1.3rem' }}>{yearData.comissoes_ausencias_nao_justificadas} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--muted)' }}>reuniões</span></strong>
            </div>
          </div>
        </article>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginTop: '12px' }}>
        <article className="deputy-profile__data-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--primary)' }}>Evolução Anual (Plenário)</h3>
          <PresenceChart data={data} type="plenario" />
        </article>
        <article className="deputy-profile__data-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--accent)' }}>Evolução Anual (Comissões)</h3>
          <PresenceChart data={data} type="comissoes" />
        </article>
      </div>
    </div>
  );
}


// ─── Q7 REDESIGN ─────────────────────────────────────────────────────────────
// Chamber baseline (global period, from q7 summary data)
const CHAMBER_AVG_INDICE = 0.48472
const CHAMBER_AVG_SCORE  = 486.57
const CHAMBER_AVG_GASTO  = 756916649.41 / 609   // ~1,243,706 per deputy
const TOTAL_DEPUTIES     = 609

function buildInterpretationSentence(data: DeputyCostBenefitProfile): string {
  const { posicao, elegivel, scoreTotal, gastoTotal, periodoLabel, anoParcial } = data
  if (!elegivel) return 'Este deputado não atende aos requisitos mínimos de atividade parlamentar para integrar o ranking Q7.'
  const scoreRel = scoreTotal / (CHAMBER_AVG_SCORE || 1)
  const gastoRel = gastoTotal / (CHAMBER_AVG_GASTO  || 1)
  const scoreHigher = scoreRel > 1.05
  const scoreLower  = scoreRel < 0.95
  const gastoLower  = gastoRel < 0.95
  const gastoHigher = gastoRel > 1.05
  const periodoStr  = anoParcial ? `${periodoLabel} (parcial)` : periodoLabel

  if (scoreHigher && gastoLower) {
    const sp = Math.round((scoreRel - 1) * 100)
    const gp = Math.round((1 - gastoRel) * 100)
    return `No período ${periodoStr}, produziu ${sp}% mais atividade legislativa que a média da Câmara gastando ${gp}% menos.`
  }
  if (scoreHigher && gastoHigher) {
    const sp = Math.round((scoreRel - 1) * 100)
    const gp = Math.round((gastoRel - 1) * 100)
    return `Alta produção legislativa no período ${periodoStr} (${sp}% acima da média), acompanhada de despesas ${gp}% acima da média da Câmara.`
  }
  if (scoreHigher && !gastoHigher && !gastoLower) {
    const sp = Math.round((scoreRel - 1) * 100)
    return `Alta produção legislativa no período ${periodoStr} (${sp}% acima da média), com despesas dentro da média da Câmara.`
  }
  if (scoreLower && gastoLower) {
    const sp = Math.round((1 - scoreRel) * 100)
    const gp = Math.round((1 - gastoRel) * 100)
    return `No período ${periodoStr}, produção legislativa abaixo da média (${sp}% abaixo da média) — mas com despesas também contidas (${gp}% abaixo da média).`
  }
  if (scoreLower && gastoHigher) {
    const sp = Math.round((1 - scoreRel) * 100)
    const gp = Math.round((gastoRel - 1) * 100)
    return `Baixa produção legislativa (${sp}% abaixo da média) com despesas ${gp}% acima da média no período ${periodoStr}.`
  }
  if (scoreLower && !gastoHigher && !gastoLower) {
    const sp = Math.round((1 - scoreRel) * 100)
    return `Produção legislativa abaixo da média no período ${periodoStr} (${sp}% abaixo da média), com despesas dentro da média da Câmara.`
  }
  if (!scoreHigher && !scoreLower && gastoLower) {
    const gp = Math.round((1 - gastoRel) * 100)
    return `Produção legislativa dentro da média, com despesas contidas (${gp}% abaixo da média) no período ${periodoStr}.`
  }
  if (!scoreHigher && !scoreLower && gastoHigher) {
    const gp = Math.round((gastoRel - 1) * 100)
    return `Produção legislativa dentro da média, com despesas ${gp}% acima da média no período ${periodoStr}.`
  }
  if (posicao !== null && posicao <= 50) {
    return `Entre os 50 deputados mais eficientes da Câmara no período ${periodoStr}.`
  }
  return `Produção legislativa e despesas dentro da faixa esperada para o período ${periodoStr}.`
}

function buildInterpretationDetail(data: DeputyCostBenefitProfile): string | null {
  if (!data.elegivel || data.posicao === null) return null
  const pct = Math.round((1 - data.posicao / TOTAL_DEPUTIES) * 100)
  if (data.posicao <= 10)  return `Está entre os 10 deputados mais eficientes da legislatura.`
  if (pct >= 90) return `Top ${100 - pct}% em eficiência — entre os melhores da Câmara.`
  if (pct >= 70) return `Acima de ${pct}% dos deputados em eficiência legislativa.`
  if (pct >= 30) return `Dentro da faixa central: eficiência acima de ${pct}% dos parlamentares.`
  return `Abaixo de ${100 - pct}% dos deputados em eficiência legislativa.`
}

// Phase 1 — Hero Card
function Q7HeroCard({ data, rating }: { data: DeputyCostBenefitProfile; rating: RatingInfo }) {
  const percentile = data.elegivel && data.posicao !== null
    ? Math.round((1 - data.posicao / TOTAL_DEPUTIES) * 100)
    : null
  const sentence = buildInterpretationSentence(data)

  return (
    <div style={{
      background: `linear-gradient(135deg, ${rating.bg} 0%, rgba(255,255,255,0.02) 100%)`,
      border: rating.border,
      borderRadius: '20px',
      padding: '28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      <div style={{ display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <DeputyGauge posicao={data.posicao} elegivel={data.elegivel} />
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: '4px',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Índice de Custo-Benefício
            </span>
            <span style={{
              display: 'block',
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: rating.color,
              lineHeight: 1,
            }}>
              {formatDecimal(data.indice, 4)}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{
              padding: '5px 13px', borderRadius: '999px',
              backgroundColor: rating.bg, color: rating.color, border: rating.border,
              fontSize: '0.76rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {rating.label}
            </span>
            {data.elegivel && data.posicao !== null && (
              <span style={{
                padding: '5px 13px', borderRadius: '999px',
                border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
                fontSize: '0.76rem', fontWeight: 600, color: 'var(--muted)',
              }}>
                #{data.posicao} de {TOTAL_DEPUTIES}
              </span>
            )}
            {percentile !== null && (
              <span style={{
                padding: '5px 13px', borderRadius: '999px',
                border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
                fontSize: '0.76rem', fontWeight: 600, color: 'var(--muted)',
              }}>
                Top {100 - percentile}%
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: '14px',
        fontSize: '0.9rem', color: 'var(--ink)', lineHeight: '1.55',
        fontStyle: 'italic', opacity: 0.85,
      }}>
        {sentence}
      </div>
    </div>
  )
}

// Phase 2 — Interpretation
function Q7Interpretation({ data, rating }: { data: DeputyCostBenefitProfile; rating: RatingInfo }) {
  const detail = buildInterpretationDetail(data)
  if (!detail) return null
  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'flex-start',
      padding: '14px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${rating.color}`,
      borderRadius: '12px',
    }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1, paddingTop: '2px', flexShrink: 0 }}>💡</span>
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.55 }}>{detail}</p>
    </div>
  )
}

// Phase 3 — Efficiency Map
function EfficiencyMap({ data, deputyName }: { data: DeputyCostBenefitProfile; deputyName: string }) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)
    const isLight = document.body.classList.contains('gastos-light-theme')
    const chamberScore = CHAMBER_AVG_SCORE
    const chamberGasto = CHAMBER_AVG_GASTO
    const depScore = data.scoreTotal
    const depGasto = data.gastoTotal
    const maxScore = Math.max(depScore, chamberScore) * 1.4 || 1
    const maxGasto  = Math.max(depGasto,  chamberGasto)  * 1.4 || 1

    // Mapeamento linear por partes para centralizar a média da Câmara em (50, 50)
    const cx = 50
    const cy = 50

    const dx = depGasto < chamberGasto
      ? (depGasto / chamberGasto) * 50
      : 50 + ((depGasto - chamberGasto) / (maxGasto - chamberGasto)) * 50

    const dy = depScore < chamberScore
      ? (depScore / chamberScore) * 50
      : 50 + ((depScore - chamberScore) / (maxScore - chamberScore)) * 50

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 30, bottom: 50, left: 60 },
      xAxis: {
        type: 'value', name: 'Despesas →', nameLocation: 'middle', nameGap: 32,
        min: 0, max: 100, axisLabel: { show: false },
        axisLine: { lineStyle: { color: isLight ? 'rgba(55,65,81,0.25)' : 'rgba(148,163,184,0.3)' } }, 
        splitLine: { show: false },
        nameTextStyle: { color: isLight ? '#1f2937' : '#94a3b8', fontWeight: 600, fontSize: 11 }
      },
      yAxis: {
        type: 'value', name: 'Produção Legislativa →', nameLocation: 'middle', nameGap: 46,
        min: 0, max: 100, axisLabel: { show: false },
        axisLine: { lineStyle: { color: isLight ? 'rgba(55,65,81,0.25)' : 'rgba(148,163,184,0.3)' } }, 
        splitLine: { show: false },
        nameTextStyle: { color: isLight ? '#1f2937' : '#94a3b8', fontWeight: 600, fontSize: 11 }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,20,30,0.92)', borderColor: 'rgba(148,163,184,0.2)',
        borderWidth: 1, textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: any) => {
          if (params.seriesIndex === 3)
            return `<b>Média da Câmara</b><br/>Score total: ${formatDecimal(chamberScore, 1)}<br/>Gasto méd.: ${formatCurrency(chamberGasto)}`
          return `<b>${deputyName}</b><br/>Score total: ${formatDecimal(depScore, 1)}<br/>Gasto: ${formatCurrency(depGasto)}`
        },
      },
      series: [
        {
          type: 'scatter', data: [],
          markArea: {
            silent: true,
            data: [
              [{ coord: [0,  50], itemStyle: { color: isLight ? 'rgba(16,185,129,0.03)' : 'rgba(16,185,129,0.06)' }  }, { coord: [50,  100] }],
              [{ coord: [50, 50], itemStyle: { color: isLight ? 'rgba(245,158,11,0.02)' : 'rgba(245,158,11,0.05)' }  }, { coord: [100, 100] }],
              [{ coord: [0,  0],  itemStyle: { color: isLight ? 'rgba(245,158,11,0.02)' : 'rgba(245,158,11,0.04)' }  }, { coord: [50,  50]  }],
              [{ coord: [50, 0],  itemStyle: { color: isLight ? 'rgba(239,68,68,0.03)'  : 'rgba(239,68,68,0.06)'  }  }, { coord: [100, 50]  }],
            ],
          },
        },
        {
          type: 'scatter', data: [],
          markLine: {
            silent: true, symbol: ['none', 'none'],
            lineStyle: { color: isLight ? 'rgba(55,65,81,0.18)' : 'rgba(148,163,184,0.2)', width: 1, type: 'dashed' as const },
            data: [[{ coord: [50, 0] }, { coord: [50, 100] }], [{ coord: [0, 50] }, { coord: [100, 50] }]],
          },
        },
        {
          type: 'scatter',
          data: [
            { value: [25, 95] as [number, number], label: { show: true, formatter: 'Alta produção\nBaixo custo',   fontSize: 9, color: isLight ? '#065f46' : 'rgba(16,185,129,0.7)',  fontWeight: 600, align: 'center' as const } },
            { value: [75, 95] as [number, number], label: { show: true, formatter: 'Alta produção\nAlto custo',    fontSize: 9, color: isLight ? '#b45309' : 'rgba(245,158,11,0.65)', fontWeight: 600, align: 'center' as const } },
            { value: [25,  5] as [number, number], label: { show: true, formatter: 'Baixa produção\nBaixo custo',  fontSize: 9, color: isLight ? '#4b5563' : 'rgba(148,163,184,0.5)', fontWeight: 600, align: 'center' as const } },
            { value: [75,  5] as [number, number], label: { show: true, formatter: 'Baixa produção\nAlto custo',   fontSize: 9, color: isLight ? '#b91c1c' : 'rgba(239,68,68,0.65)',  fontWeight: 600, align: 'center' as const } },
          ],
          symbolSize: 0,
        },
        {
          name: 'Média da Câmara', type: 'scatter',
          data: [[cx, cy] as [number, number]],
          symbolSize: 14,
          itemStyle: { color: isLight ? '#94a3b8' : 'rgba(148,163,184,0.6)', borderColor: isLight ? '#475569' : '#e2e8f0', borderWidth: 2 },
          label: { show: true, formatter: 'Média\nCâmara', position: 'top' as const, fontSize: 9, color: isLight ? '#334155' : '#a0aec0', fontWeight: 600, lineHeight: 14 },
        },
        {
          name: deputyName, type: 'scatter',
          data: [[dx, dy] as [number, number]],
          symbolSize: 20,
          itemStyle: { color: '#5b84a2', borderColor: '#b39ddb', borderWidth: 3, shadowColor: 'rgba(91,132,162,0.5)', shadowBlur: 12 },
          label: { show: true, formatter: 'Este\ndeputado', position: 'right' as const, fontSize: 9, color: isLight ? '#0f172a' : '#f8fafc', fontWeight: 700, lineHeight: 14 },
        },
      ],
    }

    chart.setOption(option)
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current!)
    return () => { ro.disconnect(); chart.dispose() }
  }, [data, deputyName])

  return <div ref={chartRef} style={{ width: '100%', height: '260px' }} />
}

// Phase 4 — Visual Formula
function Q7VisualFormula({ data }: { data: DeputyCostBenefitProfile }) {
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    borderRadius: '14px', padding: '14px 18px', textAlign: 'center',
    flex: '1 1 130px', minWidth: '110px',
  }
  const lbl: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--muted)',
    display: 'block', marginBottom: '6px',
  }
  const val: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', display: 'block' }
  const sub: React.CSSProperties = { fontSize: '0.68rem', color: 'var(--muted)', marginTop: '3px', display: 'block' }
  const op: React.CSSProperties  = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--muted)', fontSize: '1.3rem', fontWeight: 300,
    flexShrink: 0, padding: '0 4px',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
      <div style={card}>
        <span style={lbl}>Score Legislativo</span>
        <span style={val}>{formatDecimal(data.scoreAjustado, 2)}</span>
        <span style={sub}>ajustado (×0.75)</span>
      </div>
      <div style={op}>÷</div>
      <div style={card}>
        <span style={lbl}>Gasto Suavizado</span>
        <span style={val}>{formatDecimal(data.gastoAjustado, 2)}</span>
        <span style={sub}>real: {formatCurrency(data.gastoTotal)}</span>
      </div>
      <div style={op}>=</div>
      <div style={{
        ...card,
        background: 'rgba(91,132,162,0.08)',
        border: '1px solid rgba(91,132,162,0.3)',
        flex: '0 1 auto', minWidth: '130px',
      }}>
        <span style={{ ...lbl, color: 'var(--primary)' }}>Índice Final</span>
        <span style={{ ...val, fontSize: '1.4rem', color: 'var(--primary)' }}>{formatDecimal(data.indice, 5)}</span>
        <span style={sub}>custo-benefício Q7</span>
      </div>
    </div>
  )
}

// Phase 6 — Benchmark Bars
function BenchmarkBar({
  label, deputyValue, chamberValue, format, invert = false,
}: {
  label: string; deputyValue: number; chamberValue: number;
  format: (v: number) => string; invert?: boolean;
}) {
  const max = Math.max(deputyValue, chamberValue) * 1.18 || 1
  const depPct    = Math.min((deputyValue  / max) * 100, 100)
  const chamberPct = Math.min((chamberValue / max) * 100, 100)
  const ratio = deputyValue / (chamberValue || 1)
  const isBetter = invert ? ratio < 0.95 : ratio > 1.05
  const isWorse  = invert ? ratio > 1.05 : ratio < 0.95
  const barColor = isBetter ? 'var(--ok)' : isWorse ? 'var(--danger)' : 'var(--primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.82rem', color: barColor, fontWeight: 700 }}>{format(deputyValue)}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ background: 'rgba(148,163,184,0.1)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${depPct}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{
          position: 'absolute', top: '-3px', left: `${chamberPct}%`,
          transform: 'translateX(-50%)', width: '2px', height: '14px',
          background: 'rgba(148,163,184,0.55)', borderRadius: '1px',
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--muted)' }}>
        <span style={{ display: 'inline-block', width: '14px', height: '2px', background: 'rgba(148,163,184,0.55)', borderRadius: '1px', flexShrink: 0 }} />
        Média Câmara: {format(chamberValue)}
      </div>
    </div>
  )
}

// Master Q7 Section — composes all phases
function Q7Section({ data, deputyName }: { data: DeputyCostBenefitProfile; deputyName: string }) {
  const [showTechnical, setShowTechnical] = useState(false)
  const rating = getDeputyRating(data.posicao, data.elegivel)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {!data.elegivel && (
        <div style={{
          padding: '12px 16px', backgroundColor: 'rgba(239,68,68,0.08)',
          borderLeft: '4px solid var(--danger)', borderRadius: '8px',
          fontSize: '0.88rem', lineHeight: '1.5',
        }}>
          <strong style={{ color: 'var(--danger)' }}>Inelegível para o Ranking Principal:</strong>
          <span style={{ display: 'block', marginTop: '3px', color: 'var(--muted)' }}>{data.motivoInelegibilidade}</span>
        </div>
      )}

      {/* Phase 1: Hero */}
      <Q7HeroCard data={data} rating={rating} />

      {/* Phase 2: Interpretation */}
      <Q7Interpretation data={data} rating={rating} />

      {/* Phase 3: Efficiency Map */}
      <article className="deputy-profile__data-card">
        <h3 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', color: 'var(--ink)' }}>Mapa de Eficiência</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
          Posição do deputado em relação à média da Câmara. Eixo horizontal: despesas. Eixo vertical: produção legislativa.
        </p>
        <EfficiencyMap data={data} deputyName={deputyName} />
      </article>

      {/* Phase 4: Visual Formula */}
      <article className="deputy-profile__data-card">
        <h3 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', color: 'var(--ink)' }}>Como este índice é formado</h3>
        <Q7VisualFormula data={data} />
      </article>

      {/* Phase 6: Benchmark Bars */}
      <article className="deputy-profile__data-card">
        <h3 style={{ margin: '0 0 18px 0', fontSize: '0.92rem', color: 'var(--ink)' }}>Comparativo com a Câmara</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <BenchmarkBar
            label="Produção Legislativa (score total)"
            deputyValue={data.scoreTotal}
            chamberValue={CHAMBER_AVG_SCORE}
            format={(v) => formatDecimal(v, 1)}
          />
          <BenchmarkBar
            label="Despesas da Cota Parlamentar"
            deputyValue={data.gastoTotal}
            chamberValue={CHAMBER_AVG_GASTO}
            format={formatCurrency}
            invert={true}
          />
          <BenchmarkBar
            label="Índice de Custo-Benefício"
            deputyValue={data.indice}
            chamberValue={CHAMBER_AVG_INDICE}
            format={(v) => formatDecimal(v, 4)}
          />
        </div>
      </article>

      {/* Phase 5: Technical (collapsible) */}
      <article className="deputy-profile__data-card">
        <button
          onClick={() => setShowTechnical(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', color: 'var(--ink)', fontSize: '0.92rem',
            fontWeight: 600, fontFamily: 'inherit',
          }}
          aria-expanded={showTechnical}
        >
          <span>Como este índice foi calculado</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {showTechnical ? 'Recolher' : 'Ver detalhes'}
            <span style={{ fontSize: '0.95rem', display: 'inline-block', transition: 'transform 0.2s', transform: showTechnical ? 'rotate(180deg)' : 'none' }}>▾</span>
          </span>
        </button>

        {showTechnical && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <ProfileField label="Score total (bruto)"      value={formatDecimal(data.scoreTotal, 2)}        helpText="Soma de pontos das proposições ponderados por tipo, status e autoria." />
              <ProfileField label="Score ajustado (×0.75)"   value={formatDecimal(data.scoreAjustado, 2)}     helpText="Score suavizado por potência 0.75 para evitar distorções de alto volume." />
              <ProfileField label="Despesas consideradas"    value={formatCurrency(data.gastoTotal)}          helpText="Gasto efetivo da cota parlamentar (apenas valor_liquido > 0)." />
              <ProfileField label="Total de proposições"     value={formatNumber(data.totalProposicoes)} />
              <ProfileField label="Proposições substantivas" value={formatNumber(data.totalProposicoesSubstantivas)} helpText="PECs, PLs, PLPs e similares com impacto legislativo concreto." />
              <ProfileField label="Proposições aprovadas"    value={formatNumber(data.totalProposicoesAprovadas)}   helpText="Proposições de autoria do deputado aprovadas ou transformadas em lei." />
              <ProfileField label="Período"                  value={`${data.periodoLabel}${data.anoParcial ? ' (parcial)' : ''}`} />
              <ProfileField label="Posição no ranking"       value={data.posicao ? `#${data.posicao} de ${TOTAL_DEPUTIES}` : 'Não disponível'} helpText="Ranking global considera apenas anos completos (sem 2026 parcial)." />
            </div>
            <div style={{
              padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)', borderRadius: '8px',
              fontSize: '0.76rem', color: 'var(--muted)', lineHeight: '1.6',
            }}>
              <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>Metodologia</strong>
              O índice é calculado dividindo o score de proposições ajustado pelo gasto ajustado (normalizado por 1.000 R$).
              O score considera apenas anos completos no ranking global; 2026 aparece marcado como parcial no ranking anual.
              Deputados sem atividade mínima não integram o ranking principal.
            </div>
          </div>
        )}
      </article>
    </div>
  )
}
// ─── END Q7 REDESIGN ─────────────────────────────────────────────────────────


export function DeputyProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [catalog, setCatalog] = useState<DeputyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gastosState, setGastosState] = useState<{
    deputyId?: string
    data: DeputyGastosProfile | null
    error: string | null
  }>({ data: null, error: null })
  const [q7State, setQ7State] = useState<{
    deputyId?: string
    data: DeputyCostBenefitProfile | null
    error: string | null
  }>({ data: null, error: null })
  const [temasState, setTemasState] = useState<{
    deputyId?: string
    data: DeputyTemaItem[] | null
    error: string | null
  }>({ data: null, error: null })
  const [alignmentState, setAlignmentState] = useState<{
    deputyId?: string
    data: DeputyAlignmentScores | null
    error: string | null
  }>({ data: null, error: null })
  const [presencaState, setPresencaState] = useState<{
    deputyId?: string
    data: DeputyPresencaItem[] | null
    error: string | null
  }>({ data: null, error: null })
  const [identityEnrichment, setIdentityEnrichment] = useState<DeputyIdentityEnrichment>({})

  useEffect(() => {
    let active = true
    fetchDeputies()
      .then((items) => { if (active) setCatalog(items) })
      .catch((cause: Error) => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const deputy = useMemo(() => catalog.find((item) => item.id === id), [catalog, id])

  useEffect(() => {
    if (!deputy) return
    let active = true
    setIdentityEnrichment({})
    setQ7State({ data: null, error: null })
    setTemasState({ data: null, error: null })
    setAlignmentState({ data: null, error: null })
    setPresencaState({ data: null, error: null })
    fetchDeputyIdentityFromGastos(deputy.id)
      .then((enrichment) => { if (active) setIdentityEnrichment(enrichment) })
      .catch(() => { /* silently ignore; fallback to CSV values */ })
    fetchDeputyGastosSummary(deputy.id)
      .then((payload) => { if (active) setGastosState({ deputyId: deputy.id, data: payload, error: null }) })
      .catch((cause: Error) => { if (active) setGastosState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchDeputyTemasNuvem(deputy.id)
      .then((temas) => { if (active) setTemasState({ deputyId: deputy.id, data: temas, error: null }) })
      .catch((cause: Error) => { if (active) setTemasState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchDeputyAlignmentScores(deputy.id)
      .then((scores) => { if (active) setAlignmentState({ deputyId: deputy.id, data: scores, error: null }) })
      .catch((cause: Error) => { if (active) setAlignmentState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchDeputyPresenca(deputy.id)
      .then((presence) => { if (active) setPresencaState({ deputyId: deputy.id, data: presence, error: null }) })
      .catch((cause: Error) => { if (active) setPresencaState({ deputyId: deputy.id, data: null, error: cause.message }) })
    fetchQuestionForDeputy('q7', deputy.id, 1, 5)
      .then((payload) => {
        if (!active) return
        const row =
          payload.table_spec.rows.find((item) => String(item.id_deputado ?? '') === deputy.id) ??
          payload.table_spec.rows[0]
        if (!row) {
          setQ7State({ deputyId: deputy.id, data: null, error: null })
          return
        }
        setQ7State({
          deputyId: deputy.id,
          data: {
            posicao: row.posicao === undefined || row.posicao === null ? null : numericValue(row.posicao),
            indice: numericValue(row.indice_custo_beneficio),
            gastoTotal: numericValue(row.gasto_total),
            gastoAjustado: numericValue(row.gasto_ajustado ?? row.gasto_total),
            totalProposicoes: numericValue(row.total_proposicoes),
            scoreTotal: numericValue(row.score_proposicoes_total),
            scoreAjustado: numericValue(row.score_proposicoes_ajustado),
            periodoLabel: String(row.periodo_label ?? 'Global'),
            anoParcial: Boolean(row.ano_parcial),
            totalProposicoesSubstantivas: numericValue(row.total_proposicoes_substantivas),
            totalProposicoesAprovadas: numericValue(row.total_proposicoes_aprovadas),
            elegivel: row.elegivel_ranking !== undefined ? (String(row.elegivel_ranking).toLowerCase() === 'true' || row.elegivel_ranking === true) : true,
            motivoInelegibilidade: row.motivo_inelegibilidade ? String(row.motivo_inelegibilidade) : null,
          },
          error: null,
        })
      })
      .catch((cause: Error) => {
        if (active) {
          setQ7State({ deputyId: deputy.id, data: null, error: cause.message })
        }
      })
    return () => { active = false }
  }, [deputy])

  // Merge: API values take priority over CSV catalog values
  const partido = identityEnrichment.partido ?? deputy?.partido
  const uf = identityEnrichment.uf ?? deputy?.uf

  if (loading && !catalog.length) return <LoadingSkeleton />

  if (error || !deputy) {
    const catalogError = Boolean(error)
    return (
      <main className="deputy-profile">
        <section className="deputy-profile__error-panel">
          <span className="deputy-profile__eyebrow">{catalogError ? 'Erro ao carregar perfil' : 'Deputado não encontrado'}</span>
          <h1>{catalogError ? 'O catálogo de deputados não pôde ser carregado.' : 'Não localizamos um deputado com este ID.'}</h1>
          <p>{catalogError ? 'Verifique a conexão e tente novamente.' : `O identificador ${id ?? 'informado'} não existe no catálogo atual.`}</p>
          <div className="deputy-profile__error-actions"><Link to="/" className="deputy-profile__action-link">Voltar para a home</Link></div>
          <DeputySearch placeholder="Buscar outro deputado..." compact className="deputy-profile__error-search" />
        </section>
      </main>
    )
  }

  return (
    <main className="deputy-profile">
      <section className="deputy-profile__hero">
        <div className="deputy-profile__hero-main">
          <div className="deputy-profile__avatar-frame"><DeputyAvatar id={deputy.id} nome={deputy.nome} size={152} /></div>
          <div className="deputy-profile__heading">
            <span className="deputy-profile__eyebrow">Perfil parlamentar</span>
            <h1>{deputy.nome}</h1>
            <p className="deputy-profile__civil-name">{optionalLabel(deputy.nomeCivil)}</p>
            <div className="deputy-profile__chips" aria-label="Identificação parlamentar">
              <span className="deputy-profile__chip"><strong>{optionalLabel(partido)}</strong></span>
              <span className="deputy-profile__chip">UF <strong>{optionalLabel(uf)}</strong></span>
              <span className="deputy-profile__chip">ID {deputy.id}</span>
            </div>
          </div>
        </div>
        <div className="deputy-profile__hero-aside">
          <ProfileField label="Escolaridade" value={optionalLabel(deputy.escolaridade)} />

          <ProfileField label="Partido" value={optionalLabel(partido)} />
          <ProfileField label="Unidade federativa" value={optionalLabel(uf)} />
        </div>
      </section>

      <aside className="deputy-profile__context">
        Este perfil consolida informações individuais do parlamentar. Os painéis de bloco exibem análises gerais da legislatura.
      </aside>

      <section className="deputy-profile__section" aria-labelledby="resumo-heading">
        <SectionHeading eyebrow="Cadastro" title="Resumo rápido" description="Informações disponíveis no catálogo de deputados usado pelo projeto." />
        <div id="resumo-heading" className="deputy-profile__details-grid">
          <ProfileField label="Nome parlamentar" value={deputy.nome} />
          <ProfileField label="Nome civil" value={optionalLabel(deputy.nomeCivil)} />
          <ProfileField label="CPF" value={optionalLabel(deputy.cpf)} />
          <ProfileField label="ID do deputado" value={deputy.id} />
          <ProfileField
            label="Score ideológico"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.deputyScore !== null && alignmentState.data?.deputyScore !== undefined
                ? <span className="deputy-profile__score-tooltip" data-tooltip={`Valor do score: ${formatDecimal(alignmentState.data.deputyScore)}`}>{classifyScoreCalibrado(alignmentState.data.deputyScore)}</span>
                : 'Não disponível'
            }
          />
          <ProfileField
            label="Score ideológico do partido"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.partyScore !== null && alignmentState.data?.partyScore !== undefined && alignmentState.data?.partyFaixa
                ? <span className="deputy-profile__score-tooltip" data-tooltip={`Valor do score: ${formatDecimal(alignmentState.data.partyScore)}`}>{alignmentState.data.partyFaixa}</span>
                : 'Não disponível'
            }
          />
          <ProfileField
            label="Diferença de score ideológico (Deputado x Partido)"
            value={
              alignmentState.deputyId === deputy.id && alignmentState.data?.deviation !== null && alignmentState.data?.deviation !== undefined
                ? formatDecimal(alignmentState.data.deviation)
                : 'Não disponível'
            }
          />

          <ProfileField label="Fonte cadastral" value={deputy.uriDeputado ? <a href={deputy.uriDeputado} target="_blank" rel="noreferrer">Dados Abertos da Câmara</a> : 'Não informada'} />
        </div>
      </section>

      <section className="deputy-profile__section" aria-labelledby="gastos-heading">
        <SectionHeading eyebrow="Despesas" title="Gastos parlamentares" description="Valores consolidados a partir das fontes analíticas disponíveis." />
        <div id="gastos-heading">
          <GastosSection
            data={gastosState.deputyId === deputy.id ? gastosState.data : null}
            loading={gastosState.deputyId !== deputy.id}
            error={gastosState.deputyId === deputy.id ? gastosState.error : null}
          />
        </div>
      </section>

      <section className="deputy-profile__section" aria-labelledby="temas-heading">
        <SectionHeading
          eyebrow="Proposições"
          title="Temas mais trabalhados"
          description="Quantidade de proposições de autoria do deputado por tema legislativo. Temas sem proposições não aparecem na nuvem."
        />
        <div id="temas-heading">
          {temasState.deputyId !== deputy.id ? (
            <div className="deputy-profile__empty" role="status">Carregando temas legislativos…</div>
          ) : temasState.error ? (
            <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
              <strong>Não foi possível carregar os temas agora.</strong>
              <span>O restante do perfil permanece disponível.</span>
            </div>
          ) : temasState.data && temasState.data.length ? (
            <DeputyTemaWordCloud temas={temasState.data} />
          ) : (
            <div className="deputy-profile__empty" role="status">
              <strong>Nenhuma proposição com tema identificado para este deputado.</strong>
              <span>O perfil cadastral e os demais indicadores continuam disponíveis.</span>
            </div>
          )}
        </div>
      </section>

      <section className="deputy-profile__section" aria-labelledby="custo-beneficio-heading">
        <SectionHeading
          eyebrow="Q7"
          title="Índice de Custo-Benefício Parlamentar"
          description="Produção legislativa ponderada por gasto. Leia a conclusão primeiro; a metodologia está disponível abaixo."
        />
        <div id="custo-beneficio-heading">
          {q7State.deputyId !== deputy.id ? (
            <div className="deputy-profile__empty" role="status">Carregando indicador de custo-benefício...</div>
          ) : q7State.error ? (
            <div className="deputy-profile__empty deputy-profile__empty--error" role="alert">
              <strong>Não foi possível carregar o indicador de custo-benefício agora.</strong>
              <span>O restante do perfil continua disponível.</span>
            </div>
          ) : q7State.data ? (
            <Q7Section data={q7State.data} deputyName={deputy.nome} />
          ) : (
            <div className="deputy-profile__empty" role="status">
              <strong>Não há dados suficientes para calcular o índice deste deputado no período selecionado.</strong>
              <span>O card será preenchido assim que a Q7 retornar esse parlamentar no recorte global.</span>
            </div>
          )}
        </div>
      </section>

      <section className="deputy-profile__section" aria-labelledby="presenca-heading">
        <SectionHeading
          eyebrow="Assiduidade"
          title="Presença e Assiduidade Parlamentar"
          description="Estatísticas oficiais de presenças marcadas, ausências justificadas e ausências não justificadas."
        />
        <div id="presenca-heading">
          {presencaState.deputyId !== deputy.id ? (
            <div className="deputy-profile__empty" role="status">Carregando dados de presença…</div>
          ) : presencaState.error || !presencaState.data || presencaState.data.length === 0 ? (
            <div className="deputy-profile__empty" role="status">
              <strong>Dados de presença ainda não disponíveis para este parlamentar.</strong>
              <span>O perfil cadastral e os demais indicadores continuam disponíveis.</span>
            </div>
          ) : (
            <PresenceDashboard data={presencaState.data} />
          )}
        </div>
      </section>

      <section className="deputy-profile__section">
        <SectionHeading eyebrow="Visão ampla" title="Painéis gerais" description="Acesse os recortes consolidados da legislatura; estes links não aplicam filtro por deputado." />
        <div className="deputy-profile__actions">
          <Link to="/grupos/gastos" className="deputy-profile__action-link deputy-profile__action-link--primary">Abrir Painel de Gastos</Link>
          <Link to="/grupos/perfil" className="deputy-profile__action-link">Abrir Escolaridade e Perfil</Link>
          <Link to="/" className="deputy-profile__action-link">Voltar à página inicial</Link>
        </div>
      </section>
    </main>
  )
}
