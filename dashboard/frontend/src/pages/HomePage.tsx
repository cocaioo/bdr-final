import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchDeputies, fetchQuestion } from '../api'
import { DeputySearch } from '../components/DeputySearch'

interface Q7Row {
  id_deputado: number | string
  posicao: number
  sigla_partido?: string
  sigla_uf?: string
  gasto_total: number
  total_proposicoes: number
  indice_custo_beneficio: number
  nome_parlamentar?: string
}

interface EnrichedDeputy {
  id: string
  nome: string
  partido: string
  uf: string
  escolaridade: string
  posicao: number
  gasto_total: number
  total_proposicoes: number
  indice_custo_beneficio: number
  fotoUrl: string
}

const getCustoBeneficioLevel = (val: number) => {
  if (val >= 2.0) {
    return {
      label: 'Excelente',
      color: '#10b981', // Verde
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)'
    }
  }
  if (val >= 1.0) {
    return {
      label: 'Bom',
      color: '#06b6d4', // Cyan
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)'
    }
  }
  if (val >= 0.4) {
    return {
      label: 'Médio',
      color: '#f59e0b', // Laranja/Amarelo
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)'
    }
  }
  return {
    label: 'Baixo',
    color: '#ef4444', // Vermelho
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)'
  }
}

export function HomePage() {
  const [deputies, setDeputies] = useState<EnrichedDeputy[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    // Busca o catálogo geral de deputados e o ranking Q7 em paralelo, tolerando falhas individuais
    Promise.all([
      fetchDeputies().catch((err) => {
        console.warn('Falha ao carregar catálogo de deputados:', err)
        return []
      }),
      fetchQuestion('q7', {
        anos: [],
        eixos: [],
        partidos: [],
        ufs: [],
        deputados: [],
        escolaridade: [],
        search: '',
      }, { page: 1, pageSize: 120, sortDir: 'desc' }).catch((err) => {
        console.warn('Falha ao carregar ranking Q7 (modo de compatibilidade/offline):', err)
        return null
      })
    ])
      .then(([catalog, q7Payload]) => {
        const rows = (q7Payload?.table_spec?.rows || []) as unknown as Q7Row[]
        
        let merged: EnrichedDeputy[] = []
        
        if (rows.length > 0) {
          // Faz a junção dos dados da Q7 com a escolaridade e fotos do catálogo
          merged = rows
            .map((row) => {
              const id = String(row.id_deputado)
              const catalogItem = catalog.find((d) => String(d.id) === id)
              
              return {
                id,
                nome: row.nome_parlamentar || catalogItem?.nome || 'Deputado',
                partido: row.sigla_partido || catalogItem?.partido || '-',
                uf: row.sigla_uf || catalogItem?.uf || '-',
                escolaridade: catalogItem?.escolaridade || 'Não informada',
                posicao: row.posicao,
                gasto_total: Number(row.gasto_total || 0),
                total_proposicoes: Number(row.total_proposicoes || 0),
                indice_custo_beneficio: Number(row.indice_custo_beneficio || 0),
                fotoUrl: `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`
              }
            })
            .filter((d) => d.nome && d.posicao)
        }
        
        // Se a junção falhou ou a Q7 está offline (ex: testes de integração), usamos o catálogo com fallback limpo
        if (merged.length === 0 && catalog.length > 0) {
          merged = catalog.map((d) => ({
            id: d.id,
            nome: d.nome,
            partido: d.partido || '-',
            uf: d.uf || '-',
            escolaridade: d.escolaridade || 'Não informada',
            posicao: 0,
            gasto_total: 0,
            total_proposicoes: 0,
            indice_custo_beneficio: 0,
            fotoUrl: `https://www.camara.leg.br/internet/deputado/bandep/${d.id}.jpg`
          }))
        }

        // Embaralha e seleciona 15 deputados para o carrossel
        const shuffled = [...merged].sort(() => 0.5 - Math.random())
        setDeputies(shuffled.slice(0, 15))
        setLoading(false)
      })
      .catch((err) => {
        console.error('Erro ao processar deputados:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (deputies.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1 >= deputies.length ? 0 : prev + 1))
    }, 4500)
    return () => clearInterval(timer)
  }, [deputies])

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? deputies.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1 >= deputies.length ? 0 : prev + 1))
  }

  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return `R$ ${(val / 1000000).toFixed(1)}M`
    }
    if (val >= 1000) {
      return `R$ ${(val / 1000).toFixed(0)} mil`
    }
    return `R$ ${val.toFixed(0)}`
  }

  return (
    <main className="home-page">
      <section className="hero-card home-hero stagger-item">
        <span className="home-hero-eyebrow">Inteligência parlamentar</span>
        <h1>BDR Painéis Parlamentares</h1>
        <p className="home-hero-subtitle">
          Portal integrado para análise e acompanhamento de gastos, perfil acadêmico, votações e alinhamento político na Câmara dos Deputados. Use o menu lateral para navegar entre os módulos analíticos.
        </p>
      </section>

      <section className="deputy-search-hero stagger-item">
        <div className="deputy-search-hero__copy">
          <h2>Pesquisar deputado</h2>
          <p>Digite o nome do parlamentar para ver seu perfil individual, com gastos consolidados e eficiência legislativa.</p>
        </div>
        <DeputySearch placeholder="Pesquisar deputado..." />
      </section>

      <section className="home-panel-section stagger-item" aria-labelledby="home-panels-title">
        <header className="home-panel-heading">
          <div>
            <span>Transparência ativa</span>
            <h2 id="home-panels-title">Destaques da Câmara</h2>
          </div>
          <p>Navegue aleatoriamente pelos parlamentares em exercício ou selecione um para ver detalhes de atuação.</p>
        </header>

        {loading ? (
          <div className="carousel-loading">Carregando dados dos parlamentares...</div>
        ) : deputies.length > 0 ? (
          <div className="carousel-wrapper">
            <button className="carousel-control prev" onClick={handlePrev} aria-label="Deputado anterior">
              ‹
            </button>
            <div className="carousel-container">
              <div
                className="carousel-track"
                style={{
                  transform: `translateX(calc(-${currentIndex} * (var(--slide-width) + 16px)))`,
                }}
              >
                {deputies.map((deputy) => {
                  const level = getCustoBeneficioLevel(deputy.indice_custo_beneficio)
                  return (
                    <article className="deputy-carousel-card" key={deputy.id}>
                      {deputy.posicao > 0 && (
                        <span
                          className="deputy-carousel-rank"
                          style={{
                            color: level.color,
                            backgroundColor: level.bg,
                            borderColor: level.border,
                            borderStyle: 'solid',
                            borderWidth: '1px'
                          }}
                          title={`Índice de Custo-Benefício: ${deputy.indice_custo_beneficio.toFixed(5)} (${level.label})`}
                        >
                          {deputy.indice_custo_beneficio.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </span>
                      )}
                      {deputy.fotoUrl && (
                        <img
                          src={deputy.fotoUrl}
                          alt={deputy.nome}
                          className="deputy-carousel-photo"
                          loading="lazy"
                        />
                      )}
                    <h4>{deputy.nome}</h4>
                    <p className="deputy-carousel-info">
                      {deputy.partido} - {deputy.uf}
                    </p>
                    <span className="deputy-carousel-edu" title={deputy.escolaridade}>
                      {deputy.escolaridade}
                    </span>
                    
                    {deputy.posicao > 0 && (
                      <div className="deputy-carousel-stats">
                        <div className="stat-item">
                          <span className="stat-label">Gastos</span>
                          <span className="stat-value">{formatCurrency(deputy.gasto_total)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Proposições</span>
                          <span className="stat-value">{deputy.total_proposicoes}</span>
                        </div>
                      </div>
                    )}

                    <Link
                      to={`/deputados/${deputy.id}`}
                      className="btn-profile"
                      aria-label={`Ver perfil de ${deputy.nome}`}
                    >
                      Ver perfil completo
                    </Link>
                  </article>
                )})}
              </div>
            </div>
            <button className="carousel-control next" onClick={handleNext} aria-label="Próximo deputado">
              ›
            </button>
          </div>
        ) : (
          <div className="carousel-empty">Nenhum deputado encontrado.</div>
        )}
      </section>
    </main>
  )
}
