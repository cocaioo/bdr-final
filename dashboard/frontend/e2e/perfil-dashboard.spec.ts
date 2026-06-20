import { expect, test } from '@playwright/test'

test('painel de escolaridade usa linguagem pública e filtros com escopo claro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/grupos/perfil')

  const panel = page.locator('.perfil-dashboard')
  await expect(panel.getByRole('heading', { name: 'Escolaridade e Perfil' })).toBeVisible()
  await expect(panel.locator('.perfil-filter-group')).toHaveCount(1)
  await expect(panel.locator('.perfil-section-toolbar')).toHaveCount(2)
  await expect(panel.getByRole('heading', { name: 'Filtro global' })).toBeVisible()
  await expect(panel.getByText('Perfil da legislatura', { exact: true })).toBeVisible()
  await expect(panel.getByText('Atividade parlamentar', { exact: true })).toBeVisible()
  await expect(panel.getByText(/filtro de ano foi removido desta subseção/i)).toBeVisible()

  await expect(panel.getByText('Gasto médio anual por escolaridade')).toBeVisible()
  await expect(panel.getByText('Produção legislativa média por escolaridade')).toBeVisible()
  await expect(panel.getByText('Presença média por escolaridade')).toBeVisible()

  const panelText = await panel.innerText()
  expect(panelText).not.toMatch(/\bQ[46]\b|quest[aã]o|pergunta/i)
  expect(panelText).not.toContain('Deputados no recorte')
  expect(panelText).not.toContain('Níveis de escolaridade')
  expect(panelText).not.toContain('Período da atividade')
  expect(panelText).not.toContain('Maior associação')

  await page.screenshot({ path: '../../scratch/perfil-dashboard.png', fullPage: true })
})
