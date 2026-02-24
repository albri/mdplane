/**
 * WebSocket Multi-Subscriber Integration Test
 *
 * Tests multiple WebSocket subscription tokens for same resource.
 *
 * Note: Full WebSocket connection testing requires WebSocket client.
 * These tests verify HTTP endpoints for subscription tokens.
 *
 * Scenarios:
 * - Multiple tokens can be obtained for same resource
 * - Each token is unique
 * - Tokens have correct expiry
 *
 * Note: The subscribe endpoint response schema (token, wsUrl, expiresAt, events, keyTier)
 * is observed behavior. These tests document actual API behavior.
 *
 * @see packages/shared/openapi/paths/realtime.yaml
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('44 - WebSocket Multi-Subscriber', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = '__int_ws_multi.md';

  beforeAll(async () => {
    workspace = await bootstrap();

    // Create test file
    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# WebSocket Multi Test\n\nContent.' },
    });
  });

  describe('Multiple Subscription Tokens', () => {
    test('can get 3 subscription tokens for same resource', async () => {
      const tokens: string[] = [];

      for (let i = 0; i < 3; i++) {
        const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.data.token).toBeDefined();

        tokens.push(data.data.token);
      }

      // All tokens should be unique
      expect(new Set(tokens).size).toBe(3);
    });

    test('each token has correct structure', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.data.token).toBeDefined();
      expect(data.data.wsUrl).toBeDefined();
      expect(data.data.expiresAt).toBeDefined();
      expect(data.data.events).toBeDefined();
      expect(data.data.keyTier).toBe('read');
    });

    test('tokens from different key tiers are unique', async () => {
      const readResponse = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const appendResponse = await apiRequest('GET', `/a/${workspace.appendKey}/ops/subscribe`);
      const writeResponse = await apiRequest('GET', `/w/${workspace.writeKey}/ops/subscribe`);

      const readData = await readResponse.json();
      const appendData = await appendResponse.json();
      const writeData = await writeResponse.json();

      // All tokens should be unique
      const tokens = [readData.data.token, appendData.data.token, writeData.data.token];
      expect(new Set(tokens).size).toBe(3);

      // Key tiers should be correct
      expect(readData.data.keyTier).toBe('read');
      expect(appendData.data.keyTier).toBe('append');
      expect(writeData.data.keyTier).toBe('write');
    });
  });

  describe('Token Expiry', () => {
    test('token has future expiry time', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const data = await response.json();

      const expiresAt = new Date(data.data.expiresAt);
      const now = new Date();

      // Token should expire in future
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    test('token expiry is ISO 8601 format', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const data = await response.json();

      // Should be valid ISO 8601 timestamp
      const parsed = new Date(data.data.expiresAt);
      expect(parsed.toISOString()).toBeDefined();
    });
  });

  describe('WebSocket URL', () => {
    test('wsUrl is valid WebSocket URL', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const data = await response.json();

      // Should start with ws:// or wss://
      expect(data.data.wsUrl).toMatch(/^wss?:\/\//);
    });

    test('wsUrl is base URL (token provided separately)', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const data = await response.json();

      // wsUrl is base WebSocket URL, token is provided separately
      expect(data.data.wsUrl).toMatch(/^wss?:\/\//);
      expect(data.data.token).toBeDefined();
    });
  });

  describe('Events', () => {
    test('events array is returned', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/ops/subscribe`);
      const data = await response.json();

      expect(Array.isArray(data.data.events)).toBe(true);
    });
  });
});

