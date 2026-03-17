/**
 * Bootstrap & Persistence Tests
 *
 * Verify data persists (not in-memory mock).
 * This is the CRITICAL test that unit tests cannot cover.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('02 - Bootstrap & Persistence', () => {
  let workspace: BootstrappedWorkspace;
  const testFileName = `${uniqueName('file')}.md`;
  const testContent = `Integration test content created at ${new Date().toISOString()}`;

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  test('bootstrap creates workspace with valid ID', () => {
    expect(workspace.workspaceId).toBeDefined();
    expect(workspace.workspaceId).toMatch(/^ws_/);
  });

  test('bootstrap returns valid capability keys', () => {
    expect(workspace.readKey).toBeDefined();
    expect(workspace.readKey.length).toBeGreaterThan(10);

    expect(workspace.appendKey).toBeDefined();
    expect(workspace.appendKey.length).toBeGreaterThan(10);

    expect(workspace.writeKey).toBeDefined();
    expect(workspace.writeKey.length).toBeGreaterThan(10);
  });

  test('can create file', async () => {
    const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: testContent },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('read-after-write returns same content', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFileName}`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.content).toBe(testContent);
  });

  test('can append to file', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_test',
        type: 'comment',
        content: 'Test append from integration tests',
      },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  test('append is visible in file', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFileName}?format=parsed&appends=10`);
    const data = await response.json();

    expect(data.data.appends).toBeDefined();
    expect(data.data.appends.length).toBeGreaterThan(0);

    const append = data.data.appends[0];
    expect(append.author).toBe('__int_test');
    expect(append.type).toBe('comment');
  });

  test('file appears in folder listing', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/folders`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.data.items).toBeDefined();

    const fileItem = data.data.items.find(
      (item: { name: string }) => item.name === testFileName
    );
    expect(fileItem).toBeDefined();
  });
});
