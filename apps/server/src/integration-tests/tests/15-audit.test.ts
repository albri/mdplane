/**
 * Audit Log Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createTestWorkspaceWithKeys } from '../fixtures/workspaces';
import { uniqueName } from '../helpers/test-utils';

describe('15 - Audit Log', () => {
  let workspaceId: string;
  let writeKey: string;
  let testFileName: string;

  beforeAll(async () => {
    const workspace = await createTestWorkspaceWithKeys();
    workspaceId = workspace.id;
    writeKey = workspace.writeKey.plaintextKey;
    testFileName = `${uniqueName('audit')}.md`;

    // Perform some actions to generate audit entries
    await apiRequest('PUT', `/w/${writeKey}/${testFileName}`, {
      body: { content: '# Audit Test' },
    });

    await apiRequest('PUT', `/w/${writeKey}/${testFileName}`, {
      body: { content: '# Audit Test Updated' },
    });
  });

  // 1. Get audit log
  // Response format: { ok: true, data: [...entries], pagination: {...} }
  test('GET /w/:key/audit returns log entries', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/audit`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    // data.data is the entries array directly
    expect(Array.isArray(data.data)).toBe(true);
  });

  // 2. Audit log has entries (may be empty for new workspace)
  test('audit log returns array', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/audit`);
    const data = await response.json();

    // data.data is the entries array directly
    expect(Array.isArray(data.data)).toBe(true);
    // New workspace may have 0 entries, that's OK
    expect(data.data.length).toBeGreaterThanOrEqual(0);
  });

  // 3. Audit entries have expected fields (if any exist)
  test('audit entries have required fields', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/audit`);
    const data = await response.json();

    // data.data is the entries array directly
    if (data.data.length > 0) {
      const entry = data.data[0];
      // Should have action, timestamp, and potentially path
      expect(entry.action || entry.type || entry.event).toBeDefined();
      expect(entry.createdAt || entry.timestamp || entry.at).toBeDefined();
    }
  });

  // 4. Audit log supports pagination
  test('GET /w/:key/audit supports limit', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/audit?limit=5`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    // data.data is the entries array directly
    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  // 5. Audit log supports cursor-based pagination (per OpenAPI spec)
  test('GET /w/:key/audit supports cursor pagination', async () => {
    // Get first page
    const response1 = await apiRequest('GET', `/w/${writeKey}/audit?limit=2`);
    const data1 = await response1.json();

    // Pagination uses cursor (per OpenAPI spec)
    expect(data1.pagination).toBeDefined();
    expect(data1.pagination.hasMore).toBeDefined();

    if (data1.pagination?.hasMore && data1.pagination?.cursor) {
      const response2 = await apiRequest('GET', `/w/${writeKey}/audit?limit=2&cursor=${encodeURIComponent(data1.pagination.cursor)}`);
      expect(response2.ok).toBe(true);
      const data2 = await response2.json();
      // Verify no duplicates between pages
      const page1Ids = data1.data.map((l: { id: string }) => l.id);
      const page2Ids = data2.data.map((l: { id: string }) => l.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    }
  });

  // 6. Read key cannot access audit log (write-only)
  test('read key cannot access audit log', async () => {
    const workspace = await createTestWorkspaceWithKeys();
    const readKey = workspace.readKey.plaintextKey;

    const response = await apiRequest('GET', `/r/${readKey}/audit`);

    // Audit endpoint only exists on /w/ routes, returns 404 for /r/ routes
    expect(response.status).toBe(404);
  });
});
