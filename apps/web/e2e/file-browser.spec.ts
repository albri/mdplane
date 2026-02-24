import { test, expect } from '@playwright/test';
import { TEST_KEYS, TEST_FOLDERS, TEST_FILES, BACKEND_URL } from './fixtures';

/**
 * File Browser E2E Tests
 *
 * Tests for file/folder API operations via capability URLs.
 * These tests verify the backend API that powers the file browser.
 *
 * See: docs/UI-UX Design Specification.md#File Browser
 */

test.describe('File Listing API', () => {
  test('should list root folder contents', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.items).toBeInstanceOf(Array);
    expect(data.data.items.length).toBeGreaterThan(0);
  });

  test('should return correct item structure', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);
    const data = await response.json();

    for (const item of data.data.items) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('updatedAt');
      expect(['file', 'folder']).toContain(item.type);

      if (item.type === 'folder') {
        expect(item).toHaveProperty('childCount');
      } else {
        expect(item).toHaveProperty('size');
        expect(item).toHaveProperty('urls');
      }
    }
  });

  test('should list files in docs folder', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders/docs`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.items).toBeInstanceOf(Array);

    const names = data.data.items.map((item: { name: string }) => item.name);
    expect(names).toContain('getting-started.md');
    expect(names).toContain('api-reference.md');
  });

  test('should list files in src folder', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders/src`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);

    const names = data.data.items.map((item: { name: string }) => item.name);
    expect(names).toContain('index.ts');
  });

  test('should return 404 for non-existent folder', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders/nonexistent`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('FOLDER_NOT_FOUND');
  });
});

test.describe('File Content API', () => {
  test('should read README.md content', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/README.md`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('# E2E Test Workspace');
    expect(data.data.filename).toBeDefined();
  });

  test('should read file from nested path', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/docs/getting-started.md`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('# Getting Started');
  });

  test('should return 404 for non-existent file', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/nonexistent-file.md`);

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('FILE_NOT_FOUND');
  });

  test('should read file with frontmatter using parsed format', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/examples/backlog.md?format=parsed`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toContain('---');
    expect(data.data.frontmatter).toBeDefined();
    expect(data.data.frontmatter.title).toBe('Backlog');
  });
});

test.describe('Permission Levels', () => {
  test('read key should allow folder listing', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);
    expect(response.status()).toBe(200);
  });

  test('read key should allow file reading', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/README.md`);
    expect(response.status()).toBe(200);
  });

  test('write key should allow file creation', async ({ request }) => {
    const testPath = `/test-e2e-${Date.now()}.md`;
    const response = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`, {
      data: { content: '# Test File\n\nCreated by E2E test.' },
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
    // API returns: id, etag, updatedAt, size
    expect(data.data.id).toBeDefined();
  });

  test('write key should allow file update', async ({ request }) => {
    // First create a file
    const testPath = `/test-update-${Date.now()}.md`;
    const createResponse = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`, {
      data: { content: '# Original Content' },
    });
    expect(createResponse.status()).toBe(201);

    // Then update it
    const updateResponse = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`, {
      data: { content: '# Updated Content' },
    });

    // Per API spec: 200 status indicates file update (not create)
    expect(updateResponse.status()).toBe(200);

    const data = await updateResponse.json();
    expect(data.ok).toBe(true);
    // API returns: id, etag, updatedAt, size
    expect(data.data.etag).toBeDefined();
  });

  test('write key should allow file deletion', async ({ request }) => {
    // First create a file
    const testPath = `/test-delete-${Date.now()}.md`;
    await request.put(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`, {
      data: { content: '# To Be Deleted' },
    });

    // Then delete it
    const deleteResponse = await request.delete(`${BACKEND_URL}/w/${TEST_KEYS.writeKey}${testPath}`);

    expect(deleteResponse.status()).toBe(200);

    const data = await deleteResponse.json();
    expect(data.ok).toBe(true);
    expect(data.data.deleted).toBe(true);
  });

  test('read key should not allow file creation', async ({ request }) => {
    const testPath = `/test-readonly-${Date.now()}.md`;

    // Using /w/ endpoint with read key should fail
    // Per capability URL security model: return 404 to prevent key enumeration
    const response = await request.put(`${BACKEND_URL}/w/${TEST_KEYS.readKey}${testPath}`, {
      data: { content: '# Should Fail' },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('Path Security', () => {
  test('should reject path traversal attempts', async ({ request }) => {
    // Try to traverse out of the folders endpoint
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders/../etc/passwd`);

    // Path traversal returns 400 INVALID_PATH
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_PATH');
  });

  test('should reject encoded path traversal', async ({ request }) => {
    // Try encoded path traversal
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders/%2e%2e/%2e%2e/etc/passwd`);

    // Path traversal returns 400 INVALID_PATH
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_PATH');
  });

  test('should handle special characters in path', async ({ request }) => {
    // Path with URL-safe special characters should work
    const response = await request.get(`${BACKEND_URL}/r/${TEST_KEYS.readKey}/folders`);
    expect(response.status()).toBe(200);
  });
});

