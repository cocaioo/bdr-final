import { expect, test } from '@playwright/test'

test('home route loads shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('BDR Painel Q1-Q13')).toBeVisible()
})

test('critical question routes are reachable', async ({ page }) => {
  await page.goto('/q/q1')
  await expect(page.getByText('Q1 -')).toBeVisible()

  await page.goto('/q/q2')
  await expect(page.getByRole('heading', { name: 'Nuvens de palavras por ano' })).toBeVisible()
  await expect(page.getByRole('img', { name: /2023/ })).toBeVisible()

  await page.goto('/q/q7')
  await expect(page.getByText('Q7 -')).toBeVisible()

  await page.goto('/q/q11')
  await expect(page.getByText('Q11 -')).toBeVisible()

  await page.goto('/q/q13')
  await expect(page.getByText('Q13 -')).toBeVisible()
})

