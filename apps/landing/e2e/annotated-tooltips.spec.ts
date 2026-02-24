import { expect, test } from '@playwright/test'

const ANNOTATION_CASES = [
  {
    token: '"workspaceName"',
    tooltip: 'Workspace name is required at bootstrap',
  },
  {
    token: 'file_abc123',
    tooltip: 'File gets its own URLs - share just this file without exposing the folder',
  },
  {
    token: 'append_xyz789',
    tooltip: 'Every append gets an ID - track who added what',
  },
]

test.describe('Landing annotated code tooltips', () => {
  test('shows tooltip content when clicking highlighted tokens', async ({ page }) => {
    await page.goto('/')

    for (const annotationCase of ANNOTATION_CASES) {
      const trigger = page.getByTestId('annotation-trigger').filter({ hasText: annotationCase.token }).first()
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()

      await expect(
        page.getByTestId('annotation-tooltip').filter({ hasText: annotationCase.tooltip }).first()
      ).toBeVisible()
    }
  })

  test('shows tooltip content when keyboard activating highlighted tokens', async ({ page }) => {
    await page.goto('/')

    for (const annotationCase of ANNOTATION_CASES) {
      const trigger = page.getByTestId('annotation-trigger').filter({ hasText: annotationCase.token }).first()
      await trigger.scrollIntoViewIfNeeded()
      await trigger.focus()
      await page.keyboard.press('Enter')

      await expect(
        page.getByTestId('annotation-tooltip').filter({ hasText: annotationCase.tooltip }).first()
      ).toBeVisible()
    }
  })
})
