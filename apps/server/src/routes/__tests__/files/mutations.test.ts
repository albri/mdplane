import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  db,
  files,
  eq,
  and,
  assertValidResponse,
  INVALID_KEY,
  ISO_TIMESTAMP_PATTERN,
  setupFileTestContext,
  resetTestFiles,
  type FileTestContext,
} from './test-setup';

describe('File Mutation Operations', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('PUT /w/:key/*path - Create/Update File', () => {
    describe('Create New File', () => {
      test('should return 201 for new file creation', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# New Content' }),
          })
        );
        expect(response.status).toBe(201);

        const dbRecord = await db.query.files.findFirst({
          where: and(
            eq(files.workspaceId, ctx.testWorkspace.workspaceId),
            eq(files.path, '/new/file.md')
          ),
        });
        expect(dbRecord).toBeDefined();
        expect(dbRecord!.content).toBe('# New Content');
        expect(dbRecord!.deletedAt).toBeNull();
      });

      test('should return ok: true for new file', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# New Content' }),
          })
        );
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'FileUpdateResponse');
      });

      test('should return id in response', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# New Content' }),
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.data.id).toBeDefined();
        expect(typeof body.data.id).toBe('string');
      });

      test('should return etag for new file', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# New Content' }),
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.data.etag).toBeDefined();
        expect(typeof body.data.etag).toBe('string');
      });

      test('should return modified timestamp', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# New Content' }),
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.data.updatedAt).toBeDefined();
        expect(body.data.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should create parent folders implicitly', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/deep/nested/folder/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Nested Content' }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.data.id).toBeDefined();
        expect(body.ok).toBe(true);
      });

      test('should match FileUpdateResponse schema', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/schema-test.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Test' }),
          })
        );
        const body = await response.json();
        if (response.status === 201) {
          assertValidResponse(body, 'FileUpdateResponse');
        }
      });
    });

    describe('Update Existing File', () => {
      test('should return 200 when updating a file that was created earlier', async () => {
        const createResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# First Version' }),
          })
        );
        expect(createResponse.status).toBe(201);

        const updateResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Second Version' }),
          })
        );
        expect(updateResponse.status).toBe(200);
        const updateBody = await updateResponse.json();
        assertValidResponse(updateBody, 'FileUpdateResponse');
        expect(updateBody.ok).toBe(true);
      });

      test('should return 200 for existing file update', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/existing/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Updated Content' }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.ok).toBe(true);
        expect(body.data.id).toBeDefined();
        expect(body.data.etag).toBeDefined();
      });

      test('should return modified timestamp for update', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/existing/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Updated Content' }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FileUpdateResponse');
        expect(body.data.updatedAt).toBeDefined();
        expect(body.data.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });
    });

    describe('Validation - Create/Update', () => {
      test('should return 400 when content is missing', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for invalid JSON body', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: '{ invalid json }',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });

    describe('Permission Errors - Create/Update', () => {
      test('should return 404 for read-only key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Content' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append-only key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Content' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for invalid key format', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Content' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/new/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Content' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });
    });
  });

  describe('DELETE /w/:key/*path - Delete File', () => {
    describe('Successful Delete', () => {
      test('should return 200 on successful delete', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FileDeleteResponse');
      });

      test('should return ok: true on delete', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'FileDeleteResponse');
      });

      test('should return id in response', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileDeleteResponse');
        expect(body.data.id).toBeDefined();
        expect(typeof body.data.id).toBe('string');
      });

      test('should return deleted: true', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileDeleteResponse');
        expect(body.data.deleted).toBe(true);
      });

      test('should soft delete by default (sets deletedAt)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileDeleteResponse');
        expect(body.data.recoverable).toBe(true);
        if (body.data.expiresAt) {
          expect(body.data.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
        const dbRecord = await db.query.files.findFirst({
          where: and(
            eq(files.workspaceId, ctx.testWorkspace.workspaceId),
            eq(files.path, '/path/to/file.md')
          ),
        });
        expect(dbRecord).toBeDefined();
        expect(dbRecord!.deletedAt).not.toBeNull();
      });

      test('should match FileDeleteResponse schema', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/to-delete.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Delete me' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/to-delete.md`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileDeleteResponse');
        }
      });
    });

    describe('Error Cases - Delete', () => {
      test('should return 404 for non-existent file', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/non/existent/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      test('should return 404 for read-only key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append-only key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/path/to/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });

    describe('Permanent Delete (?permanent=true)', () => {
      test('should permanently delete file when permanent=true', async () => {
        const filePath = 'permanent-delete-test.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# To be permanently deleted' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FileDeleteResponse');
        expect(body.data.deleted).toBe(true);
        expect(body.data.recoverable).toBe(false);
      });

      test('should return recoverable=false for permanent delete', async () => {
        const filePath = 'permanent-delete-recoverable.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Permanent delete recoverable test' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
          })
        );
        const body = await response.json();
        expect(body.data.recoverable).toBe(false);
        expect(body.data.expiresAt).toBeUndefined();
      });

      test('should completely remove file from database on permanent delete', async () => {
        const filePath = 'permanent-delete-db-check.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# DB check test' }),
          })
        );
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
          })
        );
        const dbRecord = await db.query.files.findFirst({
          where: and(
            eq(files.workspaceId, ctx.testWorkspace.workspaceId),
            eq(files.path, `/${filePath}`)
          ),
        });
        expect(dbRecord).toBeUndefined();
      });

      test('permanent delete cannot be recovered', async () => {
        const filePath = 'permanent-no-recover.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Cannot recover' }),
          })
        );
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
          })
        );
        const recoverResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/recover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
        expect(recoverResponse.status).toBe(404);
        const recoverBody = await recoverResponse.json();
        expect(recoverBody.ok).toBe(false);
      });

      test('should return 404 for non-existent file with permanent=true', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/non-existent-file.md?permanent=true`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      test('soft delete vs permanent delete comparison', async () => {
        const softPath = 'soft-vs-permanent-soft.md';
        const permanentPath = 'soft-vs-permanent-hard.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${softPath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Soft delete' }),
          })
        );
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${permanentPath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Permanent delete' }),
          })
        );
        const softResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${softPath}`, {
            method: 'DELETE',
          })
        );
        const softBody = await softResponse.json();
        expect(softBody.data.recoverable).toBe(true);
        const permanentResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${permanentPath}?permanent=true`, {
            method: 'DELETE',
          })
        );
        const permanentBody = await permanentResponse.json();
        expect(permanentBody.data.recoverable).toBe(false);
        const softDbRecord = await db.query.files.findFirst({
          where: and(
            eq(files.workspaceId, ctx.testWorkspace.workspaceId),
            eq(files.path, `/${softPath}`)
          ),
        });
        expect(softDbRecord).toBeDefined();
        expect(softDbRecord!.deletedAt).not.toBeNull();
        const permanentDbRecord = await db.query.files.findFirst({
          where: and(
            eq(files.workspaceId, ctx.testWorkspace.workspaceId),
            eq(files.path, `/${permanentPath}`)
          ),
        });
        expect(permanentDbRecord).toBeUndefined();
      });

      test('permanent delete should support Idempotency-Key header', async () => {
        const filePath = 'permanent-idempotent.md';
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Idempotent delete' }),
          })
        );
        const idempotencyKey = `delete-${Date.now()}`;
        const firstResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
            headers: { 'Idempotency-Key': idempotencyKey },
          })
        );
        expect(firstResponse.status).toBe(200);
        const firstBody = await firstResponse.json();
        expect(firstBody.data.deleted).toBe(true);
        const retryResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}?permanent=true`, {
            method: 'DELETE',
            headers: { 'Idempotency-Key': idempotencyKey },
          })
        );
        expect(retryResponse.status).toBe(200);
        const retryBody = await retryResponse.json();
        expect(retryBody.data.deleted).toBe(true);
        expect(retryBody.data.id).toBe(firstBody.data.id);
      });
    });
  });
});

