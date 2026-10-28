import { expect, expectAccessible, showPanel, test } from './fixtures.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('button', { name: '✓ Verified' })).toBeVisible()
})

const current = (page: import('@playwright/test').Page) => page.locator('.rd-doc .is-current')

test('keeps the current entry in view however you move', async ({ page }) => {
  await showPanel(page, 'History')
  await page.locator('.lg-row[data-index="2"]').click()
  await showPanel(page, 'File')
  await expect(current(page)).toHaveAttribute('data-seq', '2')
  await expect(current(page)).toBeInViewport()

  await page.getByRole('slider', { name: 'Position in the history' }).fill('17')
  await expect(current(page)).toHaveAttribute('data-seq', '17')
  await expect(current(page)).toBeInViewport()

  await page.getByRole('button', { name: 'Previous entry' }).click()
  await expect(current(page)).toHaveAttribute('data-seq', '16')
  await expect(current(page)).toBeInViewport()
})

test('steps with the arrow keys and says where it is', async ({ page }) => {
  await page.locator('body').press('ArrowLeft')
  await expect(page.locator('.reader [role="status"]')).toHaveText(
    'Entry #20, 20 of 21, 09:25: alex cancelled task #18.',
  )
  await page.locator('body').press('Space')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('the history is one tab stop that arrow keys move through', async ({ page }) => {
  await showPanel(page, 'History')
  const rows = page.locator('.lg-list').getByRole('button')
  await expect(rows.and(page.locator('[tabindex="0"]'))).toHaveCount(1)
  await page.locator('.lg-row[aria-current]').focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  const focused = page.locator('.lg-row:focus')
  await expect(focused).toHaveAttribute('data-index', '19')
  await expect(focused).toHaveAttribute('aria-current', 'step')
  await page.keyboard.press('Home')
  await expect(page.locator('.lg-row:focus')).toHaveAttribute('data-index', '1')
})

test('shows the details', async ({ page }) => {
  const details = page.getByRole('complementary', { name: 'Workspace' })
  const button = page.getByRole('button', { name: 'Details' })
  if (await button.isVisible()) {
    await expect(details).toBeHidden()
    await button.click()
    await expect(details).toBeVisible()
    await expectAccessible(page)
    await page.keyboard.press('Escape')
  }
  await expect(details).toBeVisible({ visible: !(await button.isVisible()) })
})

test('renders the file as an agent reads it', async ({ page }) => {
  await page.getByRole('button', { name: 'Markdown' }).click()
  await expect(page.getByRole('button', { name: 'Markdown' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Whitespace is significant here, so compare the raw text rather than the normalised one.
  const text = await page.locator('.rd-doc .src').textContent()
  expect(text).toContain('\n## Log\n')
  expect(text).toContain('\n- #21 09:26 UTC claude@laptop, comment')
})
