import { expect, unauthTest, FRONTEND_URL } from './fixtures';
import { DEMO_READ_KEY } from '../../../packages/shared/src/constants/demo';

unauthTest.describe('Demo Route', () => {
  unauthTest('redirects /demo to the canonical demo reader URL', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/demo`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(`/r/${DEMO_READ_KEY}$`));
    await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible();
  });

  unauthTest('loads the direct demo reader route', async ({ page }) => {
    const response = await page.goto(`${FRONTEND_URL}/r/${DEMO_READ_KEY}`);
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`/r/${DEMO_READ_KEY}$`));
    await expect(page.locator('[data-testid="reader-layout"]')).toBeVisible();
    await expect(page.getByText('404 Not Found')).toHaveCount(0);
  });
});
