import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchDeputies, fetchDeputyGastosSummary } from '../../api'
import { DeputyProfilePage } from '../DeputyProfilePage'

vi.mock('../../api', () => ({
  fetchDeputies: vi.fn(),
  fetchDeputyGastosSummary: vi.fn(),
}))

const fetchDeputiesMock = vi.mocked(fetchDeputies)
const fetchGastosMock = vi.mocked(fetchDeputyGastosSummary)

const deputies = [
  {
    id: '220593',
    uriDeputado: 'https://dadosabertos.camara.leg.br/api/v2/deputados/220593',
    nome: 'Abilio Brunini',
    nomeCivil: 'ABILIO JACQUES BRUNINI MOUMER',
    cpf: '99770962104',
    partido: 'PL',
    uf: 'MT',
    escolaridade: 'Superior',
    legislaturaInicial: '57',
    legislaturaFinal: '57',
  },
  { id: '204379', nome: 'Acacio Favacho', escolaridade: 'Superior', legislaturaInicial: '56', legislaturaFinal: '57' },
]

const gastos = {
  summary: { valor_total: 871819.53, qtd_despesas: 1101, ticket_medio: 791.84, qtd_deputados: 1, qtd_fornecedores: 208 },
  categories: [{ categoria: 'LOCAÇÃO DE VEÍCULOS', valor_total: 218915.86, qtd_despesas: 52 }],
  suppliers: [{ fornecedor: 'PANTANAL VEÍCULOS LTDA', valor_total: 146600, qtd_despesas: 34, qtd_deputados: 1, ticket_medio: 4311.76 }],
  evolution: [{ ano: '2023', valor_total: 300000, qtd_despesas: 300 }],
  anomalies: [],
  hasData: true,
  partialErrors: [],
}

function renderProfile(id = '220593') {
  return render(
    <MemoryRouter initialEntries={[`/deputados/${id}`]}>
      <Routes><Route path="/deputados/:id" element={<DeputyProfilePage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('DeputyProfilePage', () => {
  beforeEach(() => {
    fetchDeputiesMock.mockReset()
    fetchGastosMock.mockReset()
    fetchDeputiesMock.mockResolvedValue(deputies)
    fetchGastosMock.mockResolvedValue(gastos)
  })

  it('carrega o deputado existente, seus dados cadastrais e gastos reais', async () => {
    renderProfile()

    expect(await screen.findByRole('heading', { name: 'Abilio Brunini' })).toBeInTheDocument()
    expect(screen.getAllByText('ABILIO JACQUES BRUNINI MOUMER').length).toBeGreaterThan(0)
    expect(screen.getByText('57ª Legislatura')).toBeInTheDocument()
    expect(screen.getByText('99770962104')).toBeInTheDocument()
    expect(await screen.findByText('R$ 871.819,53')).toBeInTheDocument()
    expect(screen.getByText('LOCAÇÃO DE VEÍCULOS')).toBeInTheDocument()
    expect(screen.getByText('PANTANAL VEÍCULOS LTDA')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Produção legislativa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Votações' })).toBeInTheDocument()
    expect(fetchGastosMock).toHaveBeenCalledWith('220593')
  })

  it('mantém os links dos dashboards como visões gerais, sem filtro por deputado', async () => {
    renderProfile()
    await screen.findByRole('heading', { name: 'Abilio Brunini' })

    expect(screen.getByRole('link', { name: 'Abrir Painel de Gastos' })).toHaveAttribute('href', '/grupos/gastos')
    expect(screen.getByRole('link', { name: 'Abrir Escolaridade e Perfil' })).toHaveAttribute('href', '/grupos/perfil')
    expect(screen.getByText(/estes links não aplicam filtro por deputado/i)).toBeInTheDocument()
  })

  it('mostra estado vazio de gastos sem quebrar o cadastro', async () => {
    fetchGastosMock.mockResolvedValue({ summary: null, categories: [], suppliers: [], evolution: [], anomalies: [], hasData: false, partialErrors: [] })
    renderProfile('204379')

    expect(await screen.findByRole('heading', { name: 'Acacio Favacho' })).toBeInTheDocument()
    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0)
    expect(await screen.findByText(/Nenhum dado de gasto disponível/i)).toBeInTheDocument()
  })

  it('preserva o perfil quando a consulta de gastos falha', async () => {
    fetchGastosMock.mockRejectedValue(new Error('indisponível'))
    renderProfile()

    expect(await screen.findByRole('heading', { name: 'Abilio Brunini' })).toBeInTheDocument()
    expect(await screen.findByText(/Não foi possível carregar os gastos agora/i)).toBeInTheDocument()
  })

  it('lida com deputado inexistente e mantém a busca disponível', async () => {
    renderProfile('999999')

    expect(await screen.findByText(/Não localizamos um deputado com este ID/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para a home' })).toHaveAttribute('href', '/')
    expect(screen.getByPlaceholderText('Buscar outro deputado...')).toBeInTheDocument()
    expect(fetchGastosMock).not.toHaveBeenCalled()
  })
})
