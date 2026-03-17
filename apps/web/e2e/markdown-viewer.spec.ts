import { test, expect } from '@playwright/test';
import { TEST_KEYS, BACKEND_URL } from './fixtures';

async function createTestFile(
  filePath: string,
  content: string,
  request: import('@playwright/test').APIRequestContext
) {
  const res = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${filePath}`, {
    headers: { 'Content-Type': 'application/json' },
    data: { content },
  });
  expect(res.ok()).toBe(true);
}

test.describe('Markdown Viewer', () => {
  const PATHS = {
    basic: '/__e2e__/markdown-viewer/basic.md',
    mermaid: '/__e2e__/markdown-viewer/mermaid.md',
    invalidMermaid: '/__e2e__/markdown-viewer/invalid-mermaid.md',
    xss: '/__e2e__/markdown-viewer/xss.md',
  } as const;

  test.beforeAll(async ({ request }) => {
    await createTestFile(
      PATHS.basic,
      [
        '# Markdown Viewer Test',
        '',
        'This is **bold** and *italic*.',
        '',
        '## Code',
        '',
        '```ts',
        'const x: number = 1;',
        'console.log(x);',
        '```',
        '',
        '## Table',
        '',
        '| Col | Val |',
        '| --- | --- |',
        '| A | 1 |',
        '| B | 2 |',
        '',
        '## Tasks',
        '',
        '- [ ] todo item',
        '- [x] done item',
        '',
      ].join('\n'),
      request
    );

    await createTestFile(
      PATHS.mermaid,
      [
        '# Mermaid Test',
        '',
        '```mermaid',
        'flowchart TD',
        '  A[Start] --> B{Choice}',
        '  B -->|Yes| C[Ok]',
        '  B -->|No| D[Stop]',
        '```',
        '',
        '```mermaid',
        'sequenceDiagram',
        '  Alice->>Bob: Hello Bob',
        '  Bob-->>Alice: Hi Alice',
        '```',
        '',
      ].join('\n'),
      request
    );

    await createTestFile(
      PATHS.invalidMermaid,
      [
        '# Invalid Mermaid Test',
        '',
        '```mermaid',
        'flowchart TD',
        '  A -->',
        '```',
        '',
      ].join('\n'),
      request
    );

    await createTestFile(
      PATHS.xss,
      [
        '# XSS Test',
        '',
        '<script>window.__xss = true;</script>',
        '',
        '<img src="x" onerror="window.__xss2 = true" />',
        '',
        '[bad js link](javascript:alert(1))',
        '',
        '[bad data link](data:text/html,hi)',
        '',
        'Normal content after XSS test',
        '',
      ].join('\n'),
      request
    );
  });

  test('should render markdown with basic formatting', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const proseReader = page.locator('article .prose-reader').first();
    await expect(proseReader.locator('h1').first()).toBeVisible();
    await expect(proseReader.getByText('bold')).toBeVisible();
    await expect(proseReader.getByText('italic')).toBeVisible();
  });

  test('should render code blocks with syntax highlighting', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const content = page.locator('article, .prose-reader').first();
    const codeBlocks = content.locator('pre code');
    await expect(codeBlocks.first()).toBeVisible();
  });

  test('should render a language header above code blocks by default', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const content = page.locator('article, .prose-reader').first();
    await expect(content.getByText('TypeScript')).toBeVisible();
  });

  test('should render shiki variable-based styles (no hardcoded light theme colors)', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const content = page.locator('article, .prose-reader').first();
    const figure = content.locator('figure.shiki').first();
    await expect(figure).toBeVisible();

    await expect.poll(async () => {
      const outerHtml = await figure.evaluate((el) => el.outerHTML);
      return outerHtml.includes('--shiki-light-bg') || outerHtml.includes('--shiki-dark-bg');
    }).toBe(true);

    const outerHtml = await figure.evaluate((el) => el.outerHTML);
    expect(outerHtml).not.toContain('background-color:#fff');
    expect(outerHtml).not.toContain('color:#24292e');

    await expect(content.locator('.mdp-code-line-number')).toHaveCount(0);
  });

  test('should render GFM tables', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const content = page.locator('article, .prose-reader').first();
    const tables = content.locator('table');
    await expect(tables.first()).toBeVisible();
    await expect(tables.locator('th', { hasText: 'Col' })).toBeVisible();
  });

  test('should render GFM task lists with disabled checkboxes', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.basic}`);

    const content = page.locator('article, .prose-reader').first();
    const checkboxes = content.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(2);
    await expect(checkboxes.first()).toBeVisible();
    await expect(checkboxes.first()).toBeDisabled();
  });

  test('should render mermaid diagrams', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.mermaid}`);

    const content = page.locator('article, .prose-reader').first();
    const mermaidDivs = content.locator('[data-testid="mermaid-diagram"]');

    await expect(mermaidDivs).toHaveCount(2);
    await expect(mermaidDivs.first().locator('svg')).toBeVisible({ timeout: 15000 });
    await expect(mermaidDivs.nth(1).locator('svg')).toBeVisible({ timeout: 15000 });
  });

  test('should not execute raw HTML (sanitization)', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.xss}`);

    const content = page.locator('article, .prose-reader').first();
    await expect(content).toBeVisible();

    const scripts = content.locator('script');
    await expect(scripts).toHaveCount(0);

    const elementsWithEvents = await content.evaluate((el) => {
      const allElements = el.querySelectorAll('*');
      for (const element of allElements) {
        const attributes = element.attributes;
        for (let i = 0; i < attributes.length; i++) {
          const attrName = attributes[i].name.toLowerCase();
          if (attrName.startsWith('on')) {
            return true;
          }
        }
      }
      return false;
    });

    await expect(elementsWithEvents).toBe(false);

    await expect(content.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(content.locator('a[href^="data:"]')).toHaveCount(0);

    await expect(content.getByText('Normal content after XSS test')).toBeVisible();
  });

  test('should show error state for non-existent file', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}/__e2e__/markdown-viewer/does-not-exist.md`);

    await expect(page.getByText('not found', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="reader-main"]')).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should handle mermaid diagram rendering errors gracefully', async ({ page }) => {
    await page.goto(`/r/${TEST_KEYS.readKey}${PATHS.invalidMermaid}`);

    const content = page.locator('.prose-reader');
    await expect(content).toBeVisible();

    await expect(page.getByText('Failed to render diagram')).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/error/);
  });
});
