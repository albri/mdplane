/**
 * Security Edge Cases Integration Test
 *
 * Tests security protections.
 * Reference: apps/server/tests/scenarios/security-edge-cases.test.ts
 *
 * Security Areas Covered:
 * - Capability key validation (format, existence)
 * - Path traversal prevention
 * - Input validation
 * - Information leakage prevention
 *
 * Security Note: All security failures return 404 to prevent enumeration.
 *
 * @see docs/Architecture.md - Security section
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { CONFIG } from '../config';

describe('40 - Security Edge Cases', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = '__int_security.md';

  beforeAll(async () => {
    workspace = await bootstrap();

    // Create test file
    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# Security Test\n\nContent here.' },
    });
  });

  describe('Capability Key Security', () => {
    test('invalid key format returns 404', async () => {
      const invalidKeys = ['short', 'abc!@#$%^&*()', '', '   '];

      for (const invalidKey of invalidKeys) {
        const response = await apiRequest('GET', `/r/${encodeURIComponent(invalidKey)}/test.md`);
        expect(response.status).toBe(404);
      }
    });

    test('nonexistent key returns 404 (not 401/403)', async () => {
      // Valid format but doesn't exist
      const fakeKey = 'r8k2mP9qL3nR7mQ2pN4xYz5a';
      const response = await apiRequest('GET', `/r/${fakeKey}/test.md`);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('INVALID_KEY');
    });

    test('key from different workspace returns 404 for file', async () => {
      // Create another workspace
      const otherWorkspace = await bootstrap();

      // Try to access file from first workspace using second workspace's key
      const response = await apiRequest('GET', `/r/${otherWorkspace.readKey}/${testFile}`);

      // Should be 404 (file not found in that workspace)
      expect(response.status).toBe(404);
    });
  });

  describe('Path Traversal Prevention', () => {
    test('../ path traversal is blocked', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/../../../etc/passwd`);

      // Path traversal attempts return 400 Bad Request or 404 Not Found (both are secure)
      expect([400, 404]).toContain(response.status);
    });

    test('encoded %2e%2e%2f path traversal is blocked', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/%2e%2e%2f%2e%2e%2fetc/passwd`);

      // Path traversal attempts return 400 Bad Request or 404 Not Found (both are secure)
      expect([400, 404]).toContain(response.status);
    });

    test('null bytes in path are rejected', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/test%00.md`);

      // Invalid path characters return 400 Bad Request or 404 Not Found (both are secure)
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Input Validation', () => {
    test('empty content is allowed', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/__int_empty.md`, {
        body: { content: '' },
      });

      // Per OpenAPI spec: PUT creates (201) or updates (200) file
      // Since this is a new file, expect 201 Created
      expect(response.status).toBe(201);
    });

    test('missing required fields returns 400', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFile}`, {
        body: {
          // Missing required 'type' field
          author: 'test',
          content: 'Test',
        },
      });

      expect(response.status).toBe(400);
    });

    test('invalid JSON returns 400', async () => {
      const response = await fetch(`${CONFIG.TEST_API_URL}/w/${workspace.writeKey}/${testFile}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'not valid json{',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Information Leakage Prevention', () => {
    test('error responses do not expose internal paths', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/nonexistent.md`);

      expect(response.status).toBe(404);
      const data = await response.json();

      // Error message should not contain internal paths
      const errorStr = JSON.stringify(data);
      expect(errorStr).not.toContain('/var/');
      expect(errorStr).not.toContain('/home/');
      expect(errorStr).not.toContain('C:\\');
    });

    test('error responses do not expose stack traces', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/nonexistent.md`);

      const data = await response.json();
      const errorStr = JSON.stringify(data);

      // Should not contain stack trace indicators
      expect(errorStr).not.toContain('at ');
      expect(errorStr).not.toContain('.ts:');
      expect(errorStr).not.toContain('.js:');
    });
  });
});
