import { test, expect, TEST_KEYS, BACKEND_URL } from './fixtures';

/**
 * Folder Management E2E Tests
 *
 * Tests for folder CRUD API operations via capability URLs.
 * These tests verify the backend APIs that power folder management.
 *
 * API Endpoints:
 * - POST /w/:key/folders - Create folder
 * - PATCH /w/:key/folders/:path - Rename folder
 * - DELETE /w/:key/folders/:path - Delete folder
 *
 * See: packages/shared/openapi/paths/folders.yaml
 */

// Helper to generate unique folder names to avoid conflicts
function uniqueFolderName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('Folder Creation API', () => {
  test('should create a new folder at root', async ({ request }) => {
    const folderName = uniqueFolderName('test-folder');

    const response = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
    // Per OpenAPI: FolderCreateResponse has path, urls, createdAt
    expect(data.data.path).toBe(`/${folderName}`);
    expect(data.data.urls).toBeDefined();
    expect(data.data.createdAt).toBeDefined();
  });

  test('should create a nested folder', async ({ request }) => {
    // First create parent folder
    const parentName = uniqueFolderName('parent');
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: parentName },
    });

    // Create child folder
    const childName = uniqueFolderName('child');
    const response = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: childName, path: `/${parentName}` },
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.path).toBe(`/${parentName}/${childName}`);
  });

  test('should reject duplicate folder names in same parent', async ({ request }) => {
    const folderName = uniqueFolderName('duplicate');

    // Create folder first time
    const firstResponse = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });
    expect(firstResponse.status()).toBe(201);

    // Try to create same folder again
    const secondResponse = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    expect(secondResponse.status()).toBe(409); // Conflict
    const data = await secondResponse.json();
    expect(data.ok).toBe(false);
  });

  test('should reject folder creation with read key', async ({ request }) => {
    const folderName = uniqueFolderName('readonly');

    // Per capability URL security model: return 404 to prevent key enumeration
    const response = await request.post(`/w/${TEST_KEYS.readKey}/folders`, {
      data: { name: folderName },
    });

    expect(response.status()).toBe(404);
  });

  test('should verify created folder appears in listing', async ({ request }) => {
    const folderName = uniqueFolderName('verify-listing');

    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    const listResponse = await request.get(`/r/${TEST_KEYS.readKey}/folders`);
    expect(listResponse.status()).toBe(200);

    const data = await listResponse.json();
    const folderNames = data.data.items
      .filter((item: { type: string }) => item.type === 'folder')
      .map((item: { name: string }) => item.name);

    expect(folderNames).toContain(folderName);
  });
});

test.describe('Folder Rename API', () => {
  test('should rename a folder', async ({ request }) => {
    const originalName = uniqueFolderName('rename-original');
    const newName = uniqueFolderName('rename-new');

    const createResponse = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: originalName },
    });
    expect(createResponse.status()).toBe(201);

    const renameResponse = await request.patch(
      `/w/${TEST_KEYS.writeKey}/folders/${originalName}`,
      { data: { name: newName } }
    );

    expect(renameResponse.status()).toBe(200);

    const data = await renameResponse.json();
    expect(data.ok).toBe(true);
    expect(data.data.previousPath).toBe(`/${originalName}`);
    expect(data.data.newPath).toBe(`/${newName}`);
  });

  test('should reject rename to existing folder name', async ({ request }) => {
    const name1 = uniqueFolderName('existing1');
    const name2 = uniqueFolderName('existing2');

    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: name1 },
    });
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: name2 },
    });

    const renameResponse = await request.patch(
      `/w/${TEST_KEYS.writeKey}/folders/${name1}`,
      { data: { name: name2 } }
    );

    expect(renameResponse.status()).toBe(409);
  });

  test('should return 404 for non-existent folder', async ({ request }) => {
    const response = await request.patch(
      `/w/${TEST_KEYS.writeKey}/folders/nonexistent-folder-xyz`,
      { data: { name: 'new-name' } }
    );

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });
});

test.describe('Folder Delete API', () => {
  test('should delete an empty folder', async ({ request }) => {
    const folderName = uniqueFolderName('delete-empty');

    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    const deleteResponse = await request.delete(
      `/w/${TEST_KEYS.writeKey}/folders/${folderName}`
    );

    expect(deleteResponse.status()).toBe(200);

    const data = await deleteResponse.json();
    expect(data.ok).toBe(true);
    expect(data.data.deleted).toBe(true);
    expect(data.data.path).toBe(`/${folderName}`);
  });

  test('should return 409 for non-empty folder without cascade', async ({ request }) => {
    const folderName = uniqueFolderName('delete-nonempty');

    // Create folder
    const folderRes = await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });
    expect(folderRes.ok()).toBe(true);

    // Create a file in the folder
    const filePath = `${folderName}/test-file.md`;
    const fileRes = await request.put(`/w/${TEST_KEYS.writeKey}/${filePath}`, {
      data: { content: '# Test File' },
    });
    expect(fileRes.ok()).toBe(true);

    // Verify file exists by listing the folder
    const listRes = await request.get(`/w/${TEST_KEYS.writeKey}/folders/${folderName}`);
    const listData = await listRes.json();
    expect(listData.data?.items?.length).toBeGreaterThan(0);

    // Try to delete non-empty folder without cascade
    const deleteResponse = await request.delete(
      `/w/${TEST_KEYS.writeKey}/folders/${folderName}`
    );

    const data = await deleteResponse.json();
    expect(deleteResponse.status()).toBe(409); // FOLDER_NOT_EMPTY
    expect(data.ok).toBe(false);
  });

  test('should delete non-empty folder with cascade flag', async ({ request }) => {
    const folderName = uniqueFolderName('delete-cascade');

    // Create folder
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    // Create files in the folder
    await request.put(`/w/${TEST_KEYS.writeKey}/${folderName}/file1.md`, {
      data: { content: '# File 1' },
    });
    await request.put(`/w/${TEST_KEYS.writeKey}/${folderName}/file2.md`, {
      data: { content: '# File 2' },
    });

    // Delete with cascade and confirmation
    const deleteResponse = await request.delete(
      `/w/${TEST_KEYS.writeKey}/folders/${folderName}`,
      {
        data: {
          cascade: true,
          confirmPath: folderName, // Without leading slash per spec
        },
      }
    );

    expect(deleteResponse.status()).toBe(200);

    const data = await deleteResponse.json();
    expect(data.ok).toBe(true);
    expect(data.data.deleted).toBe(true);
    // Per OpenAPI: filesDeleted, foldersDeleted, recoverable, expiresAt
    expect(data.data.filesDeleted).toBeGreaterThanOrEqual(2);
    expect(data.data.recoverable).toBe(true);
  });

  test('should reject cascade delete with wrong confirmPath', async ({ request }) => {
    const folderName = uniqueFolderName('cascade-wrong-confirm');

    // Create folder with file
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });
    await request.put(`/w/${TEST_KEYS.writeKey}/${folderName}/file.md`, {
      data: { content: '# Test' },
    });

    // Try cascade delete with wrong confirmPath
    const deleteResponse = await request.delete(
      `/w/${TEST_KEYS.writeKey}/folders/${folderName}`,
      {
        data: {
          cascade: true,
          confirmPath: 'wrong-path',
        },
      }
    );

    expect(deleteResponse.status()).toBe(400);
    const data = await deleteResponse.json();
    expect(data.ok).toBe(false);
  });

  test('should return 404 for deleting non-existent folder', async ({ request }) => {
    const response = await request.delete(
      `/w/${TEST_KEYS.writeKey}/folders/nonexistent-folder-xyz`
    );

    expect(response.status()).toBe(404);
  });

  test('should verify deleted folder no longer appears in listing', async ({ request }) => {
    const folderName = uniqueFolderName('verify-deleted');

    // Create and then delete folder
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });
    await request.delete(`/w/${TEST_KEYS.writeKey}/folders/${folderName}`);

    // Verify it's gone from listing
    const listResponse = await request.get(`/r/${TEST_KEYS.readKey}/folders`);
    const data = await listResponse.json();

    const folderNames = data.data.items
      .filter((item: { type: string }) => item.type === 'folder')
      .map((item: { name: string }) => item.name);

    expect(folderNames).not.toContain(folderName);
  });
});

test.describe('Folder Permission Checks', () => {
  test('read key should allow folder listing', async ({ request }) => {
    const response = await request.get(`/r/${TEST_KEYS.readKey}/folders`);
    expect(response.status()).toBe(200);
  });

  test('read key should not allow folder creation', async ({ request }) => {
    // Per capability URL security model: return 404 to prevent key enumeration
    const response = await request.post(`/w/${TEST_KEYS.readKey}/folders`, {
      data: { name: uniqueFolderName('readonly') },
    });
    expect(response.status()).toBe(404);
  });

  test('read key should not allow folder deletion', async ({ request }) => {
    // First create a folder with write key
    const folderName = uniqueFolderName('readonly-delete');
    await request.post(`/w/${TEST_KEYS.writeKey}/folders`, {
      data: { name: folderName },
    });

    // Try to delete with read key
    // Per capability URL security model: return 404 to prevent key enumeration
    const response = await request.delete(
      `/w/${TEST_KEYS.readKey}/folders/${folderName}`
    );
    expect(response.status()).toBe(404);
  });
});

