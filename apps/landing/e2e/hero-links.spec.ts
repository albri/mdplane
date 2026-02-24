import { expect, test } from '@playwright/test'

test.describe('Landing hero links', () => {
  test('demo CTA points to demo workspace route', async ({ page }) => {
    await page.goto('/')

    const demoLink = page.getByRole('link', { name: 'View Demo Workspace' }).first()
    await expect(demoLink).toBeVisible()
    await expect(demoLink).toHaveAttribute('href', /\/demo$/)
  })

  test('renders hero 3d logo scene and plane overlay', async ({ page }) => {
    await page.goto('/')

    const heroScene = page.getByTestId('hero-logo-scene')
    await expect(heroScene).toBeVisible()
    await expect(heroScene.locator('canvas').first()).toBeVisible()
    await expect(page.getByTestId('hero-dither-shader')).toBeVisible()
  })

  test('renders a section divider between hero and the problem section', async ({ page }) => {
    await page.goto('/')

    const problemSection = page
      .getByRole('heading', { name: 'THE PROBLEM' })
      .locator('xpath=ancestor::section[1]')
    const dividerBeforeProblem = problemSection.locator(
      'xpath=preceding-sibling::*[1][contains(@class, "border-dashed")]'
    )

    await expect(dividerBeforeProblem).toHaveCount(1)
  })

  test('hides API and App links on mobile header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'Docs' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'GitHub' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'API' })).toBeHidden()
    await expect(header.getByRole('link', { name: 'App' })).toBeHidden()
  })

  test('uses system theme when no saved preference exists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript(() => {
      window.localStorage.removeItem('theme')
    })

    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('[data-theme-toggle] svg').nth(1)).toHaveClass(/bg-accent/)
  })
})
