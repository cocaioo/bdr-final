import { expect, test } from '@playwright/test'

test('painel de gastos permanece legivel e nao carrega anomalias', async ({ page }) => {
  const anomalyRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/gastos/anomalias')) anomalyRequests.push(request.url())
  })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/grupos/gastos')
  await expect(page.getByRole('heading', { name: 'Painel de Gastos Parlamentares' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Gastos Atipicos/i })).toHaveCount(0)
  await expect(page.getByText('Evolucao temporal dos gastos')).toBeVisible()
  await expect(page.getByText(/R\$/).first()).toBeVisible()
  await page.screenshot({ path: '../../scratch/gastos-resumo.png', fullPage: true })

  await page.locator('.gastos-tabs button').filter({ hasText: 'Categorias' }).click()
  await expect(page.getByText('Top categorias por valor')).toBeVisible()
  await expect(page.locator('.gastos-category-rank-card').first()).toBeVisible()
  await page.screenshot({ path: '../../scratch/gastos-categorias.png', fullPage: true })

  await page.locator('.gastos-tabs button').filter({ hasText: 'Deputados' }).click()
  const firstDeputy = page.locator('.gastos-deputy-rank-card').first()
  await expect(firstDeputy).toBeVisible()
  await firstDeputy.click()

  const profile = page.locator('.gastos-deputy-profile')
  await expect(profile).toBeVisible()
  await expect(profile.getByText(/Valor total:/)).toBeVisible()
  await expect(profile.getByText(/Gastos atipicos/i)).toHaveCount(0)

  const colors = await profile.evaluate((element) => {
    const panel = getComputedStyle(element)
    const heading = getComputedStyle(element.querySelector('h3')!)
    const metric = getComputedStyle(element.querySelector('.gastos-drilldown-grid span')!)
    return {
      panelBackground: panel.backgroundColor,
      headingColor: heading.color,
      metricBackground: metric.backgroundColor,
      metricColor: metric.color,
    }
  })
  expect(colors.headingColor).not.toBe(colors.panelBackground)
  expect(colors.metricColor).not.toBe(colors.metricBackground)
  expect(anomalyRequests).toEqual([])
  await page.screenshot({ path: '../../scratch/gastos-deputado-perfil.png', fullPage: true })

  await page.locator('.gastos-tabs button').filter({ hasText: 'Fornecedores' }).click()
  const firstSupplier = page.locator('.gastos-deputy-rank-card').first()
  await expect(firstSupplier).toBeVisible()
  await firstSupplier.click()

  const supplierProfile = page.locator('.gastos-supplier-profile')
  await expect(supplierProfile).toBeVisible()
  await expect(supplierProfile.getByText(/Fornecedor:/)).toBeVisible()
  await page.screenshot({ path: '../../scratch/gastos-fornecedores.png', fullPage: true })
})
