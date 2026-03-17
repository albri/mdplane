import { test, expect, BACKEND_URL } from './fixtures'

const MOCK_WRITE_KEY = 'w_mocked_write_key_1234567890'

async function signInFreshUserWithNoWorkspaces(page: import('@playwright/test').Page) {
  await page.context().clearCookies()

  const email = `e2e-empty-${Date.now()}@example.com`
  const password = 'test-empty-workspaces-password-12345'

  const signUpResponse = await page.request.post(`${BACKEND_URL}/api/auth/sign-up/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      email,
      password,
      name: 'E2E Empty State User',
    },
  })

  expect(signUpResponse.ok()).toBeTruthy()
}

test.describe('Control Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await signInFreshUserWithNoWorkspaces(page)
  })

  test('shows claim-first splash without control shell when user has no claimed workspaces', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/claim a workspace to continue/i)).toBeVisible()
    await expect(page.getByText(/control becomes available after you claim a workspace/i)).toBeVisible()

    await expect(page.locator('#app-sidebar')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /overview/i })).toHaveCount(0)
  })

  test('accepts write key input and routes to claim flow', async ({ page }) => {
    await page.goto('/control')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('Paste write key or /claim URL').fill(`https://app.mdplane.dev/claim/${MOCK_WRITE_KEY}`)
    await page.getByRole('button', { name: /continue to claim/i }).click()

    await expect(page).toHaveURL(new RegExp(`/claim/${MOCK_WRITE_KEY}`))
  })
})
