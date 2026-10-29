import { expect, expectAccessible, test } from './fixtures.ts'

for (const [path, title, status] of [
  ['/', /shared worklog/, 200],
  ['/demo', /Sample session|release-2-4/, 200],
  ['/privacy', /Privacy/, 200],
  ['/no-such-page', /Not found/, 404],
] as const) {
  test(`${path} is accessible`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(status)
    await expect(page).toHaveTitle(title)
    await expectAccessible(page)
  })
}

test('the footer links to the privacy page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// The privacy page says so, so a cookie or a request to another site would make it false.
test('pages set no cookies and load nothing from other sites', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? '').origin
  const foreign: string[] = []
  page.on('request', (request) => {
    const { protocol, origin: from } = new URL(request.url())
    if (protocol.startsWith('http') && from !== origin) foreign.push(request.url())
  })
  for (const path of ['/', '/demo', '/privacy']) await page.goto(path)
  expect(foreign).toEqual([])
  expect(await context.cookies()).toEqual([])
})

const policy = (headers: Record<string, string>) => ({
  csp: headers['content-security-policy'],
  coop: headers['cross-origin-opener-policy'],
  permissions: headers['permissions-policy'],
  referrer: headers['referrer-policy'],
})

test('static pages and Worker pages send the same security headers', async ({ request }) => {
  const [demo, privacy, landing, missing] = await Promise.all([
    request.get('/demo'),
    request.get('/privacy'),
    // The Worker answers the root first, so it can give agents markdown instead.
    request.get('/', { headers: { Accept: 'text/html' } }),
    request.get('/r/wk_7Qm2x9Lp4Rt8.x3Kq9Lm2Vb7Np4Rt8Wc6Hy1Jd5Fs0Ga3Z', {
      headers: { Accept: 'text/html' },
    }),
  ])
  expect(missing.status()).toBe(404)
  expect(policy(demo.headers()).csp).toContain("require-trusted-types-for 'script'")
  expect(policy(privacy.headers())).toEqual(policy(demo.headers()))
  expect(policy(landing.headers())).toEqual(policy(demo.headers()))
  expect(policy(missing.headers())).toEqual(policy(demo.headers()))
  expect(landing.headers()['x-robots-tag']).toBeUndefined()
  expect(missing.headers()['x-robots-tag']).toBe('noindex')
})

test('the root gives an agent the start instructions', async ({ request, baseURL }) => {
  // What Claude Code's WebFetch sends.
  const response = await request.get('/', {
    headers: { Accept: 'text/markdown, text/html, */*' },
  })
  expect(response.headers()['content-type']).toBe('text/markdown; charset=utf-8')
  expect(await response.text()).toContain(`POST ${baseURL}/workspaces`)
})

test('fingerprinted assets are cached for good', async ({ page, request }) => {
  await page.goto('/')
  const stylesheet = await page.locator('link[rel="stylesheet"]').getAttribute('href')
  expect(stylesheet).toMatch(/^\/assets\/main-\w+\.css$/)
  const response = await request.get(stylesheet ?? '')
  expect(response.headers()['cache-control']).toContain('immutable')
})
