import { test, expect, BACKEND_URL, FRONTEND_URL, unauthRequest } from './fixtures'

interface BootstrapClaimTestResponse {
  ok: boolean
  data?: {
    workspaceId: string
    keys: {
      read: string
      write: string
    }
  }
}

async function createUnclaimedWorkspace(page: import('@playwright/test').Page) {
  const response = await page.request.post(`${BACKEND_URL}/bootstrap`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.22.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    data: { workspaceName: `e2e-claim-flow-${Date.now()}` },
  })

  expect(response.status()).toBe(201)
  const body = (await response.json()) as BootstrapClaimTestResponse
  expect(body.ok).toBe(true)
  expect(body.data?.workspaceId).toBeTruthy()
  expect(body.data?.keys.read).toBeTruthy()
  expect(body.data?.keys.write).toBeTruthy()

  return {
    workspaceId: body.data!.workspaceId,
    readKey: body.data!.keys.read,
    writeKey: body.data!.keys.write,
  }
}

function getCliContractClaimUrl(writeKey: string): string {
  return `${FRONTEND_URL}/claim/${writeKey}`
}

test.describe('Claim Flow - /claim/[writeKey]', () => {
  test('cli-contract claim URL resolves to app auth route and redirects into OAuth', async ({ page }) => {
    await page.context().clearCookies()
    const { writeKey } = await createUnclaimedWorkspace(page)
    const cliClaimUrl = getCliContractClaimUrl(writeKey)

    expect(cliClaimUrl).toContain(`/claim/${writeKey}`)

    await page.goto(cliClaimUrl)
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    expect(decodeURIComponent(page.url())).toContain(`/claim/${writeKey}`)
  })

  test('authenticated session can continue from cli-contract claim URL to claimed workspace control', async ({ page }) => {
    const { workspaceId, writeKey } = await createUnclaimedWorkspace(page)
    const cliClaimUrl = getCliContractClaimUrl(writeKey)

    await page.goto(cliClaimUrl)
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: /^go to control$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/control/${workspaceId}$`))
  })

  test('runtime claim action sends unauthenticated users to login with claim redirect target', async ({ page }) => {
    await page.context().clearCookies()
    const { readKey, writeKey } = await createUnclaimedWorkspace(page)

    await page.goto(`/r/${readKey}`)
    await page.getByTestId('claim-workspace-button').click()

    const input = page.getByPlaceholder('Paste write key or /claim URL')
    await expect(input).toBeVisible()
    await input.fill(writeKey)
    await input.press('Enter')

    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(decodeURIComponent(page.url())).toContain(`/claim/${writeKey}`)
  })

  test('authenticated runtime claim flow lands in scoped control on first load', async ({ page }) => {
    const { workspaceId, readKey, writeKey } = await createUnclaimedWorkspace(page)

    await page.goto(`/r/${readKey}`)
    await page.getByTestId('claim-workspace-button').click()

    const input = page.getByPlaceholder('Paste write key or /claim URL')
    await expect(input).toBeVisible()
    await input.fill(writeKey)
    await input.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/claim/${writeKey}$`), { timeout: 10000 })
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: /^go to control$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/control/${workspaceId}$`), { timeout: 10000 })
    await expect(page.getByTestId('error-page')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /^welcome$/i })).toBeVisible({ timeout: 10000 })
  })

  test('unauthenticated claim redirect preserves next and session redirect target', async ({ page, writeKey }) => {
    await page.context().clearCookies()
    await page.goto(`/claim/${writeKey}`)
    await page.waitForURL(/\/login/, { timeout: 10000 })

    const url = page.url()
    expect(url).toContain('/login?next=')
    expect(decodeURIComponent(url)).toContain(`/claim/${writeKey}`)

    const redirectAfterLogin = await page.evaluate(() => sessionStorage.getItem('redirectAfterLogin'))
    expect(redirectAfterLogin).toBe(`/claim/${writeKey}`)
  })

  test('login continues to provider OAuth flow after claim redirect', async ({ page, writeKey }) => {
    await page.context().clearCookies()
    await page.goto(`/claim/${writeKey}`)
    await page.waitForURL(/\/login/, { timeout: 10000 })

    await page.getByRole('button', { name: /continue with github/i }).click()

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain('github.com/login')
    const oauthUrl = page.url()
    expect(oauthUrl).toContain('return_to=')
    const callbackUrl = `${BACKEND_URL}/api/auth/callback/github`
    const doubleEncodedCallback = encodeURIComponent(encodeURIComponent(callbackUrl))
    expect(oauthUrl).toContain(`redirect_uri%3D${doubleEncodedCallback}`)
  })

  test('authenticated user can claim an unclaimed workspace and continue to scoped control', async ({ page }) => {
    const { workspaceId, writeKey } = await createUnclaimedWorkspace(page)

    await page.goto(`/claim/${writeKey}`)
    await expect(page.getByText('Workspace Claimed!', { exact: true })).toBeVisible({ timeout: 10000 })

    await expect(page.getByText(/api key/i)).toHaveCount(0)
    await expect(page.getByText(/Open Control to manage keys, webhooks, and workspace settings\./i)).toHaveCount(0)

    await page.getByRole('link', { name: /^go to control$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/control/${workspaceId}$`))
  })

  test('invalid write key shows claim failure state for authenticated user', async ({ page }) => {
    await page.goto('/claim/invalid-key-12345')
    await expect(page.getByText(/invalid key|claim failed|not found/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/please check the url and try again, or create a new workspace\./i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^try again$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^go home$/i })).toHaveCount(0)
  })
})

test.describe('Claim API Endpoint', () => {
  test('should return 401 for claim without session', async ({ writeKey }) => {
    const ctx = await unauthRequest.newContext({
      baseURL: BACKEND_URL,
      storageState: { cookies: [], origins: [] },
    })
    const response = await ctx.post(`/w/${writeKey}/claim`)

    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data.ok).toBe(false)

    await ctx.dispose()
  })

  test('should return 404 for claim with invalid writeKey', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/w/invalid-key-does-not-exist/claim`)

    expect([401, 404]).toContain(response.status())

    const data = await response.json()
    expect(data.ok).toBe(false)
    if (response.status() === 401) {
      expect(String(data.error?.code)).toMatch(/UNAUTHORIZED/i)
    }
  })
})
