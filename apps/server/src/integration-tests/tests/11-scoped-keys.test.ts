/**
 * Scoped Key Operations Integration Tests
 *
 * Tests scoped key creation, usage, and deletion.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('11 - Scoped Keys', () => {
  let workspace: BootstrappedWorkspace;
  let scopedKeyId: string;
  let scopedReadKey: string;
  const testFolderName = uniqueName('scoped');
  const testFileName = `${testFolderName}/test.md`;
  const outsideFileName = 'outside-secret.md';

  beforeAll(async () => {
    workspace = await bootstrap();

    await apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
      body: { name: testFolderName },
    });

    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: '# Scoped Key Test' },
    });

    await apiRequest('PUT', `/w/${workspace.writeKey}/${outsideFileName}`, {
      body: { content: '# Outside Scope Secret' },
    });
  });

  test('POST /capabilities/check returns key info', async () => {
    const response = await apiRequest('POST', '/capabilities/check', {
      body: { keys: [workspace.readKey] },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results).toBeDefined();
    expect(data.data.results.length).toBe(1);
    expect(data.data.results[0].valid).toBe(true);
  });

  test('POST /w/:key/capabilities/check returns extended info for workspace keys', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/capabilities/check`, {
      body: { keys: [workspace.readKey, workspace.appendKey, workspace.writeKey] },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results).toBeDefined();
    expect(data.data.results.length).toBe(3);

    // All keys should be valid and have status: active
    for (const result of data.data.results) {
      expect(result.valid).toBe(true);
      expect(result.status).toBe('active');
    }
  });

  test('POST /w/:key/capabilities/check works with any permission level', async () => {
    // Even read keys can check capabilities (introspection doesn't require write)
    const response = await apiRequest('POST', `/w/${workspace.readKey}/capabilities/check`, {
      body: { keys: [workspace.writeKey] },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results[0].valid).toBe(true);
    expect(data.data.results[0].status).toBe('active');
  });

  test('POST /w/:key/capabilities/check returns 404 for invalid workspace key', async () => {
    const response = await apiRequest('POST', '/w/invalidkey123456789/capabilities/check', {
      body: { keys: [workspace.readKey] },
    });

    expect(response.status).toBe(404);
  });

  test('POST /w/:key/keys creates scoped key', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/keys`, {
      body: {
        permission: 'read',
        displayName: uniqueName('scoped'),
        paths: [`/${testFolderName}`],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.key).toBeDefined();

    scopedKeyId = data.data.id;
    scopedReadKey = data.data.key;
  });

  test('GET /w/:key/keys lists scoped keys', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/keys`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  // Route #7: Check scoped key returns path in extended info
  test('POST /w/:key/capabilities/check returns path for scoped keys', async () => {
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/capabilities/check`, {
      body: { keys: [scopedReadKey] },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results[0].valid).toBe(true);
    expect(data.data.results[0].status).toBe('active');
    // Scoped keys have a path restriction
    expect(data.data.results[0].path).toBeDefined();
    expect(data.data.results[0].path).toContain(testFolderName);
  });

  test('scoped key can read files in scope', async () => {
    const response = await apiRequest('GET', `/r/${scopedReadKey}/${testFolderName}/test.md`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.content).toBeDefined();
  });

  test('scoped key cannot read files outside scope', async () => {
    const response = await apiRequest('GET', `/r/${scopedReadKey}/outside-scope.md`);

    expect(response.status).toBe(404);
  });

  test('scoped key cannot escape scope via ../ traversal segment', async () => {
    const response = await apiRequest('GET', `/r/${scopedReadKey}/${testFolderName}/../${outsideFileName}`);

    expect([400, 404]).toContain(response.status);
  });

  test('scoped key cannot escape scope via encoded traversal segment', async () => {
    const response = await apiRequest('GET', `/r/${scopedReadKey}/${testFolderName}/%2e%2e/${outsideFileName}`);

    expect([400, 404]).toContain(response.status);
  });

  test('read-only scoped key cannot write', async () => {
    const response = await apiRequest('PUT', `/w/${scopedReadKey}/${testFileName}`, {
      body: { content: 'Should fail' },
    });

    expect(response.status).toBe(404);
  });

  test('DELETE /w/:key/keys/:id deletes scoped key', async () => {
    const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/keys/${scopedKeyId}`);

    expect(response.ok).toBe(true);
  });

  test('GET /w/:key/keys excludes revoked keys by default', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/keys`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    const revokedKey = data.data.find((key: { id: string }) => key.id === scopedKeyId);
    expect(revokedKey).toBeUndefined();
  });

  test('GET /w/:key/keys?includeRevoked=true includes revoked keys', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/keys?includeRevoked=true`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    const revokedKey = data.data.find((key: { id: string; revoked?: boolean }) => key.id === scopedKeyId);
    expect(revokedKey).toBeDefined();
    expect(revokedKey.revoked).toBe(true);
  });

  test('deleted scoped key returns 404', async () => {
    const response = await apiRequest('GET', `/r/${scopedReadKey}/${testFileName}`);

    expect(response.status).toBe(404);
  });

  test('POST /w/:key/capabilities/check returns minimal info for other workspace keys', async () => {
    // Create a second workspace
    const workspace2 = await bootstrap();

    // Check workspace2's key using workspace1's context
    const response = await apiRequest('POST', `/w/${workspace.writeKey}/capabilities/check`, {
      body: { keys: [workspace2.readKey] },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.results[0].valid).toBe(true);
    // Cross-workspace keys should NOT have extended info
    expect(data.data.results[0].status).toBeUndefined();
    expect(data.data.results[0].path).toBeUndefined();
    // But should still have basic info
    expect(data.data.results[0].permission).toBeDefined();
    expect(data.data.results[0].scope).toBeDefined();
  });
});
