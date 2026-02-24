/**
 * Folder Operations Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('07 - Folder Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFolderName = uniqueName('folder');

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  test('GET /r/:key/folders lists root contents', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/folders`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.items).toBeDefined();
    expect(Array.isArray(data.data.items)).toBe(true);
  });

  test('GET /a/:key/folders lists with append key', async () => {
    const response = await apiRequest('GET', `/a/${workspace.appendKey}/folders`);
    expect(response.ok).toBe(true);
  });

  test('GET /w/:key/folders lists with write key', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/folders`);
    expect(response.ok).toBe(true);
  });

  test('POST /w/:key/folders creates subfolder', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: testFolderName },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('GET /r/:key/folders/:path lists subfolder', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/${testFolderName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.items).toBeDefined();
  });

  test('POST /w/:key/folders/:path/files creates file in folder', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders/${testFolderName}/files`, {
      body: { filename: 'test-file.md', content: '# Test file in folder' },
    });
    expect(response.status).toBe(201);
  });

  test('POST /a/:key/folders/:path/files creates file with append key', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/folders/${testFolderName}/files`, {
      body: { filename: 'append-created.md', content: '# Append created file' },
    });
    expect(response.status).toBe(201);
  });

  test('GET /w/:key/folders/:path/settings returns settings', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/folders/${testFolderName}/settings`);
    expect(response.ok).toBe(true);
  });

  test('PATCH /w/:key/folders/:path/settings updates settings', async () => {
    const response = await apiRequest('PATCH', `/w/${workspace.writeKey}/folders/${testFolderName}/settings`, {
      body: { appendsEnabled: true },
    });
    expect(response.ok).toBe(true);
  });

  test('GET /a/:key/folders/:path/claims returns claims', async () => {
    const response = await apiRequest('GET', `/a/${workspace.appendKey}/folders/${testFolderName}/claims`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('POST /a/:key/folders/:path/bulk creates multiple files', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/folders/${testFolderName}/bulk`, {
      body: {
        files: [
          { filename: 'bulk1.md', content: '# Bulk 1' },
          { filename: 'bulk2.md', content: '# Bulk 2' },
        ],
      },
    });
    expect(response.ok).toBe(true);
  });

  test('GET /r/:key/ops/folders/search?path=:path searches folder', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${testFolderName}&q=test`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('GET /r/:key/ops/folders/stats?path=:path returns stats', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/stats?path=${testFolderName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('GET /r/:key/ops/folders/tasks?path=:path lists tasks', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/tasks?path=${testFolderName}`);
    expect(response.ok).toBe(true);
  });

  const renameFolder = uniqueName('rename');
  const renamedFolder = uniqueName('renamed');

  test('create folder for rename test', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: renameFolder },
    });
    expect(response.status).toBe(201);
  });

  test('PATCH /w/:key/folders/:path renames folder', async () => {
    const response = await apiRequest('PATCH', `/w/${workspace.writeKey}/folders/${renameFolder}`, {
      body: { name: renamedFolder },
    });
    expect(response.ok).toBe(true);
  });

  const deleteFolder = uniqueName('todelete');

  test('create folder for delete test', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: deleteFolder },
    });
    expect(response.status).toBe(201);
  });

  test('DELETE /w/:key/folders/:path deletes folder', async () => {
    const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/folders/${deleteFolder}`);
    expect(response.ok).toBe(true);
  });

  describe('Sorting query params', () => {
    test('GET /r/:key/folders?sort=name returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?sort=name`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.items).toBeDefined();
    });

    test('GET /r/:key/folders?sort=modified returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?sort=modified`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.items).toBeDefined();
    });

    test('GET /r/:key/folders?sort=size returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?sort=size`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.items).toBeDefined();
    });

    test('GET /r/:key/folders?order=asc returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?order=asc`);
      expect(response.ok).toBe(true);
    });

    test('GET /r/:key/folders?order=desc returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?order=desc`);
      expect(response.ok).toBe(true);
    });

    test('GET /r/:key/folders?sort=modified&order=desc returns 200', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?sort=modified&order=desc`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.data.items).toBeDefined();
    });

    test('GET /r/:key/folders?sort=invalid returns 400', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?sort=invalid`);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('INVALID_REQUEST');
    });

    test('GET /r/:key/folders?order=invalid returns 400', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders?order=invalid`);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('INVALID_REQUEST');
    });

    test('GET /a/:key/folders?sort=size&order=desc works with append key', async () => {
      const response = await apiRequest('GET', `/a/${workspace.appendKey}/folders?sort=size&order=desc`);
      expect(response.ok).toBe(true);
    });

    test('GET /w/:key/folders?sort=name&order=asc works with write key', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/folders?sort=name&order=asc`);
      expect(response.ok).toBe(true);
    });
  });
});


