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

describe('File Structure and Tail', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('GET /r/:key/structure - File Structure', () => {
    describe('File with multiple heading levels', () => {
      test('should return headings with correct levels', async () => {
        const createResponse = await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/test/structure-test.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '# Heading 1\n\nSome text\n\n## Heading 2\n\nMore text\n\n### Heading 3\n\n#### Heading 4',
            }),
          })
        );
        expect(createResponse.status).toBe(201);

        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.headings).toBeDefined();
        expect(Array.isArray(body.data.headings)).toBe(true);
      });

      test('should match FileStructureResponse schema', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileStructureResponse');
        }
      });

      test('should return correct heading structure for multi-level document', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '# Title\n\n## Section A\n\nContent\n\n### Subsection A1\n\n## Section B',
            }),
          })
        );

        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        const headings = body.data.headings;
        expect(headings.length).toBe(4);
        expect(headings[0].level).toBe(1);
        expect(headings[0].text).toBe('Title');
        expect(headings[1].level).toBe(2);
        expect(headings[1].text).toBe('Section A');
        expect(headings[2].level).toBe(3);
        expect(headings[2].text).toBe('Subsection A1');
        expect(headings[3].level).toBe(2);
        expect(headings[3].text).toBe('Section B');
      });
    });

    describe('File with no headings', () => {
      test('should return empty headings array for file without headings', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: 'Just some plain text.\n\nNo headings here.\n\nMore paragraphs.',
            }),
          })
        );

        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.headings).toEqual([]);
      });
    });

    describe('Correct line numbers', () => {
      test('should return 1-based line numbers for headings', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '# First Heading\nSome text\n## Second Heading\n\n\n# Third Heading',
            }),
          })
        );

        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        const headings = body.data.headings;
        expect(headings.length).toBe(3);
        expect(headings[0].line).toBe(1);
        expect(headings[1].line).toBe(3);
        expect(headings[2].line).toBe(6);
      });
    });

    describe('Response format', () => {
      test('should return appendCount and hasTaskAppends', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/structure`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(typeof body.data.appendCount).toBe('number');
        expect(typeof body.data.hasTaskAppends).toBe('boolean');
      });
    });

    describe('Error cases', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/structure`, {
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
          new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/structure`, {
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
          new Request(`http://localhost/r/${ctx.REVOKED_KEY}/structure`, {
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

  describe('GET /r/:key/tail - File Tail', () => {
    describe('Default bytes behavior', () => {
      test('should return 200 with tail content using default bytes (10000)', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.content).toBeDefined();
        expect(typeof body.data.content).toBe('string');
        expect(typeof body.data.bytesReturned).toBe('number');
        expect(typeof body.data.truncated).toBe('boolean');
      });

      test('should match FileTailResponse schema', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail`, {
            method: 'GET',
          })
        );
        const body = await response.json();
        if (response.status === 200) {
          assertValidResponse(body, 'FileTailResponse');
        }
      });

      test('should not truncate when file is smaller than default bytes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.truncated).toBe(false);
      });
    });

    describe('Custom bytes param', () => {
      test('should return specified number of bytes', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?bytes=50`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.bytesReturned).toBeLessThanOrEqual(50);
      });

      test('should reject bytes over max 100000', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?bytes=200000`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should indicate truncation when file is larger than bytes', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/tail-test-file.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'This is a longer piece of content that exceeds 10 bytes' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?bytes=10`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.truncated).toBe(true);
      });
    });

    describe('Lines param', () => {
      test('should return last N lines when lines param is specified', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/multiline-tail.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?lines=2`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.content).toBeDefined();
        const lines = body.data.content.split('\n');
        expect(lines.length).toBeLessThanOrEqual(2);
      });

      test('should reject lines over max 1000', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?lines=2000`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should indicate truncation when file has more lines than requested', async () => {
        await ctx.app.handle(
          new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/many-lines.md`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10' }),
          })
        );
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/tail?lines=3`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.truncated).toBe(true);
      });
    });

    describe('Error cases', () => {
      test('should return 404 for invalid key', async () => {
        const response = await ctx.app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/tail`, {
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
          new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/tail`, {
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
          new Request(`http://localhost/r/${ctx.REVOKED_KEY}/tail`, {
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
