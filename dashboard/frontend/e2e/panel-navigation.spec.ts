import { expect, test } from '@playwright/test'

test('home e header priorizam os quatro painéis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: 'Painéis de análise parlamentar' })).toBeVisible()
  await expect(main.locator('.home-panel-card')).toHaveCount(4)
  await expect(main.getByRole('heading', { name: 'Gastos parlamentares' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Escolaridade e perfil dos deputados' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Produção legislativa' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Partidos e votações' })).toBeVisible()

  const visibleText = `${await page.locator('.app-header').innerText()} ${await main.innerText()}`
  expect(visibleText).not.toMatch(/\bQ(?:[1-9]|1[0-3])\b|quest[aã]o|pergunta/i)
  await page.screenshot({ path: '../../scratch/navegacao-home.png', fullPage: true })

  await page.getByRole('link', { name: 'Produção legislativa', exact: true }).click()
  await expect(page).toHaveURL(/\/grupos\/producao-legislativa$/)
  await expect(page.getByRole('heading', { name: 'Produção legislativa' })).toBeVisible()

  await page.getByRole('link', { name: 'Partidos e votações', exact: true }).click()
  await expect(page).toHaveURL(/\/grupos\/partidos-votacoes$/)
  await expect(page.getByRole('heading', { name: 'Partidos e votações' })).toBeVisible()

  await page.screenshot({ path: '../../scratch/navegacao-paineis.png', fullPage: true })
})

test('rota técnica antiga permanece acessível diretamente', async ({ page }) => {
  await page.goto('/q/q1')
  await expect(page.getByText('Q1 -')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Q1')).toHaveCount(0)
})
