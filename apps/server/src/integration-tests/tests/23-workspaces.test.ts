/**
 * Workspace Management Integration Tests
 *
 * Note: /workspaces/:workspaceId endpoints require OAuth session.
 * Capability key endpoints (/w/:key/settings, /r/:key/ops/file/stats) work without OAuth.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';
import { createTestWorkspaceWithKeys, linkUserToWorkspace } from '../fixtures/workspaces';

describe('23 - Workspaces', () => {
  let sessionToken: string;
  let userId: string;
  let workspaceId: string;
  let writeKey: string;
  let readKey: string;
  const settingsFilePath = `/__int_workspace_settings_${Date.now()}.md`;

  beforeAll(async () => {
    const userSession = await createUserWithSession('test-workspaces@integration.test');
    sessionToken = userSession.sessionToken;
    userId = userSession.userId;

    const workspace = await createTestWorkspaceWithKeys({
      claimed: true,
      claimedByEmail: 'test-workspaces@integration.test',
    });
    workspaceId = workspace.id;
    writeKey = workspace.writeKey.plaintextKey;
    readKey = workspace.readKey.plaintextKey;

    // Link the user to the workspace as owner (required for OAuth session-based endpoints)
    await linkUserToWorkspace({
      userId,
      workspaceId,
    });

    // These endpoints operate on the first file in the workspace for workspace-scoped keys.
    await apiRequest('PUT', `/w/${writeKey}/${settingsFilePath}`, {
      body: { content: '# Workspace Settings Fixture' },
    });
  });

  // 1. DELETE endpoint requires OAuth session
  test('DELETE /workspaces/:workspaceId returns 401 without session', async () => {
    const response = await apiRequest('DELETE', `/workspaces/${workspaceId}`);
    expect(response.status).toBe(401);
  });

  // 2. Get file settings via capability key
  test('GET /w/:key/settings returns settings', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/settings`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });

  // 5. Update file settings via capability key
  test('PATCH /w/:key/settings updates settings', async () => {
    const response = await apiRequest('PATCH', `/w/${writeKey}/settings`, {
      body: {
        appendsEnabled: true,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // 6. Get workspace stats via write key
  test('GET /w/:key/ops/stats returns stats', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/ops/stats`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });

  // 7. Write key stats include counts
  // Per OpenAPI spec, /w/:key/ops/stats returns { scope, counts, activity }
  test('write key stats include counts', async () => {
    const response = await apiRequest('GET', `/w/${writeKey}/ops/stats`);
    const data = await response.json();

    // Per OpenAPI spec: data.counts.files, data.counts.appends, etc.
    expect(data.data.counts).toBeDefined();
    expect(data.data.counts.files).toBeDefined();
  });

  // 8. Read key cannot access settings
  // Settings endpoint only exists on /w/ routes
  test('read key cannot modify settings', async () => {
    const response = await apiRequest('PATCH', `/r/${readKey}/settings`, {
      body: { appendsEnabled: false },
    });

    // Endpoint doesn't exist on /r/ routes, returns 404
    expect(response.status).toBe(404);
  });

  // 9. POST /workspaces/:workspaceId/rotate-all requires OAuth session
  test('POST /workspaces/:workspaceId/rotate-all returns 401 without session', async () => {
    const response = await apiRequest('POST', `/workspaces/${workspaceId}/rotate-all`);
    expect(response.status).toBe(401);
  });

  // 10. POST /workspaces/:workspaceId/rotate-all succeeds with valid session
  test('POST /workspaces/:workspaceId/rotate-all rotates URLs with valid session', async () => {
    const response = await apiRequest('POST', `/workspaces/${workspaceId}/rotate-all`, {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.workspaceId).toBe(workspaceId);
    expect(data.data.message).toContain('rotated');
    expect(typeof data.data.rotatedCount).toBe('number');
    expect(data.data.rotatedCount).toBeGreaterThanOrEqual(0);
  });

  // 11. POST /workspaces/:workspaceId/rotate-all returns 404 for non-owner user
  test('POST /workspaces/:workspaceId/rotate-all returns 404 for non-owner user', async () => {
    const nonOwnerUser = await createUserWithSession('test-workspaces-non-owner@integration.test');

    const response = await apiRequest('POST', `/workspaces/${workspaceId}/rotate-all`, {
      headers: getAuthHeaders(nonOwnerUser.sessionToken),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });

  // 12. POST /workspaces/:workspaceId/rotate-all returns 404 for non-existent workspace
  test('POST /workspaces/:workspaceId/rotate-all returns 404 for non-existent workspace', async () => {
    const response = await apiRequest('POST', `/workspaces/ws_nonexistent123/rotate-all`, {
      headers: getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.ok).toBe(false);
  });
});
