/**
 * API Key Management Integration Tests
 *
 * Tests API key management endpoints using mock OAuth sessions.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';
import { createTestWorkspaceWithKeys, linkUserToWorkspace } from '../fixtures/workspaces';

describe('10 - API Keys', () => {
  let sessionToken: string;
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const userSession = await createUserWithSession('test-api-keys@integration.test');
    sessionToken = userSession.sessionToken;
    userId = userSession.userId;

    const workspace = await createTestWorkspaceWithKeys();
    workspaceId = workspace.id;

    await linkUserToWorkspace({ userId, workspaceId });
  });

  test('POST /workspaces/:id/api-keys creates API key with session', async () => {
    const response = await apiRequest('POST', `/workspaces/${workspaceId}/api-keys`, {
      headers: getAuthHeaders(sessionToken),
      body: { name: 'Test API Key', permissions: ['read'] },
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.key).toBeDefined();
    expect(data.data.permissions).toEqual(['read']);
  });

  test('GET /workspaces/:id/api-keys lists API keys with session', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/api-keys`, {
      headers: getAuthHeaders(sessionToken),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data.keys)).toBe(true);
  });

  test('DELETE /workspaces/:id/api-keys/:keyId deletes API key with session', async () => {
    const createResponse = await apiRequest('POST', `/workspaces/${workspaceId}/api-keys`, {
      headers: getAuthHeaders(sessionToken),
      body: { name: 'API Key to Delete', permissions: ['read'] },
    });
    expect(createResponse.status).toBe(201);
    const createData = await createResponse.json();
    const keyId = createData.data.id;

    const deleteResponse = await apiRequest('DELETE', `/workspaces/${workspaceId}/api-keys/${keyId}`, {
      headers: getAuthHeaders(sessionToken),
    });
    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.ok).toBe(true);
    expect(deleteData.data.id).toBe(keyId);
    expect(deleteData.data.revoked).toBe(true);
  });

  test('API key endpoints return 401 without session', async () => {
    const response = await apiRequest('POST', `/workspaces/${workspaceId}/api-keys`, {
      body: { name: 'test', permissions: ['read'] },
    });
    expect(response.status).toBe(401);
  });
});
