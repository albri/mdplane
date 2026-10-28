import { expect, expectAccessible, test } from './fixtures.ts'

for (const [path, title] of [
  ['/', /shared worklog/],
  ['/demo', /Sample session|release-2-4/],
  ['/no-such-page', /Not found/],
] as const) {
  test(`${path} is accessible`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveTitle(title)
    await expectAccessible(page)
  })
}

const policy = (headers: Record<string, string>) => ({
  csp: headers['content-security-policy'],
  coop: headers['cross-origin-opener-policy'],
  permissions: headers['permissions-policy'],
  referrer: headers['referrer-policy'],
})

test('static pages and Worker pages send the same security headers', async ({ request }) => {
  const [landing, missing] = await Promise.all([
    request.get('/'),
    request.get('/r/wk_7Qm2x9Lp4Rt8.x3Kq9Lm2Vb7Np4Rt8Wc6Hy1Jd5Fs0Ga3Z', {
      headers: { Accept: 'text/html' },
    }),
  ])
  expect(missing.status()).toBe(404)
  expect(policy(landing.headers()).csp).toContain("require-trusted-types-for 'script'")
  expect(policy(missing.headers())).toEqual(policy(landing.headers()))
  expect(missing.headers()['x-robots-tag']).toBe('noindex')
})

test('fingerprinted assets are cached for good', async ({ page, request }) => {
  await page.goto('/')
  const stylesheet = await page.locator('link[rel="stylesheet"]').getAttribute('href')
  expect(stylesheet).toMatch(/^\/assets\/main-\w+\.css$/)
  const response = await request.get(stylesheet ?? '')
  expect(response.headers()['cache-control']).toContain('immutable')
})
