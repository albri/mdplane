import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  db,
  sqlite,
  files,
  eq,
  and,
  assertValidResponse,
  INVALID_KEY,
  setupFileTestContext,
  resetTestFiles,
  createTestFile,
  type FileTestContext,
} from './test-setup';

describe('File Settings', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('GET /w/:key/settings', () => {
    test('should return 404 for invalid key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for read key (capability URL security)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 404 for append key (capability URL security)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 200 with settings for write key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data).toBe('object');
    });

    test('should return default settings if none set', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data).toBe('object');
    });

    test('should match GetFileSettingsResponse schema', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'GetFileSettingsResponse');
      }
    });

    test('should return 404 for expired key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should return 404 for revoked key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.REVOKED_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });

    test('should resolve settings from a non-deleted file for workspace-scoped keys', async () => {
      const fallbackFile = await createTestFile(ctx.app, ctx.testWorkspace, '/settings/fallback.md', '# Fallback');
      const nowIso = new Date().toISOString();
      sqlite.query(
        `UPDATE files SET deleted_at = ? WHERE workspace_id = ? AND id != ?`
      ).run(nowIso, ctx.testWorkspace.workspaceId, fallbackFile.id);
      const settingsJson = JSON.stringify({ wipLimit: 42, labels: ['fallback'] });
      sqlite.query(
        `UPDATE files SET settings = ?, deleted_at = NULL WHERE id = ?`
      ).run(settingsJson, fallbackFile.id);

      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.wipLimit).toBe(42);
      expect(body.data.labels).toEqual(['fallback']);
    });
  });

  describe('PATCH /w/:key/settings', () => {
    test('should return 404 for invalid key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${INVALID_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5 }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should return 404 for read key (capability URL security)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5 }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should return 404 for append key (capability URL security)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5 }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should update settings and return 200', async () => {
      const newSettings = {
        wipLimit: 10,
        claimDurationSeconds: 3600,
      };
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.wipLimit).toBe(10);
      expect(body.data.claimDurationSeconds).toBe(3600);
    });

    test('should match UpdateFileSettingsResponse schema', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 15 }),
        })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'UpdateFileSettingsResponse');
      }
    });

    test('should merge with existing settings (partial update)', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5, labels: ['bug', 'feature'] }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimDurationSeconds: 7200 }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.claimDurationSeconds).toBe(7200);
      expect(body.data.wipLimit).toBe(5);
      expect(body.data.labels).toEqual(['bug', 'feature']);
    });

    test('should validate settings schema', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 0 }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should validate claimDurationSeconds minimum value', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimDurationSeconds: 30 }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should validate allowedAppendTypes enum values', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowedAppendTypes: ['invalid_type'] }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    test('should accept valid allowedAppendTypes', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowedAppendTypes: ['task', 'comment'] }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.allowedAppendTypes).toEqual(['task', 'comment']);
    });

    test('should return 404 for expired key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5 }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should return 404 for revoked key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.REVOKED_KEY}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wipLimit: 5 }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });
  });
});
