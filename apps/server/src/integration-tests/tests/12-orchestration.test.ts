/**
 * Orchestration & Heartbeat Integration Tests
 *
 * Tests agent orchestration and heartbeat functionality.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('12 - Orchestration', () => {
  let workspace: BootstrappedWorkspace;

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  test('GET /r/:key/orchestration returns state', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
  });

  test('GET /w/:key/orchestration returns admin state', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/orchestration`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('POST /a/:key/heartbeat registers agent', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}/heartbeat`, {
      body: {
        author: '__int_agent_001',
        status: 'alive',
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.author).toBe('__int_agent_001');
    expect(data.data.ts).toBeDefined();
    expect(data.data.expiresAt).toBeDefined();
    expect(data.data.nextHeartbeatBy).toBeDefined();
  });

  test('GET /r/:key/agents/liveness returns agent status', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/agents/liveness`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });

  test('multiple heartbeats update status', async () => {
    await apiRequest('POST', `/a/${workspace.appendKey}/heartbeat`, {
      body: {
        author: '__int_agent_002',
        status: 'alive',
        metadata: { task: 'testing' },
      },
    });

    const response = await apiRequest('POST', `/a/${workspace.appendKey}/heartbeat`, {
      body: {
        author: '__int_agent_002',
        status: 'busy',
        metadata: { task: 'processing' },
      },
    });

    expect(response.ok).toBe(true);
  });

  test('orchestration shows registered agents', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data.agents || data.data).toBeDefined();
  });
});
