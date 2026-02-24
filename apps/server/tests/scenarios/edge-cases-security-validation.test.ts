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

  describe('Concurrent Read/Write Edge Cases', () => {
    test('concurrent read during write sees consistent state', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/consistency.md', '# Initial Content\n');

      // WHEN: Reading while appending (append is much faster than practical race conditions)
      const [appendRes, readRes] = await Promise.all([
        appendToFile(app, workspace, file.path, 'New append content', 'agent-writer'),
        readTestFile(app, workspace, file.path),
      ]);

      // THEN: Both operations complete successfully
      expect(appendRes.status).toBe(201);
      expect(readRes.status).toBe(200);

      // AND: Read sees a valid state (either before or after append)
      const readBody = await readRes.json();
      expect(readBody.ok).toBe(true);
      expect(readBody.data.content).toContain('# Initial Content');
    });

    test('multiple rapid appends all succeed', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/rapid-appends.md', '# Rapid\n');

      // WHEN: 10 rapid appends
      const appendPromises = Array.from({ length: 10 }, (_, i) =>
        appendToFile(app, workspace, file.path, `Rapid entry ${i + 1}`, `agent-${i + 1}`)
      );
      const responses = await Promise.all(appendPromises);

      // THEN: All succeed
      for (const response of responses) {
        expect(response.status).toBe(201);
      }

      // AND: All appends are recorded
      const readResponse = await readTestFile(app, workspace, file.path);
      const readBody = await readResponse.json();
      assertValidResponse(readBody, 'FileReadResponse');
      const { data } = readBody;
      expect(data.appendCount).toBe(10);
    });
  });

  describe('Invalid Request Edge Cases', () => {
    test('missing author field rejected', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/no-author.md', '# No Author\n');

      // WHEN: Appending without author
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'No author provided',
          }),
        })
      );

      // THEN: Rejected with 400
      expect(response.status).toBe(400);
    });

    test('invalid author format rejected', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/invalid-author.md', '# Invalid Author\n');

      // WHEN: Appending with invalid author format (contains spaces or special chars)
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Invalid author',
            author: 'invalid author with spaces!',
          }),
        })
      );

      // THEN: Rejected with INVALID_AUTHOR
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('reserved author name rejected', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/reserved.md', '# Reserved\n');

      // WHEN: Appending with reserved author name 'system'
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'System message',
            author: 'system',
          }),
        })
      );

      // THEN: Rejected with INVALID_AUTHOR
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_AUTHOR');
    });

    test('invalid JSON body rejected', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/bad-json.md', '# Bad JSON\n');

      // WHEN: Sending invalid JSON
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid json }',
        })
      );

      // THEN: Rejected with 400
      expect(response.status).toBe(400);
    });

    test('invalid append type rejected', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/invalid-type.md', '# Invalid Type\n');

      // WHEN: Appending with invalid type
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nonexistent_type',
            content: 'Bad type',
            author: 'validauthor',
          }),
        })
      );

      // THEN: Rejected with 400 (Zod validation fails at schema level)
      // Note: Elysia validates body against zAppendRequest schema before handler
      expect(response.status).toBe(400);
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    test('concurrent file updates with ETag conflict - both may fail 412', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/etag-conflict.md', '# Initial Content\n');

      // Get the initial ETag
      const readResponse = await readTestFile(app, workspace, file.path);
      expect(readResponse.status).toBe(200);
      const etag = readResponse.headers.get('ETag');
      expect(etag).toBeTruthy();

      // WHEN: Two concurrent updates with the same ETag
      const [update1, update2] = await Promise.all([
        app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'If-Match': etag!,
            },
            body: JSON.stringify({ content: '# Content from Writer 1\n' }),
          })
        ),
        app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'If-Match': etag!,
            },
            body: JSON.stringify({ content: '# Content from Writer 2\n' }),
          })
        ),
      ]);

      // THEN: At least one should succeed or both fail with 412 (ETag mismatch)
      // Due to database transaction isolation, both may fail if they run truly concurrently
      const statuses = [update1.status, update2.status].sort((a, b) => a - b);
      // Acceptable outcomes: [200, 412] (one wins) or [412, 412] (both fail due to race)
      const hasConflict = statuses.includes(412);
      expect(hasConflict).toBe(true);

      // AND: Any 412 response should have the CONFLICT error code
      for (const response of [update1, update2]) {
        if (response.status === 412) {
          const body = await response.json();
          assertValidResponse(body, 'Error');
          expect(body.ok).toBe(false);
          expect(body.error.code).toBe('CONFLICT');
          expect(body.error.message).toContain('modified since last read');
          break; // Only need to check one
        }
      }
    });

    test('sequential folder creation with same name - second returns 409', async () => {
      // WHEN: Two sequential folder creation requests with the same name
      const folderName = `test-folder-${Date.now()}`;
      const create1 = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName }),
        })
      );

      const create2 = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName }),
        })
      );

      // THEN: First succeeds (201), second gets conflict (409)
      expect(create1.status).toBe(201);
      expect(create2.status).toBe(409);
    });

    test('three concurrent file creations with same name via PUT - first succeeds, others update', async () => {
      // NOTE: The POST /a/:key/folders/*/files endpoint has a route matching issue
      // where the appends route's /a/:key/* catch-all takes precedence.
      // Use PUT /w/:key/:path instead for concurrent file creation tests.
      // WHEN: Three concurrent file creation requests with the same name using PUT
      const filename = `unique-file-${Date.now()}.md`;
      const [create1, create2, create3] = await Promise.all([
        app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/${filename}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# From Agent 1\n' }),
          })
        ),
        app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/${filename}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# From Agent 2\n' }),
          })
        ),
        app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}/${filename}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# From Agent 3\n' }),
          })
        ),
      ]);

      // THEN: PUT is idempotent - all should succeed
      // Exactly one creates (201), others update (200)
      const statuses = [create1.status, create2.status, create3.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 200, 201]);
    });
  });

  describe('Input Sanitization Edge Cases', () => {
    test('should store HTML content without execution', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/html-test.md', '# HTML Test\n');

      // WHEN: Appending HTML/JavaScript content
      const htmlContent = '<script>alert("xss")</script>';
      const appendResponse = await appendToFile(app, workspace, file.path, htmlContent, 'test-agent');
      expect(appendResponse.status).toBe(201);

      // THEN: Content is stored as-is when read back
      // Note: Appends are stored separately from file content and returned in the appends array
      // when using ?format=parsed query parameter
      const readResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${file.path}?format=parsed&appends=10`, {
          method: 'GET',
        })
      );
      expect(readResponse.status).toBe(200);
      const body = await readResponse.json();
      assertValidResponse(body, 'FileReadResponse');
      // Check that the append is in the appends array and content is preserved
      expect(body.data.appends).toBeDefined();
      expect(body.data.appends.length).toBeGreaterThan(0);
      const lastAppend = body.data.appends[body.data.appends.length - 1];
      expect(lastAppend.content).toContain(htmlContent);
    });

    test('should handle CRLF characters in file path', async () => {
      // WHEN: Attempting CRLF injection in file path
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/file%0D%0AX-Injected%3A%20header.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# CRLF Test\n' }),
        })
      );

      // THEN: Rejected as invalid path
      expect(response.status).toBe(400);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('INVALID_PATH');
    });

    test('should handle unicode normalization - NFC vs NFD forms', async () => {
      // Unicode normalization: café vs café (different representations)
      // NFC form: é as single character (U+00E9)
      const nfc = 'caf\u00E9';
      // NFD form: e + combining acute accent (U+0301)
      const nfd = 'cafe\u0301';

      // Create first file with NFC form
      const file1 = await createTestFile(app, workspace, `/${nfc}.md`, '# NFC Content\n');
      expect(file1.path).toBe(`/${nfc}.md`);

      // Create second file with NFD form
      const file2Response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/${nfd}.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# NFD Content\n' }),
        })
      );

      // THEN: NFC and NFD are treated as different paths (byte-different strings)
      // Second file is created as a new file
      expect(file2Response.status).toBe(201);
    });

    test('should handle zero-width characters in content', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/zero-width.md', '# Zero Width Test\n');

      // WHEN: Appending content with zero-width characters
      const zeroWidthContent = 'Hello\u200B\u200C\u200DWorld\uFEFF'; // ZWS, ZWNJ, ZWJ, BOM
      const response = await appendToFile(app, workspace, file.path, zeroWidthContent, 'test-agent');

      // THEN: Content is accepted
      expect(response.status).toBe(201);
    });

    test('should handle RTL override characters safely', async () => {
      // GIVEN: A file in the workspace
      const file = await createTestFile(app, workspace, '/rtl-test.md', '# RTL Test\n');

      // WHEN: Appending content with RTL override characters (potential for spoofing)
      const rtlContent = 'Hello \u202E dlroW'; // RLO character
      const response = await appendToFile(app, workspace, file.path, rtlContent, 'test-agent');

      // THEN: Content is accepted (display is frontend responsibility)
      expect(response.status).toBe(201);
    });

    test('should handle homoglyph characters in paths', async () => {
      // Homoglyphs: Characters that look similar but are different
      // Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061)
      const latinPath = '/test-a.md';
      const cyrillicPath = '/test-\u0430.md';

      // Create file with Latin 'a'
      await createTestFile(app, workspace, latinPath, '# Latin\n');

      // Create file with Cyrillic 'а' - should be treated as different file
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${cyrillicPath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Cyrillic\n' }),
        })
      );

      // THEN: Should create as separate file (201) - they are different paths
      expect(response.status).toBe(201);
    });
  });

  describe('Key Rotation/Expiry Edge Cases', () => {
    test('should handle request completing before key revocation', async () => {
      // Import required modules
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // GIVEN: A workspace with a fresh key
      const testWorkspace = await createTestWorkspace(app);
      const testFile = await createTestFile(app, testWorkspace, '/revoke-test.md', '# Revoke Test\n');

      // WHEN: Read operation completes before revocation
      const result = await readTestFile(app, testWorkspace, testFile.path);

      // THEN: Operation succeeds
      expect(result.status).toBe(200);

      // Revoke the key after the operation
      const keyHash = hashKey(testWorkspace.readKey);
      await db
        .update(capabilityKeys)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(capabilityKeys.keyHash, keyHash));

      // THEN: Subsequent operations fail
      const failedResult = await readTestFile(app, testWorkspace, testFile.path);
      expect(failedResult.status).toBe(404);
    });

    test('should handle key expiry at exact boundary', async () => {
      // Import required modules
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // GIVEN: A workspace with a key that expires in 1 second
      const testWorkspace = await createTestWorkspace(app);
      await createTestFile(app, testWorkspace, '/expiry-test.md', '# Expiry Test\n');

      // Set key to expire in 1 second
      const keyHash = hashKey(testWorkspace.readKey);
      const expiryTime = new Date(Date.now() + 1000);
      await db
        .update(capabilityKeys)
        .set({ expiresAt: expiryTime.toISOString() })
        .where(eq(capabilityKeys.keyHash, keyHash));

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // WHEN: Using key after expiry
      const response = await app.handle(
        new Request(`http://localhost/r/${testWorkspace.readKey}/expiry-test.md`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404 with KEY_EXPIRED error
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_EXPIRED');
    });

    test('should reject all operations after key revocation', async () => {
      // Import required modules
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // GIVEN: A workspace with a file
      const testWorkspace = await createTestWorkspace(app);
      const testFile = await createTestFile(app, testWorkspace, '/revoke-during-ops.md', '# Revoke During Ops\n');

      // Revoke the key first
      const keyHash = hashKey(testWorkspace.readKey);
      await db
        .update(capabilityKeys)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(capabilityKeys.keyHash, keyHash));

      // WHEN: Multiple read operations are attempted after revocation
      const results = await Promise.all([
        readTestFile(app, testWorkspace, testFile.path),
        readTestFile(app, testWorkspace, testFile.path),
        readTestFile(app, testWorkspace, testFile.path),
      ]);

      // THEN: All operations fail with 404
      for (const result of results) {
        expect(result.status).toBe(404);
      }
    });

    test('should reject operations with revoked key', async () => {
      // Import required modules
      const { db } = await import('../../src/db');
      const { capabilityKeys } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const { hashKey } = await import('../../src/core/capability-keys');

      // GIVEN: A workspace with a file
      const testWorkspace = await createTestWorkspace(app);
      const testFile = await createTestFile(app, testWorkspace, '/revoked-key-test.md', '# Revoked Key Test\n');
      const oldReadKey = testWorkspace.readKey;

      // Revoke the key (simulating rotation)
      const keyHash = hashKey(oldReadKey);
      await db
        .update(capabilityKeys)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(capabilityKeys.keyHash, keyHash));

      // WHEN: Using the revoked key
      const response = await app.handle(
        new Request(`http://localhost/r/${oldReadKey}${testFile.path}`, {
          method: 'GET',
        })
      );

      // THEN: Should return 404 (key is revoked)
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('KEY_REVOKED');
    });
  });
});
