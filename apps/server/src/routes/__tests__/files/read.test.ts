import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  createTestWorkspace,
  createTestFile,
  sqlite,
  assertValidResponse,
  INVALID_KEY,
  ISO_TIMESTAMP_PATTERN,
  setupFileTestContext,
  resetTestFiles,
  type FileTestContext,
} from './test-setup';

describe('File Read Operations', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('GET /r/:key/*path - Read File', () => {
    describe('Successful Read', () => {
      test('should return 200 with file content', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
      });

      test('should return ok: true in response', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'FileReadResponse');
      });

      test('should return filename in response', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileReadResponse');
        expect(body.data.filename).toBe('file.md');
      });

      test('should return file content as string', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileReadResponse');
        expect(body.data.content).toBeDefined();
        expect(typeof body.data.content).toBe('string');
      });

      test('should return parsed frontmatter object when format=parsed', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md?format=parsed`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileReadResponse');
        expect(body.data.frontmatter).toBeDefined();
        expect(typeof body.data.frontmatter).toBe('object');
      });

      test('should return created timestamp', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileReadResponse');
        expect(body.data.createdAt).toBeDefined();
        expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return modified timestamp', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        assertValidResponse(body, 'FileReadResponse');
        expect(body.data.updatedAt).toBeDefined();
        expect(body.data.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should match FileReadResponse schema', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileReadResponse');
        }
      });

      test('should return workspace context with id and claimed status', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        expect(body.data.workspace).toBeDefined();
        expect(body.data.workspace.id).toBeDefined();
        expect(body.data.workspace.id).toMatch(/^ws_[A-Za-z0-9]{12,}$/);
        expect(typeof body.data.workspace.claimed).toBe('boolean');
      });

      test('should return workspace.claimed as false for unclaimed workspace', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        expect(body.data.workspace).toBeDefined();
        expect(body.data.workspace.claimed).toBe(false);
      });

      test('should return workspace.claimed as true for claimed workspace', async () => {
        const claimedWorkspace = await createTestWorkspace(ctx.app);
        await createTestFile(ctx.app, claimedWorkspace, '/claimed-test.md', '# Claimed Test');
        sqlite.exec(`
          UPDATE workspaces
          SET claimed_at = '${new Date().toISOString()}',
              claimed_by_email = 'test@example.com'
          WHERE id = '${claimedWorkspace.workspaceId}'
        `);
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${claimedWorkspace.readKey}/claimed-test.md`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        expect(body.data.workspace).toBeDefined();
        expect(body.data.workspace.claimed).toBe(true);
      });

      test('should include workspace context in parsed format response', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md?format=parsed`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        expect(body.data.workspace).toBeDefined();
        expect(body.data.workspace.id).toBeDefined();
        expect(typeof body.data.workspace.claimed).toBe('boolean');
      });
    });

    describe('Error Cases - Read', () => {
      test('should return 404 for non-existent file', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/non/existent/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      test('should return 404 for invalid key format', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/path/to/file.md`, {
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
          new Request(`http://localhost/r/${ctx.REVOKED_KEY}/path/to/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });

    describe('Path Normalization - Read', () => {
      test('should normalize double slashes in path', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path//to//file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.filename).toBe('file.md');
      });

      test('should normalize trailing slashes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path/to/file.md/`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.filename).toBe('file.md');
      });

      test('should ensure filename is returned correctly', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.filename).toBe('file.md');
      });
    });
  });

  describe('GET /r/:key/raw - Read Raw File', () => {
    describe('Successful Raw Read', () => {
      test('should return 200 with raw markdown content', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/raw`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
      });

      test('should return Content-Type: text/markdown', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/raw`, {
            method: 'GET',
          })
        );
        const contentType = response.headers.get('Content-Type');
        expect(contentType).not.toBeNull();
        expect(contentType!).toContain('text/markdown');
      });

      test('should return ETag header', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/raw`, {
            method: 'GET',
          })
        );
        const etag = response.headers.get('ETag');
        expect(etag).not.toBeNull();
        expect(typeof etag).toBe('string');
        expect(etag!).toMatch(/^[a-f0-9]{16}$/);
      });

      test('should return raw string content (no JSON envelope)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/raw`, {
            method: 'GET',
          })
        );
        const text = await response.text();
        expect(text).toBeDefined();
        expect(typeof text).toBe('string');
      });
    });

    describe('Error Cases - Raw Read', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/raw`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/raw`, {
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
          new Request(`http://localhost/r/${ctx.REVOKED_KEY}/raw`, {
            method: 'GET',
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

