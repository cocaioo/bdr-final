import { test } from '@playwright/test'

test('inspect Q1 loading', async ({ page }) => {
  page.on('console', (msg) => {
    console.log(`[CONSOLE] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err)
  })

  console.log('Navigating to Q1...')
  await page.goto('/q/q1')
  
  await page.waitForTimeout(2000)
  
  const html = await page.content()
  console.log('--- PAGE HTML ---')
  console.log(html)
})
