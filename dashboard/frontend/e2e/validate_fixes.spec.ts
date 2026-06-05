import { expect, test } from '@playwright/test'

test.describe('Fases 1 & 2 Filter Fixes Validation', () => {
  const requests: { url: string; method: string }[] = []

  test.beforeEach(({ page }) => {
    requests.length = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        requests.push({ url: req.url(), method: req.method() })
      }
    })
    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`)
    })
    page.on('pageerror', (err) => {
      console.error('[BROWSER ERROR]', err)
    })
  })

  test('Q1 -> aplicar UF -> remover UF', async ({ page }) => {
    console.log('\n--- TEST: Q1 -> aplicar UF -> remover UF ---')
    await page.goto('/q/q1')
    
    // Increased timeout to 20s for cold start cache warming on first request
    const header = page.locator('.table-section .table-header p')
    await expect(header).toBeVisible({ timeout: 20000 })
    console.log('Initial Q1 State:', await header.innerText())
    await expect(header).toContainText('637 registros')

    // Apply UF=AC
    const ufSelect = page.locator('select#filter-ufs')
    await ufSelect.selectOption('AC')
    await page.waitForTimeout(1000)
    console.log('After applying UF=AC:', await header.innerText())
    await expect(header).toContainText('10 registros')

    // Check if the interactive tag badge is rendered
    const tagBadge = page.locator('.filter-tag:has-text("AC")')
    await expect(tagBadge).toBeVisible()
    console.log('Interactive tag badge "AC" is visible.')

    // Click the "x" button on the tag badge to remove UF=AC
    const tagRemoveBtn = tagBadge.locator('.remove-tag-btn')
    await tagRemoveBtn.click()
    await page.waitForTimeout(1000)
    console.log('After removing UF=AC via tag badge:', await header.innerText())
    await expect(header).toContainText('637 registros')

    console.log('Requests made in Q1:', requests.map(r => r.url))
  })

  test('Q1 -> Q4 -> Q1 (Filter reset on route change)', async ({ page }) => {
    console.log('\n--- TEST: Q1 -> Q4 -> Q1 navigation state reset ---')
    await page.goto('/q/q1')
    
    const headerQ1 = page.locator('.table-section .table-header p')
    await expect(headerQ1).toBeVisible({ timeout: 20000 })
    
    // Apply UF=AC
    const ufSelect = page.locator('select#filter-ufs')
    await ufSelect.selectOption('AC')
    await page.waitForTimeout(1000)
    await expect(headerQ1).toContainText('10 registros')

    // Navigate to Q4 via link or direct
    console.log('Navigating to Q4...')
    await page.goto('/q/q4')
    
    const headerQ4 = page.locator('.table-section:has-text("Escolaridade") .table-header p')
    await expect(headerQ4).toBeVisible({ timeout: 20000 })
    console.log('Q4 Table Header on arrival:', await headerQ4.innerText())

    // Check that UF filter is NOT present in request to Q4
    const q4Requests = requests.filter(r => r.url.includes('/api/questions/q4'))
    console.log('Q4 Requests:', q4Requests.map(r => r.url))
    for (const req of q4Requests) {
      const url = new URL(req.url)
      expect(url.searchParams.has('ufs')).toBe(false)
    }

    // Return to Q1
    console.log('Returning to Q1...')
    await page.goto('/q/q1')
    const headerQ1Return = page.locator('.table-section .table-header p')
    await expect(headerQ1Return).toBeVisible({ timeout: 20000 })
    console.log('Q1 Table Header on return:', await headerQ1Return.innerText())
    await expect(headerQ1Return).toContainText('637 registros')

    const ufSelectAfter = page.locator('select#filter-ufs')
    await expect(ufSelectAfter).toHaveValues([])
  })

  test('Q4 -> selecionar deputado -> limpar filtros', async ({ page }) => {
    console.log('\n--- TEST: Q4 -> selecionar deputado -> limpar filtros ---')
    await page.goto('/q/q4')
    
    const compTableHeader = page.locator('.complement-section h2')
    await expect(compTableHeader).toBeVisible({ timeout: 20000 })
    console.log('Complement table title:', await compTableHeader.innerText())

    const depSelect = page.locator('select#filter-deputados')
    await expect(depSelect).toBeVisible()

    // Select Adriana Ventura
    await depSelect.selectOption('Adriana Ventura')
    await page.waitForTimeout(1000)
    
    // Verify tag is visible
    const tagBadge = page.locator('.filter-tag:has-text("Adriana Ventura")')
    await expect(tagBadge).toBeVisible()
    console.log('Deputy tag badge is visible.')

    // Click "Limpar" button on the filter header
    const clearBtn = page.locator('.filter-item:has-text("Deputado") .clear-btn')
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await page.waitForTimeout(1000)

    // Verify tag is gone
    await expect(tagBadge).not.toBeVisible()
    console.log('Tag badge removed after clicking Limpar.')
  })

  test('Q2 -> aplicar filtros -> limpar todos os filtros', async ({ page }) => {
    console.log('\n--- TEST: Q2 -> aplicar filtros -> limpar todos os filtros ---')
    await page.goto('/q/q2')

    const header = page.locator('.table-section .table-header p')
    await expect(header).toBeVisible({ timeout: 20000 })

    // Select a Tema
    const eixoSelect = page.locator('select#filter-eixos')
    await eixoSelect.selectOption('Saúde')
    await page.waitForTimeout(1000)

    // Select a Deputado
    const depSelect = page.locator('select#filter-deputados')
    await depSelect.selectOption('Ana Pimentel')
    await page.waitForTimeout(1000)

    // Check that "Limpar todos os filtros" button is visible
    const clearAllBtn = page.locator('.clear-all-btn')
    await expect(clearAllBtn).toBeVisible()
    console.log('Global "Limpar todos os filtros" button is visible.')

    // Click it
    await clearAllBtn.click()
    await page.waitForTimeout(1000)

    // Verify all tags are gone
    await expect(clearAllBtn).not.toBeVisible()
    await expect(eixoSelect).toHaveValues([])
    await expect(depSelect).toHaveValues([])
    console.log('All selections cleared successfully using the global reset button.')
  })
})
