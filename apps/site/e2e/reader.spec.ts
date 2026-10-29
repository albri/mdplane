import { expect, expectAccessible, showPanel, test } from './fixtures.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('button', { name: 'Checked. Show the chain' })).toBeVisible()
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

const row = (page: import('@playwright/test').Page, task: number) =>
  page.locator(`.task-row[data-task="${task}"]`)

test('each task is one row that opens on its thread', async ({ page }) => {
  // At the head, the current entry is a comment on #5, so #5 is the only task open.
  await expect(page.locator('.task-row[aria-expanded="true"]')).toHaveCount(1)
  await expect(row(page, 5)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.task:has(.task-row[data-task="2"]) .thread')).toHaveCount(0)

  await row(page, 2).click()
  await expect(row(page, 2)).toHaveAttribute('aria-expanded', 'true')
  const thread = page.locator(`#${await row(page, 2).getAttribute('aria-controls')}`)
  await expect(thread).toContainText('CI is green on Node 22.')

  // The keyboard closes it again.
  await row(page, 2).focus()
  await page.keyboard.press('Enter')
  await expect(row(page, 2)).toHaveAttribute('aria-expanded', 'false')
  await expect(thread).toHaveCount(0)
  await expectAccessible(page)
})

test('the task the current entry belongs to opens, and others close behind it', async ({
  page,
}) => {
  await row(page, 3).click()
  // #13 is the response that finished #3, and #16 a claim on #5.
  await page.getByRole('slider', { name: 'Position in the history' }).fill('16')
  await expect(page.locator('.task.is-here .task-row')).toHaveAttribute('data-task', '5')
  await expect(row(page, 5)).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('slider', { name: 'Position in the history' }).fill('14')
  await expect(page.locator('.task.is-here .task-row')).toHaveAttribute('data-task', '4')
  await expect(row(page, 5)).toHaveAttribute('aria-expanded', 'false')
  // Opened by hand, so it stays open.
  await expect(row(page, 3)).toHaveAttribute('aria-expanded', 'true')
  await expect(current(page)).toHaveAttribute('data-seq', '14')
  await expect(current(page)).toBeInViewport()
})

test('the check leads to the chain', async ({ page }) => {
  await page.getByRole('button', { name: 'Checked. Show the chain' }).click()
  const chain = page.getByRole('region', { name: 'Chain' })
  await expect(chain).toBeFocused()
  await expect(chain).toContainText('All 21 entries match their hashes.')
  await chain.getByRole('button', { name: 'Check again' }).click()
  await expect(page.locator('.reader [role="status"]')).toHaveText(
    'History checked: all 21 entries match their hashes.',
  )
})

test('away from the head, the status is the way back to it', async ({ page }) => {
  const footer = page.locator('.rd-time')
  const slider = page.getByRole('slider', { name: 'Position in the history' })
  await expect(footer.locator('.rd-mode')).toHaveText('Replay')
  await expect(footer.getByRole('button', { name: 'Latest' })).toHaveCount(0)

  await slider.fill('12')
  await expect(footer.locator('.rd-mode')).toHaveCount(0)
  await footer.getByRole('button', { name: 'Latest' }).click()
  await expect(slider).toHaveValue('21')
  await expect(footer.locator('.rd-mode')).toHaveText('Replay')
  await expect(page.locator('.reader [role="status"]')).toContainText('Entry #21, 21 of 21')
})

// The header keeps to one row, the view switch joins the panel tabs, and the footer's status
// stays on screen, down to a small phone.
test.describe('on a phone', () => {
  // Skipped before the hooks run, so desktops don't load the demo for nothing.
  test.skip(({ isMobile }) => !isMobile, 'phones only')
  for (const path of ['/demo', '/']) {
    test(`the reader fits a phone without scrolling sideways on ${path}`, async ({ page }) => {
      for (const width of [412, 360]) {
        // oxlint-disable-next-line no-await-in-loop -- one width at a time
        await page.setViewportSize({ width, height: 760 })
        // oxlint-disable-next-line no-await-in-loop -- one width at a time
        await page.goto(path)
        const reader = page.locator('.reader').first()
        const check = reader.locator('.rd-time').getByRole('button', { name: /^Checked/ })
        // oxlint-disable-next-line no-await-in-loop -- one width at a time
        await expect(check).toBeVisible()
        // oxlint-disable-next-line no-await-in-loop -- one width at a time
        const [tabs, view, status] = await Promise.all([
          reader.getByRole('group', { name: 'Show' }).boundingBox(),
          reader.getByRole('group', { name: 'View' }).boundingBox(),
          check.boundingBox(),
        ])
        expect(Math.abs((tabs?.y ?? 0) - (view?.y ?? 100))).toBeLessThan(2)
        expect((status?.x ?? 0) + (status?.width ?? 0)).toBeLessThanOrEqual(width)
        if (path === '/demo') {
          // oxlint-disable-next-line no-await-in-loop -- one width at a time
          expect((await page.locator('.app-bar').boundingBox())?.height).toBeLessThan(60)
        }
        // oxlint-disable-next-line no-await-in-loop -- one width at a time
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(scroll).toBe(width)
      }
    })
  }
})
