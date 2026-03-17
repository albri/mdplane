/**
 * Workspace Storage Quota Tests
 *
 * Tests for per-workspace storage quota enforcement.
 * Default quota: 100MB per workspace.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { filesRoute } from '../../files';
import { bootstrapRoute } from '../../bootstrap';
import { db } from '../../../db';
import { workspaces, files, capabilityKeys, appends, auditLogs } from '../../../db/schema';
import { eq, sql, like, inArray } from 'drizzle-orm';
import { generateKey, hashKey } from '../../../core/capability-keys';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

describe('Workspace Storage Quota', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;
  let testWorkspaceId: string;
  let testWriteKey: string;

  beforeAll(() => {
    app = new Elysia().use(bootstrapRoute).use(filesRoute);
  });

  beforeEach(async () => {
    // Create a fresh workspace for each test
    testWorkspaceId = `ws_quota_test_${Date.now()}`;
    testWriteKey = generateKey();
    const keyHash = hashKey(testWriteKey);

    await db.insert(workspaces).values({
      id: testWorkspaceId,
      name: 'Quota Test Workspace',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    });

    await db.insert(capabilityKeys).values({
      id: `key_${Date.now()}`,
      workspaceId: testWorkspaceId,
      prefix: 'w',
      keyHash,
      permission: 'write',
      scopeType: 'workspace',
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Clean up test workspaces - delete in FK order (children before parents)
    // First get file IDs to delete their appends
    const testFiles = await db.select({ id: files.id }).from(files).where(like(files.workspaceId, 'ws_quota_test_%'));
    const fileIds = testFiles.map(f => f.id);
    if (fileIds.length > 0) {
      await db.delete(appends).where(inArray(appends.fileId, fileIds));
    }
    await db.delete(files).where(like(files.workspaceId, 'ws_quota_test_%'));
    await db.delete(auditLogs).where(like(auditLogs.workspaceId, 'ws_quota_test_%'));
    await db.delete(capabilityKeys).where(like(capabilityKeys.workspaceId, 'ws_quota_test_%'));
    await db.delete(workspaces).where(like(workspaces.id, 'ws_quota_test_%'));
  });

  describe('Quota Enforcement', () => {
    // Default quota: 100MB per workspace
    test('allows file upload within quota', async () => {
      const smallContent = 'Small file content';

      const response = await app.handle(
        new Request(`http://localhost/w/${testWriteKey}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: smallContent }),
        })
      );

      expect(response.status).toBe(201);
    });

    test('rejects file upload that exceeds quota', async () => {
      // First, insert files that use up most of the quota (simulate near-full)
      // Default quota is 100MB, so we'll test with a smaller quota for speed
      const originalQuota = process.env.MAX_WORKSPACE_STORAGE_BYTES;
      process.env.MAX_WORKSPACE_STORAGE_BYTES = '1000'; // 1KB for testing

      try {
        // First file should succeed
        const response1 = await app.handle(
          new Request(`http://localhost/w/${testWriteKey}/file1.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'A'.repeat(500) }), // 500 bytes
          })
        );
        expect(response1.status).toBe(201);

        // Second file that would exceed quota should fail
        const response2 = await app.handle(
          new Request(`http://localhost/w/${testWriteKey}/file2.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'B'.repeat(600) }), // 600 bytes - would exceed 1KB
          })
        );

        expect(response2.status).toBe(413);
        const data = await response2.json();
        assertValidResponse(data, 'Error');
        expect(data.ok).toBe(false);
        expect(data.error.code).toBe('QUOTA_EXCEEDED');
      } finally {
        if (originalQuota) {
          process.env.MAX_WORKSPACE_STORAGE_BYTES = originalQuota;
        } else {
          delete process.env.MAX_WORKSPACE_STORAGE_BYTES;
        }
      }
    });

    test('allows update that stays within quota', async () => {
      // Create a file
      await app.handle(
        new Request(`http://localhost/w/${testWriteKey}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Original content' }),
        })
      );

      // Update with larger content (but still within quota)
      const response = await app.handle(
        new Request(`http://localhost/w/${testWriteKey}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated content that is a bit longer' }),
        })
      );

      expect(response.status).toBe(200);
    });

    test('returns quota info in error message', async () => {
      process.env.MAX_WORKSPACE_STORAGE_BYTES = '100'; // 100 bytes

      try {
        const response = await app.handle(
          new Request(`http://localhost/w/${testWriteKey}/large.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'A'.repeat(200) }), // 200 bytes
          })
        );

        expect(response.status).toBe(413);
        const data = await response.json();
        expect(data.error.message).toContain('quota');
      } finally {
        delete process.env.MAX_WORKSPACE_STORAGE_BYTES;
      }
    });
  });
});
