/**
 * Quota/Stats Integration Tests
 *
 * Quota info is obtained via /w/:key/ops/stats which includes storage counts.
 * No dedicated /api/v1/quota endpoint exists - stats are per-workspace via capability keys.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createTestWorkspaceWithKeys } from '../fixtures/workspaces';

describe('24 - Quota', () => {
  let writeKey: string;

  beforeAll(async () => {
    const workspace = await createTestWorkspaceWithKeys();
    writeKey = workspace.writeKey.plaintextKey;
  });

  test('stats include storage counts via write key', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/ops/stats`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.counts).toBeDefined();
    expect(data.data.counts.files).toBeDefined();
  });

  test('stats include activity info', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/ops/stats`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.activity).toBeDefined();
  });
});
