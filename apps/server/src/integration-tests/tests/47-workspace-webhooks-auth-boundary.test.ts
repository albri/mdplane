import { beforeAll, describe, expect, test } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';
import { createTestWorkspaceWithKeys, linkUserToWorkspace } from '../fixtures/workspaces';

describe('47 - Workspace Webhooks Auth Boundary', () => {
  let workspaceId: string;
  let ownerSessionToken: string;
  let outsiderSessionToken: string;

  beforeAll(async () => {
    const owner = await createUserWithSession('workspace-webhooks-owner@integration.test');
    ownerSessionToken = owner.sessionToken;

    const outsider = await createUserWithSession('workspace-webhooks-outsider@integration.test');
    outsiderSessionToken = outsider.sessionToken;

    const workspace = await createTestWorkspaceWithKeys({
      claimed: true,
      claimedByEmail: 'workspace-webhooks-owner@integration.test',
    });
    workspaceId = workspace.id;

    await linkUserToWorkspace({
      userId: owner.userId,
      workspaceId,
    });
  });

  test('GET /workspaces/:workspaceId/webhooks returns 401 without session', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/webhooks`);
    expect(response.status).toBe(401);
  });

  test('GET /workspaces/:workspaceId/webhooks returns 404 for non-owner session', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/webhooks`, {
      headers: getAuthHeaders(outsiderSessionToken),
    });
    expect(response.status).toBe(404);
  });

  test('GET /workspaces/:workspaceId/webhooks returns 200 for workspace owner', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/webhooks`, {
      headers: getAuthHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /workspaces/:workspaceId/webhooks returns 404 for non-owner session', async () => {
    const response = await apiRequest('POST', `/workspaces/${workspaceId}/webhooks`, {
      headers: getAuthHeaders(outsiderSessionToken),
      body: {
        url: `https://example.com/non-owner-denied-${Date.now()}`,
        events: ['file.created'],
      },
    });
    expect(response.status).toBe(404);
  });

  test('owner can create, update, test and delete workspace webhook', async () => {
    const createResponse = await apiRequest('POST', `/workspaces/${workspaceId}/webhooks`, {
      headers: getAuthHeaders(ownerSessionToken),
      body: {
        url: `https://example.com/workspace-webhook-${Date.now()}`,
        events: ['file.created', 'task.completed'],
      },
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.ok).toBe(true);
    expect(created.data.id).toMatch(/^wh_/);
    const webhookId = created.data.id as string;

    const updateResponse = await apiRequest('PATCH', `/workspaces/${workspaceId}/webhooks/${webhookId}`, {
      headers: getAuthHeaders(ownerSessionToken),
      body: {
        active: false,
      },
    });
    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.ok).toBe(true);
    expect(updated.data.status).toBe('paused');

    const testResponse = await apiRequest('POST', `/workspaces/${workspaceId}/webhooks/${webhookId}/test`, {
      headers: getAuthHeaders(ownerSessionToken),
      body: { event: 'file.created' },
    });
    expect(testResponse.status).toBe(200);
    const tested = await testResponse.json();
    expect(tested.ok).toBe(true);
    expect(typeof tested.data.delivered).toBe('boolean');

    const deleteResponse = await apiRequest('DELETE', `/workspaces/${workspaceId}/webhooks/${webhookId}`, {
      headers: getAuthHeaders(ownerSessionToken),
    });
    expect(deleteResponse.status).toBe(200);
    const deleted = await deleteResponse.json();
    expect(deleted.ok).toBe(true);
    expect(deleted.data.deleted).toBe(true);
  });

});
