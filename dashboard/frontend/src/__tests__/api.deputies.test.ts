import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchDeputies, fetchDeputyExpenseBreakdown, fetchDeputyIdentityFromGastos } from '../api'

describe('fetchDeputies', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retorna partido e uf indefinidos quando o CSV atual nao traz essas colunas', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        'id_deputado;uri_deputado;nome;nome_civil;cpf;id_legislatura_inicial;id_legislatura_final;escolaridade\n' +
        '220593;https://dadosabertos.camara.leg.br/api/v2/deputados/220593;Abilio Brunini;ABILIO JACQUES BRUNINI MOUMER;99770962104;57;57;Superior',
    } as Response)

    const deputies = await fetchDeputies()

    expect(deputies).toHaveLength(1)
    expect(deputies[0]).toMatchObject({
      id: '220593',
      nome: 'Abilio Brunini',
      partido: undefined,
      uf: undefined,
      escolaridade: 'Superior',
    })
  })

  it('monta o drilldown do deputado a partir de Q12 e Q13 com percentual no total do proprio deputado', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('/api/questions/q12?')) {
        expect(url).toContain('anos=2024')
        expect(url).toContain('partidos=PT')
        expect(url).toContain('ufs=CE')
        expect(url).toContain('deputados=123')
        return {
          ok: true,
          json: async () => ({
            table_spec: { rows: [] },
            complement_tables: [
              {
                rows: [
                  { ano_dados: 'GLOBAL', id_deputado: 123, fornecedor: 'Fornecedor A', qtd_lancamentos: 3, total_pago: 60_000 },
                  { ano_dados: 'GLOBAL', id_deputado: 123, fornecedor: 'Fornecedor B', qtd_lancamentos: 2, total_pago: 40_000 },
                ],
              },
            ],
          }),
        } as Response
      }

      if (url.includes('/api/questions/q13?')) {
        return {
          ok: true,
          json: async () => ({
            table_spec: { rows: [] },
            complement_tables: [
              {
                rows: [
                  { ano_dados: 'GLOBAL', id_deputado: 123, descricao_despesa: 'Categoria A', qtd_lancamentos: 7, gasto_total: 70_000 },
                  { ano_dados: 'GLOBAL', id_deputado: 123, descricao_despesa: 'Categoria B', qtd_lancamentos: 3, gasto_total: 30_000 },
                ],
              },
            ],
          }),
        } as Response
      }

      throw new Error(`URL inesperada: ${url}`)
    })

    const breakdown = await fetchDeputyExpenseBreakdown('123', { ano: '2024', partido: 'PT', uf: 'CE' })

    expect(breakdown.source).toBe('q12_q13')
    expect(breakdown.total).toBe(100_000)
    expect(breakdown.suppliers[0]).toMatchObject({
      fornecedor: 'Fornecedor A',
      valor_total: 60_000,
      pct_total: 60,
    })
    expect(breakdown.categories[0]).toMatchObject({
      categoria: 'Categoria A',
      valor_total: 70_000,
      pct_total: 70,
    })
  })

  it('usa Q2 como fallback de identidade quando gastos nao retorna o deputado', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('/api/gastos/deputados?')) {
        return {
          ok: true,
          json: async () => ({
            summary: {},
            items: [],
            metadata: {},
          }),
        } as Response
      }

      if (url.includes('/api/questions/q2?')) {
        expect(url).toContain('deputados=235869')
        return {
          ok: true,
          json: async () => ({
            table_spec: {
              rows: [
                {
                  id_deputado: 235869,
                  sigla_partido: 'REPUBLICANOS',
                  sigla_uf: 'AM',
                },
              ],
            },
          }),
        } as Response
      }

      throw new Error(`URL inesperada: ${url}`)
    })

    const identity = await fetchDeputyIdentityFromGastos('235869')

    expect(identity).toEqual({ partido: 'REPUBLICANOS', uf: 'AM' })
  })
})
