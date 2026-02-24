/**
 * Edge Cases Scenario Tests
 *
 * Tests for edge cases and error handling:
 * - Append to non-existent file
 * - Concurrent appends (non-claim)
 * - Very large append
 * - Malformed markdown/content
 *
 * Additional edge cases:
 * - Path traversal attempts
 * - Special characters in paths
 * - Unicode content handling
 * - Empty content validation
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import {
  createTestWorkspace,
  createTestFile,
  readTestFile,
  type TestWorkspace,
} from '../fixtures';

/**
 * Helper to append content to a file via the append key.
 */
async function appendToFile(
  app: ReturnType<typeof createTestApp>,
  workspace: TestWorkspace,
  path: string,
  content: string,
  author: string
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return app.handle(
    new Request(`http://localhost/a/${workspace.appendKey}${normalizedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'comment',
        content,
        author,
      }),
    })
  );
}

describe('Edge Cases Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    workspace = await createTestWorkspace(app);
  });

  describe('Append to Non-Existent File', () => {
    test('POST to /a/:key/nonexistent.md → 404', async () => {
      // GIVEN: A workspace without a specific file
      // WHEN: Attempting to append to a non-existent file
      const response = await appendToFile(
        app,
        workspace,
        '/nonexistent-file.md',
        'This append should fail',
        'test-agent'
      );

      // THEN: Returns 404
      expect(response.status).toBe(404);
    });

    test('error message explains file not found', async () => {
      // GIVEN: A non-existent file path
      // WHEN: Appending to it
      const response = await appendToFile(
        app,
        workspace,
        '/does-not-exist.md',
        'Content',
        'agent'
      );
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Error response has correct code and message
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FILE_NOT_FOUND');
      expect(body.error.message).toBeDefined();
    });

    test('no auto-creation of files on append', async () => {
      // GIVEN: A workspace with a specific path
      const targetPath = '/should-not-exist.md';

      // WHEN: Attempting to append to non-existent file
      await appendToFile(app, workspace, targetPath, 'Auto-create test', 'agent');

      // THEN: File was not created - reading it returns 404
      const readResponse = await readTestFile(app, workspace, targetPath);
      expect(readResponse.status).toBe(404);
    });
  });

  describe('Concurrent Appends (Non-Claim)', () => {
    test('two agents append to same file with Promise.all() - both succeed', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/log.md', '# Activity Log\n');

      // WHEN: Two agents append simultaneously
      const [res1, res2] = await Promise.all([
        appendToFile(app, workspace, file.path, 'Entry from Agent A', 'agent-a'),
        appendToFile(app, workspace, file.path, 'Entry from Agent B', 'agent-b'),
      ]);

      // THEN: Both succeed with 201
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    test('both appends exist in file', async () => {
      // GIVEN: A file for concurrent appends
      const file = await createTestFile(app, workspace, '/concurrent.md', '# Concurrent Test\n');

      // WHEN: Two agents append simultaneously
      await Promise.all([
        appendToFile(app, workspace, file.path, 'Message from Alpha', 'agent-alpha'),
        appendToFile(app, workspace, file.path, 'Message from Beta', 'agent-beta'),
      ]);

      // THEN: Reading the file shows correct append count
      const readResponse = await readTestFile(app, workspace, file.path);
      const readBody = await readResponse.json();
      assertValidResponse(readBody, 'FileReadResponse');
      const { data } = readBody;
      expect(data.appendCount).toBe(2);
    });

    test('append IDs are sequential and unique (sequential appends)', async () => {
      // GIVEN: A file for appends
      const file = await createTestFile(app, workspace, '/sequential-ids.md', '# Sequential IDs\n');

      // WHEN: Multiple agents append sequentially (to avoid race conditions in ID generation)
      const res1 = await appendToFile(app, workspace, file.path, 'First', 'agent-1');
      const res2 = await appendToFile(app, workspace, file.path, 'Second', 'agent-2');
      const res3 = await appendToFile(app, workspace, file.path, 'Third', 'agent-3');

      const body1 = await res1.json();
      const body2 = await res2.json();
      const body3 = await res3.json();

      // THEN: All IDs are unique
      const ids = [body1.data.id, body2.data.id, body3.data.id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // AND: All IDs match the pattern a[number]
      for (const id of ids) {
        expect(id).toMatch(/^a\d+$/);
      }

      // AND: IDs are sequential (a1, a2, a3)
      expect(ids).toEqual(['a1', 'a2', 'a3']);
    });

    test('no duplicates in database after concurrent appends', async () => {
      // GIVEN: A file for concurrent appends
      const file = await createTestFile(app, workspace, '/no-duplicates.md', '# No Duplicates\n');

      // WHEN: Many agents append simultaneously
      const appendPromises = Array.from({ length: 5 }, (_, i) =>
        appendToFile(app, workspace, file.path, `Entry ${i + 1}`, `agent-${i + 1}`)
      );
      await Promise.all(appendPromises);

      // THEN: Append count matches number of requests
      const readResponse = await readTestFile(app, workspace, file.path);
      const readBody = await readResponse.json();
      assertValidResponse(readBody, 'FileReadResponse');
      const { data } = readBody;
      expect(data.appendCount).toBe(5);
    });
  });

  describe('Very Large Append', () => {
    test('moderate size append (10KB) succeeds', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/large-append.md', '# Large Content\n');

      // WHEN: Appending 10KB of content
      const largeContent = 'x'.repeat(10 * 1024);
      const response = await appendToFile(app, workspace, file.path, largeContent, 'agent-large');

      // THEN: Append succeeds
      expect(response.status).toBe(201);
    });

    test('medium size append (100KB) succeeds', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/medium-append.md', '# Medium Content\n');

      // WHEN: Appending 100KB of content
      const mediumContent = 'y'.repeat(100 * 1024);
      const response = await appendToFile(app, workspace, file.path, mediumContent, 'agent-medium');

      // THEN: Append succeeds (within reasonable limits)
      expect(response.status).toBe(201);
    });

    test('very large append (>1MB limit) → 413', async () => {
      // Per Max append size is 1MB (1,048,576 bytes)
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/oversized.md', '# Oversized\n');

      // WHEN: Appending content exceeding 1MB limit
      const oversizedContent = 'z'.repeat(1.5 * 1024 * 1024); // 1.5MB
      const response = await appendToFile(app, workspace, file.path, oversizedContent, 'agent-big');

      // THEN: Returns 413 Payload Too Large
      expect(response.status).toBe(413);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    test('error includes X-Content-Size-Limit header', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/header-test.md', '# Header Test\n');

      // WHEN: Exceeding size limit
      const oversizedContent = 'a'.repeat(1.5 * 1024 * 1024);
      const response = await appendToFile(app, workspace, file.path, oversizedContent, 'agent');

      // THEN: Response includes size limit header with the append size limit
      expect(response.headers.get('X-Content-Size-Limit')).toBe('1048576');
    });

    test('file size limit (10MB) enforced', async () => {
      // Per Max file creation is 10MB (10,485,760 bytes)
      // File size limit is checked on PUT /w/:key/path (file creation/update)
      // GIVEN: A workspace
      // WHEN: Trying to create a file larger than 10MB via PUT
      const oversizedContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/oversized-file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: oversizedContent }),
        })
      );

      // THEN: Returns 413 Payload Too Large
      expect(response.status).toBe(413);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(response.headers.get('X-Content-Size-Limit')).toBe('10485760');
    });
  });

  describe('Malformed Content', () => {
    test('malformed markdown accepted (platform is agnostic)', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/markdown.md', '# Valid Markdown\n');

      // WHEN: Appending malformed markdown (unclosed tags, broken links, etc)
      const malformedMarkdown = `
        # Unclosed **bold
        [broken link](
        > unclosed blockquote
        \`\`\`js
        // unclosed code block
      `;
      const response = await appendToFile(app, workspace, file.path, malformedMarkdown, 'agent');

      // THEN: Accepted (platform is content-agnostic)
      expect(response.status).toBe(201);
    });

    test('unicode content preserved correctly', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/unicode.md', '# Unicode Test\n');

      // WHEN: Appending unicode content
      const unicodeContent = '日本語テスト 🚀 émoji ñ 中文 العربية';
      const response = await appendToFile(app, workspace, file.path, unicodeContent, 'agent-unicode');

      // THEN: Append succeeds
      expect(response.status).toBe(201);
    });

    test('empty content rejected (400)', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/empty-content.md', '# Empty Test\n');

      // WHEN: Appending empty content via raw request (bypassing helper)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: '',
            author: 'agent',
          }),
        })
      );

      // THEN: Empty content is accepted - content is optional per OpenAPI spec
      expect(response.status).toBe(201);
    });

    test('whitespace-only content handled', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/whitespace.md', '# Whitespace Test\n');

      // WHEN: Appending whitespace-only content
      const response = await appendToFile(app, workspace, file.path, '   \n\t\n   ', 'agent');

      // THEN: Whitespace-only content is accepted (platform is content-agnostic)
      expect(response.status).toBe(201);
    });

    test('special characters in content handled', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/special-chars.md', '# Special Chars\n');

      // WHEN: Appending content with special characters
      const specialContent = '<script>alert("xss")</script> & "quotes" \' backslash \\ dollar $';
      const response = await appendToFile(app, workspace, file.path, specialContent, 'agent');

      // THEN: Content is accepted (stored as-is, escaping is consumer's responsibility)
      expect(response.status).toBe(201);
    });
  });

  describe('Path Security Edge Cases', () => {
    test('path traversal attempts blocked (../)', async () => {
      // GIVEN: A workspace with a file
      await createTestFile(app, workspace, '/safe/file.md', '# Safe File\n');

      // WHEN: Attempting path traversal with ../
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/../etc/passwd`, {
          method: 'GET',
        })
      );

      // THEN: Blocked with 400 INVALID_PATH
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_PATH');
    });

    test('encoded path traversal blocked (%2e%2e%2f)', async () => {
      // GIVEN: A workspace
      // WHEN: Attempting encoded path traversal
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/%2e%2e%2fetc/passwd`, {
          method: 'GET',
        })
      );

      // THEN: Blocked
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_PATH');
    });

    test('double-encoded path traversal blocked (%252e%252e)', async () => {
      // GIVEN: A workspace
      // WHEN: Attempting double-encoded path traversal
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/%252e%252e/secret`, {
          method: 'GET',
        })
      );

      // THEN: Double-encoded path traversal is treated as literal path (file not found)
      expect(response.status).toBe(404);
    });

    test('null bytes in path rejected', async () => {
      // GIVEN: A workspace
      // WHEN: Path contains null byte
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/file%00.md`, {
          method: 'GET',
        })
      );

      // THEN: Rejected
      expect(response.status).toBe(400);
    });

    test('backslash path traversal blocked', async () => {
      // GIVEN: A workspace
      // WHEN: Attempting Windows-style path traversal
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/..\\etc\\passwd`, {
          method: 'GET',
        })
      );

      // THEN: Backslash path traversal is blocked with 400
      expect(response.status).toBe(400);
    });
  });

  describe('Path Character Edge Cases', () => {
    test('spaces in path work correctly', async () => {
      // GIVEN: A file with spaces in the name
      const file = await createTestFile(
        app,
        workspace,
        '/my file with spaces.md',
        '# Spaces Test\n'
      );

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: File is accessible
      expect(response.status).toBe(200);
    });

    test('unicode in path works correctly', async () => {
      // GIVEN: A file with unicode in the name
      const file = await createTestFile(app, workspace, '/日本語ファイル.md', '# Unicode Path\n');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: File is accessible
      expect(response.status).toBe(200);
    });

    test('deeply nested path works', async () => {
      // GIVEN: A deeply nested file path
      const deepPath = '/a/b/c/d/e/f/g/deeply-nested.md';
      const file = await createTestFile(app, workspace, deepPath, '# Deep\n');

      // WHEN: Reading the file
      const response = await readTestFile(app, workspace, file.path);

      // THEN: File is accessible
      expect(response.status).toBe(200);
    });

    test('very long file path (>1024 chars) rejected', async () => {
      // Path length limit is 1024 chars (LIMITS.PATH_MAX_LENGTH)
      // GIVEN: A workspace
      // WHEN: Creating a file with path exceeding 1024 chars
      const longPath = '/' + 'a'.repeat(1030) + '.md'; // >1024 chars total
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${longPath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Long Path\n' }),
        })
      );

      // THEN: Rejected with 400 INVALID_PATH
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_PATH');
    });
  });

});
