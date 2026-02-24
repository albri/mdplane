import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  assertValidResponse,
  INVALID_KEY,
  setupFileTestContext,
  resetTestFiles,
  createTestFile,
  createFileScopedKey,
  type FileTestContext,
} from './test-setup';

describe('File Lifecycle Operations', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('File Rename', () => {
    describe('PATCH /w/:key', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'renamed.md' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for read key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'renamed.md' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'renamed.md' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 400 for missing filename', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for empty filename', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: '' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for whitespace-only filename', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: '   ' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 200 and rename file successfully', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'new-name.md' }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.filename).toBe('new-name.md');
      });

      test('should match RenameFileResponse schema', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'schema-test.md' }),
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'RenameFileResponse');
        }
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'renamed.md' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'renamed.md' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });

  describe('File Recover', () => {
    describe('POST /w/:key/recover', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for read key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for non-deleted file', async () => {
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/path/to/file.md');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      test('should return 200 and recover deleted file', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/recover-test-file.md', '# File to recover');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/recover-test-file.md');
        const deleteResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/recover-test-file.md`, {
            method: 'DELETE',
          })
        );
        expect(deleteResponse.status).toBe(200);

        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.recovered).toBe(true);
        expect(body.data.path).toBe('/recover-test-file.md');
        expect(body.data.urls).toBeDefined();
        expect(body.data.urls.read).toBeDefined();
        expect(body.data.urls.append).toBeDefined();
        expect(body.data.urls.write).toBeDefined();
        expect(body.data.webUrl).toBeDefined();
      });

      test('should match FileRecoverResponse schema', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/recover-schema-test.md', '# Schema test');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/recover-schema-test.md');
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/recover-schema-test.md`, {
            method: 'DELETE',
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/recover`, {
            method: 'POST',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileRecoverResponse');
        }
      });

      test('should return 200 and recover with rotateUrls=true', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/recover-rotate-test.md', '# Rotate test');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/recover-rotate-test.md');
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/recover-rotate-test.md`, {
            method: 'DELETE',
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/recover?rotateUrls=true`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.recovered).toBe(true);
        expect(body.data.urls.read).toBeDefined();
        expect(body.data.urls.append).toBeDefined();
        expect(body.data.urls.write).toBeDefined();
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/recover`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });

  describe('File Move', () => {
    describe('POST /w/:key/move', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for read key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 400 for missing source', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/folder' }),
          })
        );
        expect(response.status).toBe(400);
      });

      test('should return 400 for missing destination', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md' }),
          })
        );
        expect(response.status).toBe(400);
      });

      test('should return 404 for non-existent source file', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/non-existent-file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      test('should return 200 and move file successfully', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/move-test-file.md', '# File to move');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/move-test-file.md', destination: '/moved-folder' }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.previousPath).toBe('/move-test-file.md');
        expect(body.data.newPath).toBe('/moved-folder/move-test-file.md');
        expect(body.data.webUrl).toBeDefined();
      });

      test('should match FileMoveResponse schema', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/move-schema-test.md', '# Schema test');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/move-schema-test.md', destination: '/schema-folder' }),
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileMoveResponse');
        }
      });

      test('should return 409 for conflict at destination', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/move-conflict-source.md', '# Source');
        await createTestFile(ctx.app, ctx.testWorkspace, '/conflict-folder/move-conflict-source.md', '# Conflict');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/move-conflict-source.md', destination: '/conflict-folder' }),
          })
        );
        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('CONFLICT');
      });

      test('should support idempotency via Idempotency-Key header', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/idempotent-move.md', '# Idempotent');
        const idempotencyKey = 'test-idempotency-key-' + Date.now();
        const response1 = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({ source: '/idempotent-move.md', destination: '/idempotent-folder' }),
          })
        );
        expect(response1.status).toBe(200);
        const body1 = await response1.json();

        const response2 = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({ source: '/idempotent-move.md', destination: '/idempotent-folder' }),
          })
        );
        expect(response2.status).toBe(200);
        expect(response2.headers.get('Idempotency-Replayed')).toBe('true');
        const body2 = await response2.json();
        expect(body2.data.id).toBe(body1.data.id);
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: '/file.md', destination: '/folder' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });

  describe('File Rotate URLs', () => {
    describe('POST /w/:key/rotate', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for read key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 404 for append key (capability URL security)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_APPEND_KEY}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });

      test('should return 200 and rotate URLs successfully', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/rotate-test-file.md', '# File to rotate');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/rotate-test-file.md');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.urls).toBeDefined();
        expect(body.data.urls.read).toBeDefined();
        expect(body.data.urls.append).toBeDefined();
        expect(body.data.urls.write).toBeDefined();
        expect(body.data.webUrl).toBeDefined();
        expect(body.data.previousUrlsInvalidated).toBe(true);
      });

      test('should match RotateCapabilityUrlsResponse schema', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/rotate-schema-test.md', '# Schema test');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/rotate-schema-test.md');
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/rotate`, {
            method: 'POST',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'RotateCapabilityUrlsResponse');
        }
      });

      test('should invalidate old URLs after rotation', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/old-url-test.md', '# Old URL test');
        const oldReadKey = createFileScopedKey(ctx.testWorkspace, 'read', '/old-url-test.md');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/old-url-test.md');
        const preRotateResponse = await ctx.app.handle(
          new Request(`http://localhost/r/${oldReadKey}/old-url-test.md`, {
            method: 'GET',
          })
        );
        expect(preRotateResponse.status).toBe(200);

        const rotateResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/rotate`, {
            method: 'POST',
          })
        );
        expect(rotateResponse.status).toBe(200);

        const readResponse = await ctx.app.handle(
          new Request(`http://localhost/r/${oldReadKey}/old-url-test.md`, {
            method: 'GET',
          })
        );
        expect(readResponse.status).toBe(404);
        const readBody = await readResponse.json();
        expect(readBody.error.code).toBe('KEY_REVOKED');
      });

      test('should return 410 for deleted file', async () => {
        await createTestFile(ctx.app, ctx.testWorkspace, '/deleted-for-rotate.md', '# Deleted file');
        const fileScopedWriteKey = createFileScopedKey(ctx.testWorkspace, 'write', '/deleted-for-rotate.md');
        const deleteResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/deleted-for-rotate.md`, {
            method: 'DELETE',
          })
        );
        expect(deleteResponse.status).toBe(200);

        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${fileScopedWriteKey}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(410);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/rotate`, {
            method: 'POST',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });
});

