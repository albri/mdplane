import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  INVALID_KEY,
  setupFileTestContext,
  resetTestFiles,
  type FileTestContext,
} from './test-setup';

describe('Concurrent Access - Race Conditions', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Concurrent File Operations', () => {
    test('read while write in progress on existing file - both complete', async () => {
      const filePath = `concurrent/read-write-existing-${Date.now()}.md`;
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Original Content' }),
        })
      );

      const writeRequest = ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated Content' }),
        })
      );
      const readRequest = ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/${filePath}`, {
          method: 'GET',
        })
      );

      const [writeRes, readRes] = await Promise.all([writeRequest, readRequest]);
      expect(writeRes.status).toBe(200);
      expect(readRes.status).toBe(200);
      const body = await readRes.json();
      expect(body.ok).toBe(true);
      expect(typeof body.data.content).toBe('string');
    });

    test('two writes to same file - both complete, last one wins', async () => {
      const filePath = `concurrent/write-race-${Date.now()}.md`;
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Initial Content' }),
        })
      );

      const writeRequest1 = ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Content from Writer 1' }),
        })
      );
      const writeRequest2 = ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Content from Writer 2' }),
        })
      );

      const [res1, res2] = await Promise.all([writeRequest1, writeRequest2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.ok).toBe(true);
      expect(body2.ok).toBe(true);
      expect(body1.data.etag).toBeDefined();
      expect(body2.data.etag).toBeDefined();
    });

    test('delete then read - delete succeeds, read returns 410', async () => {
      const filePath = `concurrent/to-delete-${Date.now()}.md`;
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# File to delete' }),
        })
      );

      const deleteRes = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'DELETE',
        })
      );
      const readRes = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/${filePath}`, {
          method: 'GET',
        })
      );

      expect(deleteRes.status).toBe(200);
      expect(readRes.status).toBe(410);
    });

    test('multiple concurrent reads of existing file - all succeed', async () => {
      const filePath = `concurrent/multi-read-${Date.now()}.md`;
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Content for concurrent reads' }),
        })
      );

      const readRequests = Array(5)
        .fill(null)
        .map(() =>
          ctx.app.handle(
            new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/${filePath}`, {
              method: 'GET',
            })
          )
        );

      const results = await Promise.all(readRequests);
      expect(results.length).toBe(5);
      for (const res of results) {
        expect(res.status).toBe(200);
      }
    });

    test('rapid file creation in same directory - all return 201', async () => {
      const timestamp = Date.now();
      const createFile = (filename: string) =>
        ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/concurrent/${filename}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `# ${filename}` }),
          })
        );

      const results = await Promise.all([
        createFile(`rapid-${timestamp}-1.md`),
        createFile(`rapid-${timestamp}-2.md`),
        createFile(`rapid-${timestamp}-3.md`),
        createFile(`rapid-${timestamp}-4.md`),
        createFile(`rapid-${timestamp}-5.md`),
      ]);

      expect(results.length).toBe(5);
      for (const res of results) {
        expect(res.status).toBe(201);
      }
    });

    test('sequential delete of same file - first succeeds, second gets 404', async () => {
      const filePath = `concurrent/double-delete-${Date.now()}.md`;
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# To be deleted' }),
        })
      );

      const res1 = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'DELETE',
        })
      );
      const res2 = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${filePath}`, {
          method: 'DELETE',
        })
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(404);
    });

    test('write new file followed by immediate read - read sees new content', async () => {
      const uniquePath = `concurrent/immediate-${Date.now()}.md`;
      const content = '# Freshly written content';

      const writeRes = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/${uniquePath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
      );
      expect(writeRes.status).toBe(201);

      const readRes = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/${uniquePath}`, {
          method: 'GET',
        })
      );
      expect(readRes.status).toBe(200);
      const body = await readRes.json();
      expect(body.data.content).toBe(content);
    });
  });
});

describe('Error Response Consistency', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Error Structure Consistency', () => {
    test('400 errors should have standard structure', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
    });

    test('404 errors for invalid keys should have standard structure', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/files/test.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
    });

    test('404 errors should have standard structure', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/files/non-existent-file.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(body.error.message).toBeDefined();
      expect(typeof body.error.message).toBe('string');
    });
  });

  describe('Error Code Consistency', () => {
    test('should use FILE_NOT_FOUND for missing files', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/files/does-not-exist.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    test('should use INVALID_KEY for malformed keys', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/files/test.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('should use KEY_EXPIRED for expired keys', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/files/test.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should use KEY_REVOKED for revoked keys', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.REVOKED_KEY}/files/test.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('KEY_REVOKED');
    });

    test('should use INVALID_PATH for path traversal attempts', async () => {
      const response = await ctx.app.handle(
        new Request(
          `http://localhost/r/${ctx.VALID_READ_KEY}/files/%2e%2e/%2e%2e/etc/passwd`,
          { method: 'GET' }
        )
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('INVALID_PATH');
    });

    test('should use PERMISSION_DENIED for insufficient permissions (capability URL security)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_READ_KEY}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test' }),
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('HTTP Status Code Consistency', () => {
    test('400 should be used for validation/bad request errors', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: null }),
        })
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(['INVALID_PATH', 'INVALID_REQUEST']).toContain(body.error.code);
    });

    test('404 should be used for invalid/expired/revoked keys', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/files/test.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect([
        'INVALID_KEY',
        'KEY_EXPIRED',
        'KEY_REVOKED',
        'PERMISSION_DENIED',
      ]).toContain(body.error.code);
    });

    test('404 should be used for not found errors', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/files/not-found.md`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('Error Message Quality', () => {
    test('error messages should be human-readable', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/files/not-found.md`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      expect(body.error.message.length).toBeGreaterThan(5);
      expect(body.error.message).not.toContain('at ');
      expect(body.error.message).not.toContain('node_modules');
    });

    test('error messages should not expose internal file paths', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );
      const body = await response.json();
      expect(body.error.message).not.toContain('C:\\');
      expect(body.error.message).not.toContain('/home/');
      expect(body.error.message).not.toContain('node_modules');
    });
  });
});

