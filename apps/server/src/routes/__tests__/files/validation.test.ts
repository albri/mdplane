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
  type FileTestContext,
} from './test-setup';

describe('File Validation', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Path Validation', () => {
    describe('Directory Traversal Prevention', () => {
      test('should reject paths with ".." (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/../etc/passwd`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject paths with ".." (PUT)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/../etc/passwd`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'malicious' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject paths with ".." (DELETE)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/../etc/passwd`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject encoded ".." traversal attempts', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/%2e%2e/etc/passwd`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject mid-path ".." traversal', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/valid/path/../../../etc/passwd`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Null Byte Injection Prevention', () => {
      test('should reject paths with null bytes (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file%00.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject paths with null bytes (PUT)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/file%00.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'content' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject paths with null bytes (DELETE)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/file%00.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Slash Normalization', () => {
      test('should normalize leading slashes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}////file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).not.toBe(400);
        if (response.status === 404) {
          const body = await response.json();
          expect(body.ok).toBe(false);
          expect(body.error.code).toBe('FILE_NOT_FOUND');
        } else {
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data.filename).toBe('file.md');
        }
      });

      test('should normalize trailing slashes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/folder/file.md////`, {
            method: 'GET',
          })
        );
        expect(response.status).not.toBe(400);
        if (response.status === 404) {
          const body = await response.json();
          expect(body.ok).toBe(false);
          expect(body.error.code).toBe('FILE_NOT_FOUND');
        } else {
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data.filename).toBe('file.md');
        }
      });

      test('should normalize consecutive slashes in path', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/folder//subfolder///file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).not.toBe(400);
        if (response.status === 404) {
          const body = await response.json();
          expect(body.ok).toBe(false);
          expect(body.error.code).toBe('FILE_NOT_FOUND');
        } else {
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data.filename).toBe('file.md');
        }
      });
    });

    describe('Path Input Validation Edge Cases', () => {
      test('should handle path with spaces', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path%20with%20spaces/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should handle path with leading spaces', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/%20leading/file.md`, {
            method: 'GET',
          })
        );
        // Leading spaces are valid but the file doesn't exist
        expect(response.status).toBe(404);
      });

      test('should handle path with trailing spaces', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/trailing%20/file.md`, {
            method: 'GET',
          })
        );
        // Trailing spaces are valid but the file doesn't exist
        expect(response.status).toBe(404);
      });

      test('should handle path with unicode characters', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/日本語/ファイル.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should handle empty path', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should handle path with only dots', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/...`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
      });

      test('should handle path with single dot segment', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/./nonexistent-dot.md`, {
            method: 'GET',
          })
        );
        // Single dot segment is normalized by URL parsing; file doesn't exist
        expect(response.status).toBe(404);
      });

      test('should handle very long path (>1000 chars)', async () => {
        const longPath = 'a'.repeat(1001) + '.md';
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/${longPath}`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
      });

      test('should handle path with backslashes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/path\\to\\file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
      });

      test('should handle path with emojis', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/📁/📄.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should handle path with query string', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/nonexistent-file-qs.md?foo=bar`, {
            method: 'GET',
          })
        );
        // Query strings are ignored by URL parsing; file doesn't exist at this path
        expect(response.status).toBe(404);
      });

      test('should handle path with hash fragment', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file.md#section`, {
            method: 'GET',
          })
        );
        // Hash fragments not sent to server; file doesn't exist at this path
        expect(response.status).toBe(404);
      });

      test('should handle path with control characters', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file%01name.md`, {
            method: 'GET',
          })
        );
        // Control characters are valid in URL; file doesn't exist
        expect(response.status).toBe(404);
      });

      test('should handle path with colon (Windows drive letter)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/C:/file.md`, {
            method: 'GET',
          })
        );
        // Colon in path is valid; file doesn't exist
        expect(response.status).toBe(404);
      });
    });
  });

  describe('JSON Input Validation Edge Cases', () => {
    describe('PUT Request Body Validation', () => {
      test('should return 400 for empty object {}', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for null content', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: null }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for content as number instead of string', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 12345 }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for content as array', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: ['line1', 'line2'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for content as object', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: { text: 'content' } }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for deeply nested object in content', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { nested: { deeply: { value: 'test' } } },
            }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should ignore extra unexpected fields', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/extra-fields.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '# Valid Content',
              extraField: 'should be ignored',
              anotherExtra: 123,
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return 400 for array where object expected', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ content: '# Content' }]),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for invalid JSON', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/file.md`, {
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

    describe('Content String Validation', () => {
      test('should accept empty string content', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/empty-content.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '' }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('should accept content with unicode characters', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/unicode.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# こんにちは 世界 مرحبا' }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept content with emojis', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/emojis.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Testing 🚀 with 🎉 emojis 💯' }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should handle very long content (>10000 chars)', async () => {
        const longContent = '# Title\n' + 'x'.repeat(10001);
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/long-content.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: longContent }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('should handle content with control characters', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/control-chars.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Contains \x00 null byte' }),
          })
        );
        // Content with null bytes is accepted (validation is on paths, not content)
        expect(response.status).toBe(201);
      });
    });
  });

  describe('Key Validation', () => {
    describe('Key Format Validation', () => {
      test('should reject key shorter than minimum length (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/abc/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should reject key with invalid characters (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/x8k2mP9qL3nR7mQ2pN4x!@/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should reject empty key (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r//file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should accept valid 22+ character key (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).not.toBe(403);
        expect(response.status).toBe(200);
      });
    });

    describe('Key Revocation Validation', () => {
      test('should return 404 KEY_REVOKED for revoked key (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.REVOKED_KEY}/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });

      test('should return 404 KEY_REVOKED for revoked key (PUT)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Content' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });

      test('should return 404 KEY_REVOKED for revoked key (DELETE)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.REVOKED_KEY}/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });

    describe('Key Expiration Validation', () => {
      test('should return 404 KEY_EXPIRED for expired key (GET)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/file.md`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 KEY_EXPIRED for expired key (PUT)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/file.md`, {
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

      test('should return 404 KEY_EXPIRED for expired key (DELETE)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.EXPIRED_KEY}/file.md`, {
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });
    });
  });

  describe('Response Format Validation', () => {
    test('should return proper JSON content-type header (GET)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/file.md`, {
          method: 'GET',
        })
      );
      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });

    test('should return proper JSON content-type header (PUT)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Content' }),
        })
      );
      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });

    test('should return proper JSON content-type header (DELETE)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/file.md`, {
          method: 'DELETE',
        })
      );
      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });
  });
});
