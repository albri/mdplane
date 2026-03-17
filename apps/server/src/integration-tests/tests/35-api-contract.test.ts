/**
 * API Contract Compliance Integration Test
 *
 * Tests that API responses match OpenAPI spec exactly.
 * Reference: apps/server/tests/scenarios/api-contract.test.ts
 *
 * Covered:
 * - Error response format: { ok: false, error: { code, message } }
 * - Success response format: { ok: true, data: { ... } }
 * - Content-Type headers
 * - ID format patterns (ws_, file_, a\d+)
 * - Timestamp format (ISO 8601)
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('35 - API Contract Compliance', () => {
  let workspace: BootstrappedWorkspace;
  const testPath = '__int_api_contract';

  beforeAll(async () => {
    workspace = await bootstrap();

    // Create a test file
    const createRes = await apiRequest('PUT', `/w/${workspace.writeKey}/${testPath}`, {
      body: { content: '# API Contract Test\n\n- [ ] Task 1' },
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create test file: ${createRes.status}`);
    }
  });

  afterAll(async () => {
    await apiRequest('DELETE', `/w/${workspace.writeKey}/${testPath}`);
  });

  describe('Error Response Format', () => {
    test('400 Bad Request has { ok: false, error: { code, message } }', async () => {
      // Empty body to append endpoint
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: {},
      });

      expect(response.status).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
    });

    test('404 Not Found has { ok: false, error: { code, message } }', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/__nonexistent_file_12345`);

      expect(response.status).toBe(404);
      const body = await response.json();

      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
      expect(body.error).toHaveProperty('message');
    });

    test('409 Conflict has { ok: false, error: { code, message } }', async () => {
      // Create a task and claim it
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'task', author: 'test-setup', content: 'Conflict test task' },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();
      const taskId = taskData.data.id;

      // First claim
      const claim1 = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskId, author: 'agent-1', expiresInSeconds: 300 },
      });
      expect(claim1.status).toBe(201);

      // Second claim should fail
      const claim2 = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskId, author: 'agent-2', expiresInSeconds: 300 },
      });

      expect(claim2.status).toBe(409);
      const body = await claim2.json();

      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('ALREADY_CLAIMED');
      expect(body.error).toHaveProperty('message');
    });

    test('error responses have Content-Type: application/json', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/__nonexistent_file_12345`);

      expect(response.status).toBe(404);
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/application\/json/);
    });
  });

  describe('Success Response Format', () => {
    test('200 OK has { ok: true, data: { ... } }', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testPath}`);

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    });

    test('201 Created has { ok: true, data: { ... } }', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'comment', author: 'test-user', content: 'Test comment' },
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    });

    test('success responses have Content-Type: application/json', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testPath}`);

      expect(response.status).toBe(200);
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toMatch(/application\/json/);
    });

    test('append responses include serverTime (per OpenAPI AppendResponse)', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'comment', author: 'test-user', content: 'serverTime test' },
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      // Per OpenAPI AppendResponse schema - serverTime is required
      expect(body).toHaveProperty('serverTime');
      // serverTime should be a valid ISO 8601 timestamp
      const serverTime = new Date(body.serverTime);
      expect(serverTime.getTime()).toBeLessThanOrEqual(Date.now() + 60000); // Within 1 minute
    });
  });

  describe('ID Format Patterns', () => {
    test('workspace IDs have ws_ prefix', async () => {
      // The workspace ID is in bootstrap response
      expect(workspace.workspaceId).toMatch(/^ws_/);
    });

    test('append IDs match pattern a\\d+', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'comment', author: 'test-user', content: 'ID format test' },
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      expect(body.data.id).toMatch(/^a\d+$/);
    });

    test('capability keys are 20+ alphanumeric characters', async () => {
      // Keys from bootstrap
      expect(workspace.readKey).toMatch(/^[A-Za-z0-9_]{20,}$/);
      expect(workspace.writeKey).toMatch(/^[A-Za-z0-9_]{20,}$/);
      expect(workspace.appendKey).toMatch(/^[A-Za-z0-9_]{20,}$/);
    });
  });

  describe('Timestamp Format', () => {
    test('timestamps are ISO 8601 format', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'comment', author: 'test-user', content: 'Timestamp test' },
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      // ts field should be ISO 8601
      expect(body.data.ts).toBeDefined();
      const ts = new Date(body.data.ts);
      expect(ts.getTime()).toBeGreaterThan(0);
      // Should be parseable and recent
      expect(ts.getTime()).toBeLessThanOrEqual(Date.now() + 60000);
    });

    test('expiresAt is ISO 8601 format for claims', async () => {
      // Create a task first
      const taskRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'task', author: 'test-setup', content: 'Timestamp claim test' },
      });
      expect(taskRes.status).toBe(201);
      const taskData = await taskRes.json();

      // Claim it
      const claimRes = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'claim', ref: taskData.data.id, author: 'agent-ts', expiresInSeconds: 300 },
      });

      expect(claimRes.status).toBe(201);
      const body = await claimRes.json();

      expect(body.data.expiresAt).toBeDefined();
      const expiresAt = new Date(body.data.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Required Fields', () => {
    test('file read response has required fields', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testPath}?format=parsed`);

      expect(response.status).toBe(200);
      const body = await response.json();

      // Per OpenAPI FileReadResponse - required: [ok, data]
      // data required: [id, filename, content, etag, createdAt, updatedAt, appendCount, size]
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.filename).toBeDefined();
      expect(body.data.content).toBeDefined();
      expect(body.data.etag).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.updatedAt).toBeDefined();
      expect(body.data.appendCount).toBeDefined();
      expect(body.data.size).toBeDefined();
    });

    test('append response has required fields', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPath}`, {
        body: { type: 'comment', author: 'test-user', content: 'Required fields test' },
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      // Per OpenAPI AppendResponse
      expect(body.ok).toBe(true);
      expect(body.serverTime).toBeDefined();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.type).toBe('comment');
      expect(body.data.author).toBe('test-user');
      expect(body.data.ts).toBeDefined();
    });
  });
});
