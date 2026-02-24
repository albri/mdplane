import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { logAuditAction, flushAuditQueue, resetAuditServiceState } from '../fixtures/audit-service-fixtures';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';
import { generateScopedKey } from '../../../core/capability-keys';
import {
  resetAuditLogsForWorkspace,
  setupAuditWorkspaceAndKeys,
} from '../fixtures/audit-fixtures';

const INVALID_KEY = 'short';
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Audit Logs Route', () => {
  type TestApp = {
    handle: (request: Request) => Response | Promise<Response>;
  };

  let app: TestApp;
  const TEST_WORKSPACE_ID = 'ws_test_audit';
  const TEST_WRITE_KEY = generateScopedKey('write');
  const TEST_READ_KEY = generateScopedKey('read');

  beforeAll(async () => {
    const mod = await import('../../audit');
    app = new Elysia().use(mod.auditRoute);
    setupAuditWorkspaceAndKeys(TEST_WORKSPACE_ID, TEST_WRITE_KEY, TEST_READ_KEY);
  });

  beforeEach(() => {
    resetAuditServiceState();
    resetAuditLogsForWorkspace(TEST_WORKSPACE_ID);
  });

  describe('GET /w/:writeKey/audit', () => {
    describe('Successful Queries', () => {
      test('should return 200 with empty logs initially', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toEqual([]);
      });

      test('should return audit logs', async () => {
        logAuditAction({
          workspaceId: TEST_WORKSPACE_ID,
          action: 'file.create',
          resourceType: 'file',
          resourcePath: '/test.md',
          actor: 'test-agent',
          actorType: 'capability_url',
        });
        await flushAuditQueue();

        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.length).toBe(1);
        expect(body.data[0].action).toBe('file.create');
        expect(body.data[0].resourceType).toBe('file');
        expect(body.data[0].resourcePath).toBe('/test.md');
        expect(body.data[0].actor).toBe('test-agent');
        expect(body.data[0].actorType).toBe('capability_url');
        expect(body.data[0].createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
        assertValidResponse(body, 'GetAuditLogsResponse');
      });

      test('should return pagination info with cursor', async () => {
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
        await flushAuditQueue();

        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?limit=10`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.pagination).toBeDefined();
        expect(body.pagination.total).toBe(1);
        expect(body.pagination.limit).toBe(10);
        expect(body.pagination.hasMore).toBe(false);
        expect(body.pagination.cursor).toBeNull();
      });

      test('should support cursor-based pagination via API', async () => {
        for (let i = 0; i < 5; i++) {
          logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
          await flushAuditQueue();
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        const response1 = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?limit=2`, {
            method: 'GET',
          })
        );
        const body1 = await response1.json();
        expect(body1.data.length).toBe(2);
        expect(body1.pagination.hasMore).toBe(true);
        expect(body1.pagination.cursor).toBeTruthy();

        const response2 = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?limit=2&cursor=${encodeURIComponent(body1.pagination.cursor)}`, {
            method: 'GET',
          })
        );
        const body2 = await response2.json();
        expect(body2.data.length).toBe(2);
        expect(body2.pagination.hasMore).toBe(true);

        const page1Ids = body1.data.map((log: { id: string }) => log.id);
        const page2Ids = body2.data.map((log: { id: string }) => log.id);
        for (const id of page2Ids) {
          expect(page1Ids).not.toContain(id);
        }
      });
    });

    describe('Filtering', () => {
      test('should filter by action query parameter', async () => {
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file' });
        await flushAuditQueue();

        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?action=file.create`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.length).toBe(1);
        expect(body.data[0].action).toBe('file.create');
      });

      test('should filter by resourceType query parameter', async () => {
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file' });
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'key.create', resourceType: 'key' });
        await flushAuditQueue();

        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?resourceType=key`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.length).toBe(1);
        expect(body.data[0].resourceType).toBe('key');
      });

      test('should filter by actor query parameter', async () => {
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.create', resourceType: 'file', actor: 'agent-a' });
        logAuditAction({ workspaceId: TEST_WORKSPACE_ID, action: 'file.update', resourceType: 'file', actor: 'agent-b' });
        await flushAuditQueue();

        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?actor=agent-a`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.length).toBe(1);
        expect(body.data[0].actor).toBe('agent-a');
      });

      test('should return 400 for invalid action filter', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_WRITE_KEY}/audit?action=invalid.action`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });
    });

    describe('Permission Errors', () => {
      test('should return 404 for read-only key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${TEST_READ_KEY}/audit`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 404 for invalid key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/audit`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });
    });
  });
});

