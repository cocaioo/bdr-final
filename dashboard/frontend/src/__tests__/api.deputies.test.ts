import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchDeputies } from '../api'

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
})
