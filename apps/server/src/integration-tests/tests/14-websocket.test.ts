/**
 * WebSocket Subscription Integration Tests
 *
 * Note: Full WebSocket connection testing requires WebSocket support.
 * These tests focus on the HTTP endpoints for subscription tokens.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';

describe('14 - WebSocket Subscriptions', () => {
  let workspace: BootstrappedWorkspace;

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  test('GET /r/:key/ops/subscribe returns token', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.wsUrl).toBeDefined();
    expect(data.data.expiresAt).toBeDefined();
    expect(data.data.events).toBeDefined();
    expect(data.data.keyTier).toBe('read');
  });

  test('GET /a/:key/ops/subscribe returns token', async () => {
    const response = await apiRequest('GET', `/a/${workspace.appendKey}/ops/subscribe`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.keyTier).toBe('append');
  });

  test('GET /w/:key/ops/subscribe returns token', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/ops/subscribe`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.keyTier).toBe('write');
  });

  test('GET /a/:key/ops/folders/subscribe returns scoped token', async () => {
    const response = await apiRequest('GET', `/a/${workspace.appendKey}/ops/folders/subscribe?path=docs`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.keyTier).toBe('append');
  });

  test('GET /w/:key/ops/folders/subscribe returns scoped token', async () => {
    const response = await apiRequest('GET', `/w/${workspace.writeKey}/ops/folders/subscribe?path=docs`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(data.data.keyTier).toBe('write');
  });

  test('subscribe with invalid key returns error', async () => {
    const response = await apiRequest('GET', `/r/invalid_key_12345/ops/subscribe`);

    expect(response.status).toBe(404);
  });

  test('subscribe token has connection info', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
    const data = await response.json();

    expect(data.data.token).toBeDefined();
    expect(data.data.wsUrl).toMatch(/^wss?:\/\//);
    expect(Array.isArray(data.data.events)).toBe(true);
  });
});

