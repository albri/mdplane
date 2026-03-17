import { test, expect, FRONTEND_URL, TEST_KEYS } from './fixtures';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/control');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('Ctrl+/ opens shortcuts dialog', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /keyboard shortcuts/i })).toBeVisible();
  });

  test('Meta+/ opens shortcuts dialog (Mac)', async ({ page }) => {
    await page.keyboard.press('Meta+/');
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
  });

  test('Escape closes shortcuts dialog', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts-dialog')).not.toBeVisible();
  });

  test('shortcuts dialog shows all categories', async ({ page }) => {
    await page.keyboard.press('Control+/');

    const dialog = page.getByTestId('shortcuts-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Navigation')).toBeVisible();
    await expect(dialog.getByText('Actions')).toBeVisible();
    await expect(dialog.getByText('Help')).toBeVisible();
  });

  test('shortcuts dialog shows platform-specific modifier', async ({ page }) => {
    await page.keyboard.press('Control+/');

    const dialog = page.getByTestId('shortcuts-dialog');
    await expect(dialog).toBeVisible();

    const dialogText = await dialog.textContent();
    expect(dialogText).toMatch(/⌘|Ctrl/);
  });

  test('shortcuts disabled when typing in input', async ({ page }) => {
    await page.goto(`/control/${TEST_KEYS.workspaceId}/settings`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    const input = page.getByPlaceholder('Enter workspace name');

    if (await input.isVisible()) {
      await input.focus();
      await input.fill('');
      await input.press('Control+/');
      await input.press('Meta+/');
      await expect(page.getByTestId('shortcuts-dialog')).not.toBeVisible();
    }
  });

  test('clicking close button closes dialog', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await page.getByRole('button', { name: /close/i }).click();
    await expect(page.getByTestId('shortcuts-dialog')).not.toBeVisible();
  });
});



