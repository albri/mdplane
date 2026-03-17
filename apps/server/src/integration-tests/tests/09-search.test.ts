/**
 * Search Operations Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('09 - Search Operations', () => {
  let workspace: BootstrappedWorkspace;
  const testFolderName = uniqueName('search');
  const searchTerm = 'findableterm';
  const contentOnlyTerm = uniqueName('content_only_term');
  const contentOnlyPath = `${testFolderName}/content-only.md`;

  beforeAll(async () => {
    workspace = await bootstrap();

    await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: testFolderName },
    });

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFolderName}/searchable.md`, {
      body: { content: `# Search Test\n\nThis file contains ${searchTerm} for testing.` },
    });

    // Content-only file (no appends) to prove cross-file markdown content search.
    await apiRequest('PUT', `/w/${workspace.writeKey}/${contentOnlyPath}`, {
      body: { content: `# Content Only\n\nThis token exists only in file content: ${contentOnlyTerm}` },
    });

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFolderName}/tasks.md`, {
      body: { content: '# Tasks\n\n- [ ] Pending task\n- [x] Completed task' },
    });

    await apiRequest('POST', `/a/${workspace.appendKey}/${testFolderName}/searchable.md`, {
      body: {
        author: '__int_search',
        type: 'task',
        content: `Task with ${searchTerm}`,
      },
    });
  });

  test('GET /r/:key/ops/folders/search?path=:path finds content', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${testFolderName}&q=${searchTerm}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results).toBeDefined();
    expect(data.data.results.length).toBeGreaterThan(0);
  });

  test('GET /r/:key/search finds file content across files (type=file)', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${contentOnlyTerm}`);
    expect(response.ok).toBe(true);
    const data = await response.json();

    const fileHits = (data.data.results as Array<{ type: string; file?: { path: string } }>).filter(
      (r) => r.type === 'file'
    );
    expect(fileHits.length).toBeGreaterThan(0);
    expect(fileHits.some((r) => r.file?.path === `/${contentOnlyPath}`)).toBe(true);
  });

  test('GET /r/:key/search excludes deleted files (deleted_at)', async () => {
    // Soft-delete the content-only file
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${contentOnlyPath}`);

    const response = await apiRequest('GET', `/r/${workspace.readKey}/search?q=${contentOnlyTerm}`);
    expect(response.ok).toBe(true);
    const data = await response.json();

    const hasDeleted = (data.data.results as Array<{ file?: { path: string } }>).some(
      (r) => r.file?.path === `/${contentOnlyPath}`
    );
    expect(hasDeleted).toBe(false);
  });

  test('GET /r/:key/ops/folders/search searches root', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?q=${searchTerm}`);
    expect(response.ok).toBe(true);
  });

  test('GET /r/:key/ops/folders/tasks?path=:path returns tasks', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/tasks?path=${testFolderName}`);
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`Expected successful task query, got ${response.status}: ${JSON.stringify(errorBody)}`);
    }
    const data = await response.json();
    expect(data.data.tasks).toBeDefined();
  });

  test('GET /r/:key/ops/folders/tasks without path queries workspace root', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/tasks`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.tasks).toBeDefined();
  });

  test('GET /r/:key/ops/folders/tasks?path=:path&status=pending filters tasks', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/tasks?path=${testFolderName}&status=pending`);
    expect(response.ok).toBe(true);
  });

  test('GET /r/:key/ops/folders/stats?path=:path returns stats', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/stats?path=${testFolderName}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('search supports pagination', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${testFolderName}&q=test&limit=1`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results).toBeDefined();
  });

  test('search without query parameter', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${testFolderName}`);
    expect(response.status).toBe(200);
  });

  test('search results include file URLs', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/folders/search?path=${testFolderName}&q=${searchTerm}`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    if (data.data.results && data.data.results.length > 0) {
      const result = data.data.results[0];
      expect(result.file || result.path || result.url).toBeDefined();
    }
  });
});


