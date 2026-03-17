import { beforeAll, describe, expect, test } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createUserWithSession, getAuthHeaders } from '../helpers/mock-oauth';
import { createTestWorkspaceWithKeys, linkUserToWorkspace } from '../fixtures/workspaces';

describe('46 - Workspace Orchestration Auth Boundary', () => {
  let workspaceId: string;
  let writeKey: string;
  let appendKey: string;
  let ownerSessionToken: string;
  let nonMemberSessionToken: string;
  let apiKeyToken: string;
  let claimId: string;
  let otherWorkspaceId: string;

  beforeAll(async () => {
    const owner = await createUserWithSession('orch-owner@integration.test');
    const nonMember = await createUserWithSession('orch-non-member@integration.test');
    ownerSessionToken = owner.sessionToken;
    nonMemberSessionToken = nonMember.sessionToken;

    const workspace = await createTestWorkspaceWithKeys();
    workspaceId = workspace.id;
    writeKey = workspace.writeKey.plaintextKey;
    appendKey = workspace.appendKey.plaintextKey;
    await linkUserToWorkspace({ userId: owner.userId, workspaceId });

    const otherWorkspace = await createTestWorkspaceWithKeys();
    otherWorkspaceId = otherWorkspace.id;
    await linkUserToWorkspace({ userId: owner.userId, workspaceId: otherWorkspaceId });

    const filePath = '__int_control_orchestration.md';
    const createFile = await apiRequest('PUT', `/w/${writeKey}/${filePath}`, {
      body: { content: '# Control orchestration auth boundary test' },
    });
    expect(createFile.status).toBe(201);

    const taskRes = await apiRequest('POST', `/a/${appendKey}/${filePath}`, {
      body: {
        author: '__int_orchestrator',
        type: 'task',
        content: 'Task to generate claim for control-route mutation tests',
      },
    });
    expect(taskRes.status).toBe(201);
    const taskData = await taskRes.json();
    const taskId = taskData.data.id as string;

    const claimRes = await apiRequest('POST', `/a/${appendKey}/${filePath}`, {
      body: {
        author: '__int_orchestrator',
        type: 'claim',
        ref: taskId,
        expiresInSeconds: 300,
      },
    });
    expect(claimRes.status).toBe(201);
    const claimData = await claimRes.json();
    claimId = claimData.data.id as string;

    const apiKeyRes = await apiRequest('POST', `/workspaces/${workspaceId}/api-keys`, {
      headers: getAuthHeaders(ownerSessionToken),
      body: { name: 'Control Boundary Read Key', permissions: ['read'] },
    });
    expect(apiKeyRes.status).toBe(201);
    const apiKeyData = await apiKeyRes.json();
    apiKeyToken = apiKeyData.data.key as string;
  });

  test('GET /workspaces/:workspaceId/orchestration returns 401 without session', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/orchestration`);
    expect(response.status).toBe(401);
  });

  test('GET /workspaces/:workspaceId/orchestration returns 401 with API key auth only', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/orchestration`, {
      headers: { Authorization: `Bearer ${apiKeyToken}` },
    });
    expect(response.status).toBe(401);
  });

  test('GET /workspaces/:workspaceId/orchestration returns 404 for non-member session', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/orchestration`, {
      headers: getAuthHeaders(nonMemberSessionToken),
    });
    expect(response.status).toBe(404);
  });

  test('GET /workspaces/:workspaceId/orchestration returns 200 for workspace owner', async () => {
    const response = await apiRequest('GET', `/workspaces/${workspaceId}/orchestration`, {
      headers: getAuthHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.tasks).toBeDefined();
  });

  test('POST renew returns 401 without session', async () => {
    const response = await apiRequest(
      'POST',
      `/workspaces/${workspaceId}/orchestration/claims/${claimId}/renew`,
      {
        body: { expiresInSeconds: 600 },
      }
    );
    expect(response.status).toBe(401);
  });

  test('POST renew returns 401 with API key auth only', async () => {
    const response = await apiRequest(
      'POST',
      `/workspaces/${workspaceId}/orchestration/claims/${claimId}/renew`,
      {
        headers: { Authorization: `Bearer ${apiKeyToken}` },
        body: { expiresInSeconds: 600 },
      }
    );
    expect(response.status).toBe(401);
  });

  test('POST renew returns 404 for non-member session', async () => {
    const response = await apiRequest(
      'POST',
      `/workspaces/${workspaceId}/orchestration/claims/${claimId}/renew`,
      {
        headers: getAuthHeaders(nonMemberSessionToken),
        body: { expiresInSeconds: 600 },
      }
    );
    expect(response.status).toBe(404);
  });

  test('POST renew returns 404 when claim does not belong to workspace', async () => {
    const response = await apiRequest(
      'POST',
      `/workspaces/${otherWorkspaceId}/orchestration/claims/${claimId}/renew`,
      {
        headers: getAuthHeaders(ownerSessionToken),
        body: { expiresInSeconds: 600 },
      }
    );
    expect(response.status).toBe(404);
  });

  test('POST renew returns 200 for workspace owner', async () => {
    const response = await apiRequest(
      'POST',
      `/workspaces/${workspaceId}/orchestration/claims/${claimId}/renew`,
      {
        headers: getAuthHeaders(ownerSessionToken),
        body: { expiresInSeconds: 600 },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.claim).toBeDefined();
  });
});
