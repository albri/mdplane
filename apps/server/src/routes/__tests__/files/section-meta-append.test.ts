import {
  describe,
  expect,
  test,
  beforeAll,
  beforeEach,
  assertValidResponse,
  INVALID_KEY,
  ISO_TIMESTAMP_PATTERN,
  setupFileTestContext,
  resetTestFiles,
  type FileTestContext,
} from './test-setup';

describe('GET /r/:key/section/:heading - Get Section by Heading', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Successful Section Retrieval', () => {
    test('should find section by exact heading match', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '---\ntitle: Test File\nauthor: Test\n---\n# Test Content\n\nThis is the test content section.',
          }),
        })
      );

      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Test%20Content`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.heading).toBe('Test Content');
      expect(body.data.level).toBe(1);
      expect(body.data.content).toContain('# Test Content');
      expect(body.data.startLine).toBeGreaterThan(0);
      expect(body.data.endLine).toBeGreaterThanOrEqual(body.data.startLine);
    });

    test('should match FileSectionResponse schema', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '---\ntitle: Test File\nauthor: Test\n---\n# Test Content\n\nThis is the test content section.',
          }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Test%20Content`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'FileSectionResponse');
      }
    });

    test('should end section at next same-level heading', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '## Section A\n\nContent A\n\n## Section B\n\nContent B',
          }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Section%20A`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.heading).toBe('Section A');
      expect(body.data.level).toBe(2);
      expect(body.data.content).toContain('Content A');
      expect(body.data.content).not.toContain('Section B');
      expect(body.data.content).not.toContain('Content B');
    });

    test('should include nested sub-headings in section', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '## Parent Section\n\nParent content\n\n### Child Section\n\nChild content\n\n## Sibling Section',
          }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Parent%20Section`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.heading).toBe('Parent Section');
      expect(body.data.content).toContain('Parent content');
      expect(body.data.content).toContain('### Child Section');
      expect(body.data.content).toContain('Child content');
      expect(body.data.content).not.toContain('Sibling Section');
    });

    test('should return section at end of file', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '---\ntitle: Test File\nauthor: Test\n---\n# Test Content\n\nThis is the test content section.',
          }),
        })
      );

      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Test%20Content`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.heading).toBe('Test Content');
      expect(body.data.content).toContain('This is the test content section.');
    });

    test('should end section at higher-level heading', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '# Main\n\n## Subsection\n\nSubsection content\n\n# Another Main',
          }),
        })
      );

      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Subsection`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Subsection content');
      expect(body.data.content).not.toContain('Another Main');
    });
  });

  describe('Section Not Found', () => {
    test('should return 404 for non-existent heading', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '---\ntitle: Test File\nauthor: Test\n---\n# Test Content\n\nThis is the test content section.',
          }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Non%20Existent%20Heading`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('SECTION_NOT_FOUND');
      expect(body.error.message).toContain('Non Existent Heading');
    });
  });

  describe('Key Validation', () => {
    test('should return 404 for invalid key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/section/Test%20Content`, {
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
        new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/section/Test%20Content`, {
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
        new Request(`http://localhost/r/${ctx.REVOKED_KEY}/section/Test%20Content`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });
  });

  describe('Response Format', () => {
    test('should return correct response structure', async () => {
      await ctx.app.handle(
        new Request(`http://localhost/w/${ctx.VALID_WRITE_KEY}/path/to/file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '---\ntitle: Test File\nauthor: Test\n---\n# Test Content\n\nThis is the test content section.',
          }),
        })
      );
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.FILE_SCOPED_READ_KEY}/section/Test%20Content`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('ok', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('heading');
      expect(body.data).toHaveProperty('level');
      expect(body.data).toHaveProperty('content');
      expect(body.data).toHaveProperty('startLine');
      expect(body.data).toHaveProperty('endLine');
      expect(typeof body.data.level).toBe('number');
      expect(body.data.level).toBeGreaterThanOrEqual(1);
      expect(body.data.level).toBeLessThanOrEqual(6);
    });
  });
});

describe('GET /r/:key/meta - Get File Metadata', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Successful Metadata Retrieval', () => {
    test('should return 200 with file metadata', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/meta`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return all required metadata fields', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/meta`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      expect(body.data.id).toBeDefined();
      expect(typeof body.data.id).toBe('string');
      expect(body.data.filename).toBeDefined();
      expect(typeof body.data.filename).toBe('string');
      expect(body.data.folder).toBeDefined();
      expect(typeof body.data.folder).toBe('string');
      expect(body.data.size).toBeDefined();
      expect(typeof body.data.size).toBe('number');
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
      expect(body.data.updatedAt).toBeDefined();
      expect(body.data.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      expect(body.data.appendCount).toBeDefined();
      expect(typeof body.data.appendCount).toBe('number');
      expect(body.data.taskStats).toBeDefined();
      expect(typeof body.data.taskStats).toBe('object');
      expect(typeof body.data.hasWebhook).toBe('boolean');
    });

    test('should return taskStats with pending, claimed, completed', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/meta`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      expect(body.data.taskStats).toBeDefined();
      expect(typeof body.data.taskStats.pending).toBe('number');
      expect(typeof body.data.taskStats.claimed).toBe('number');
      expect(typeof body.data.taskStats.completed).toBe('number');
    });

    test('should match FileMetaResponse schema', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/meta`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'FileMetaResponse');
      }
    });

    test('should NOT include file content in response', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/meta`, {
          method: 'GET',
        })
      );
      const body = await response.json();
      expect(body.data.content).toBeUndefined();
    });
  });

  describe('Error Cases - Metadata', () => {
    test('should return 404 for invalid key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/meta`, {
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
        new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/meta`, {
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
        new Request(`http://localhost/r/${ctx.REVOKED_KEY}/meta`, {
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

describe('GET /r/:key/ops/file/append/:appendId - Read Specific Append', () => {
  let ctx: FileTestContext;

  beforeAll(async () => {
    ctx = await setupFileTestContext();
  });

  beforeEach(async () => {
    await resetTestFiles(ctx);
  });

  describe('Successful Read', () => {
    test('should return 200 with append data for existing append', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/ops/file/append/a1`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return append with required fields (id, author, ts, type)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/ops/file/append/a1`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('a1');
      expect(body.data.author).toBeDefined();
      expect(body.data.ts).toBeDefined();
      expect(body.data.ts).toMatch(ISO_TIMESTAMP_PATTERN);
      expect(body.data.type).toBeDefined();
    });

    test('should include content in response when append has content', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/ops/file/append/a1`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      if (body.data.type === 'task' || body.data.type === 'comment') {
        expect(body.data.content).toBeDefined();
      }
    });

    test('should allow read with append key (inherits read permission)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_APPEND_KEY}/ops/file/append/a1`, {
          method: 'GET',
        })
      );
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });

    test('should allow read with write key (inherits read permission)', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_WRITE_KEY}/ops/file/append/a1`, {
          method: 'GET',
        })
      );
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.status).toBe(200);
    });
  });

  describe('Error Cases', () => {
    test('should return 404 for non-existent append ID', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${ctx.VALID_READ_KEY}/ops/file/append/a99999`, {
          method: 'GET',
        })
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('APPEND_NOT_FOUND');
    });

    test('should return 404 for invalid key', async () => {
      const response = await ctx.app.handle(
        new Request(`http://localhost/r/${INVALID_KEY}/ops/file/append/a1`, {
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
        new Request(`http://localhost/r/${ctx.EXPIRED_KEY}/ops/file/append/a1`, {
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
        new Request(`http://localhost/r/${ctx.REVOKED_KEY}/ops/file/append/a1`, {
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

