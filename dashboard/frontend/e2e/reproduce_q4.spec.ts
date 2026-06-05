import { expect, test } from '@playwright/test'

test('Q4 filter and remove filter synchronization', async ({ page }) => {
  const requests: { url: string; method: string }[] = []
  page.on('request', (req) => {
    if (req.url().includes('/api/questions/')) {
      requests.push({ url: req.url(), method: req.method() })
    }
  })

  console.log('--- Navigating to Q4 ---')
  await page.goto('/q/q4')
  
  const mainHeader = page.locator('.table-section:has-text("Escolaridade") .table-header p')
  await expect(mainHeader).toBeVisible()
  const initialText = await mainHeader.innerText()
  console.log('Initial table state:', initialText)

  const depSelect = page.locator('label.filter-item:has-text("Deputado") select')
  await expect(depSelect).toBeVisible()

  console.log('--- Applying filter Deputado=Adriana Ventura ---')
  await depSelect.selectOption('Adriana Ventura')

  await page.waitForTimeout(2000)
  const afterFilterText = await mainHeader.innerText()
  console.log('After applying filter:', afterFilterText)

  console.log('--- Deselecting/Removing filter ---')
  await depSelect.selectOption([])

  await page.waitForTimeout(2000)
  const afterRemoveText = await mainHeader.innerText()
  console.log('After removing filter:', afterRemoveText)

  console.log('--- API Requests made: ---')
  requests.forEach((r, i) => {
    console.log(`Request ${i + 1}: ${r.method} ${r.url}`)
  })
})
