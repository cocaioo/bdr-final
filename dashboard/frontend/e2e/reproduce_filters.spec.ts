import { expect, test } from '@playwright/test'

test('Q1 filter and remove filter synchronization', async ({ page }) => {
  // Listen to API requests to see what payloads are sent and received
  const requests: { url: string; method: string }[] = []
  page.on('request', (req) => {
    if (req.url().includes('/api/questions/')) {
      requests.push({ url: req.url(), method: req.method() })
    }
  })

  const responses: { url: string; status: number; body: string }[] = []
  page.on('response', async (res) => {
    if (res.url().includes('/api/questions/')) {
      try {
        const text = await res.text()
        responses.push({ url: res.url(), status: res.status(), body: text })
      } catch (e) {
        // ignore body read errors for pending/canceled requests
      }
    }
  })

  console.log('--- Navigating to Q1 ---')
  await page.goto('/q/q1')
  
  // Wait for the table header to show the initial count
  const initialHeader = page.locator('.table-header p')
  await expect(initialHeader).toBeVisible()
  const initialText = await initialHeader.innerText()
  console.log('Initial table state:', initialText)

  // Find UF filter (multiple select)
  const ufSelect = page.locator('label.filter-item:has-text("UF") select')
  await expect(ufSelect).toBeVisible()

  console.log('--- Applying filter UF=AC ---')
  // Select AC
  await ufSelect.selectOption('AC')

  // Wait for request/response to complete
  await page.waitForTimeout(2000)
  const afterFilterText = await initialHeader.innerText()
  console.log('After applying filter:', afterFilterText)

  console.log('--- Deselecting/Removing filter UF=AC ---')
  // Deselect option by selecting empty or clearing options
  // In playwright, we can select [] to clear selections in multi-select
  await ufSelect.selectOption([])

  // Wait for request/response to complete
  await page.waitForTimeout(2000)
  const afterRemoveText = await initialHeader.innerText()
  console.log('After removing filter:', afterRemoveText)

  console.log('--- API Requests made during flow: ---')
  requests.forEach((r, i) => {
    console.log(`Request ${i + 1}: ${r.method} ${r.url}`)
  })
  
  console.log('--- API Responses body summaries: ---')
  responses.forEach((r, i) => {
    let bodySnippet = r.body
    if (bodySnippet.length > 300) {
      bodySnippet = bodySnippet.substring(0, 300) + '...'
    }
    console.log(`Response ${i + 1}: URL: ${r.url} | Status: ${r.status} | Body: ${bodySnippet}`)
  })
})
