/**
 * Permission Scenarios Integration Test
 *
 * Tests capability URL permission enforcement.
 * Reference: apps/server/tests/scenarios/permission-scenarios.test.ts
 *
 * Use Cases Covered:
 * - Share with read-only access
 * - Share with append-only access
 * - Share with full edit access
 *
 * Permission Model:
 * - Read key (/r/): Can only read files
 * - Append key (/a/): Can read + append
 * - Write key (/w/): Can read + append + update + delete
 *
 * Security Note: Permission errors return 404 (not 403) to prevent key enumeration.
 *
 * @see packages/shared/openapi/paths/files.yaml
 * @see packages/shared/openapi/paths/appends.yaml
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('39 - Permission Scenarios', () => {
  let workspace: BootstrappedWorkspace;
  const testFile = '__int_permissions.md';

  beforeAll(async () => {
    workspace = await bootstrap();

    // Create test file
    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
      body: { content: '# Permission Test\n\nInitial content.' },
    });
  });

  describe('Read-Only Access', () => {
    test('read key can GET file content', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('Permission Test');
    });

    test('read key cannot POST append (returns 404)', async () => {
      // Using read key at /a/ endpoint should fail
      const response = await apiRequest('POST', `/a/${workspace.readKey}/${testFile}`, {
        body: {
          type: 'comment',
          author: 'test',
          content: 'Should fail',
        },
      });

      // 404 to prevent key enumeration
      expect(response.status).toBe(404);
    });

    test('read key cannot PUT (update) file (returns 404)', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.readKey}/${testFile}`, {
        body: { content: '# Should fail' },
      });

      expect(response.status).toBe(404);
    });

    test('read key cannot DELETE file (returns 404)', async () => {
      const response = await apiRequest('DELETE', `/w/${workspace.readKey}/${testFile}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Append-Only Access', () => {
    test('append key can GET file via /r/ (inherits read)', async () => {
      const response = await apiRequest('GET', `/r/${workspace.appendKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('Permission Test');
    });

    test('append key can POST append', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testFile}`, {
        body: {
          type: 'comment',
          author: 'int-test',
          content: 'Append from append key',
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toMatch(/^a\d+$/);
    });

    test('append key cannot PUT (overwrite) file (returns 404)', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.appendKey}/${testFile}`, {
        body: { content: '# Should fail' },
      });

      expect(response.status).toBe(404);
    });

    test('append key cannot DELETE file (returns 404)', async () => {
      const response = await apiRequest('DELETE', `/w/${workspace.appendKey}/${testFile}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Full Edit Access', () => {
    test('write key can GET file via /r/', async () => {
      const response = await apiRequest('GET', `/r/${workspace.writeKey}/${testFile}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    test('write key can POST append via /a/', async () => {
      const response = await apiRequest('POST', `/a/${workspace.writeKey}/${testFile}`, {
        body: {
          type: 'comment',
          author: 'int-test',
          content: 'Append from write key',
        },
      });

      expect(response.status).toBe(201);
    });

    test('write key can PUT (update) file', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testFile}`, {
        body: { content: '# Updated Content\n\nModified by write key.' },
      });

      expect(response.status).toBe(200);
    });

    test('write key can DELETE file', async () => {
      // Create a file to delete
      await apiRequest('PUT', `/w/${workspace.writeKey}/__int_delete_perm.md`, {
        body: { content: '# Delete Me' },
      });

      const response = await apiRequest('DELETE', `/w/${workspace.writeKey}/__int_delete_perm.md`);

      expect(response.status).toBe(200);
    });
  });
});

