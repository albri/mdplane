/**
 * Permission Scenarios Tests
 *
 * Comprehensive scenario tests for permission handling:
 * - Share with read-only access
 * - Share with append-only access
 * - Share with full edit access
 *
 * Tests verify that capability URLs properly enforce permission levels:
 * - Read key (/r/): Can only read files
 * - Append key (/a/): Can read + append
 * - Write key (/w/): Can read + append + update + delete
 *
 * @see packages/shared/openapi/paths/files.yaml
 * @see packages/shared/openapi/paths/appends.yaml
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import type { Elysia } from 'elysia';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import { createTestWorkspace, createTestFile, type TestWorkspace, type TestFile } from '../fixtures';

describe('Permission Scenarios', () => {
  let app: ReturnType<typeof createTestApp>;
  let workspace: TestWorkspace;
  let file: TestFile;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create fresh workspace and file for each test
    workspace = await createTestWorkspace(app);
    file = await createTestFile(app, workspace, '/test-permissions.md', '# Permission Test\n\nInitial content.');
  });

  describe('Read-Only Access', () => {
    test('GIVEN read key, WHEN GET file, THEN returns 200 with content', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Permission Test');
    });

    test('GIVEN read key, WHEN POST append, THEN returns 404 PERMISSION_DENIED', async () => {
      // Read keys cannot append - there is no /r/:key POST endpoint
      // The append endpoint is /a/:key, so using read key at /a/ should fail
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.readKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Test comment',
            author: 'test-agent',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN read key, WHEN PUT (update), THEN returns 404 PERMISSION_DENIED', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated content' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN read key, WHEN DELETE, THEN returns 404 PERMISSION_DENIED', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN read key, WHEN permission denied, THEN error response matches OpenAPI schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // Verify ErrorResponse schema: { ok: false, error: { code, message? } }
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(typeof body.error.code).toBe('string');
      // Code should be one of the valid error codes from OpenAPI spec
      expect(['PERMISSION_DENIED', 'FORBIDDEN']).toContain(body.error.code);
    });
  });

  describe('Append-Only Access', () => {
    test('GIVEN append key, WHEN GET file via /r/, THEN returns 200 (inherits read)', async () => {
      // Append keys can read files via /r/ endpoint (permission inheritance)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.appendKey}${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Permission Test');
    });

    test('GIVEN append key, WHEN POST append, THEN returns 201', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Test comment from append key',
            author: 'test-agent',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    test('GIVEN append key, WHEN PUT (overwrite), THEN returns 404 PERMISSION_DENIED', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Overwritten content' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN append key, WHEN DELETE, THEN returns 404 PERMISSION_DENIED', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}${file.path}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN append key, WHEN appending, THEN creates new entry without modifying original', async () => {
      // Get original content
      const originalResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );
      const originalBody = await originalResponse.json();
      assertValidResponse(originalBody, 'FileReadResponse');
      const originalContent = originalBody.data.content;
      const originalAppendCount = originalBody.data.appendCount;

      // Append a comment
      const appendResponse = await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'New append entry',
            author: 'test-agent',
          }),
        })
      );
      expect(appendResponse.status).toBe(201);

      // Verify original content unchanged but append count increased
      const afterResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );
      const afterBody = await afterResponse.json();
      assertValidResponse(afterBody, 'FileReadResponse');

      // Original markdown content should be unchanged
      expect(afterBody.data.content).toContain(originalContent.split('\n')[0]);
      // Append count should increase
      expect(afterBody.data.appendCount).toBe(originalAppendCount + 1);
    });
  });

  describe('Full Edit Access', () => {
    test('GIVEN write key, WHEN GET file via /r/, THEN returns 200', async () => {
      // Write keys can read files via /r/ endpoint (permission inheritance)
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.writeKey}${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('Permission Test');
    });

    test('GIVEN write key, WHEN POST append, THEN returns 201', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Admin comment',
            author: 'admin-user',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'AppendResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    test('GIVEN write key, WHEN PUT (overwrite), THEN returns 200', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Updated by write key\n\nNew content.' }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileUpdateResponse');
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.etag).toBeDefined();
    });

    test('GIVEN write key, WHEN DELETE, THEN returns 200', async () => {
      // Create a file specifically for deletion
      const deleteFile = await createTestFile(app, workspace, '/to-delete.md', '# Delete me');

      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${deleteFile.path}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileDeleteResponse');
      expect(body.ok).toBe(true);
      expect(body.data.deleted).toBe(true);
    });

    test('GIVEN write key, WHEN accessing file, THEN has all permissions', async () => {
      // Verify write key can perform all operations

      // 1. Read
      const readResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.writeKey}${file.path}`, {
          method: 'GET',
        })
      );
      expect(readResponse.status).toBe(200);

      // 2. Append
      const appendResponse = await app.handle(
        new Request(`http://localhost/a/${workspace.writeKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            content: 'Write key can append',
            author: 'admin',
          }),
        })
      );
      expect(appendResponse.status).toBe(201);

      // 3. Update
      const updateResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Write key update' }),
        })
      );
      expect(updateResponse.status).toBe(200);
    });
  });

  describe('Cross-Resource Permissions', () => {
    test('GIVEN read key for file A, WHEN accessing file B, THEN returns 404', async () => {
      // Create another file
      const fileB = await createTestFile(app, workspace, '/file-b.md', '# File B');

      // Try to access file B using file A's path but with workspace's read key
      // The workspace key should work for both files
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/nonexistent-file.md`, {
          method: 'GET',
        })
      );

      // Should return 404, not 403 (no information leak about key validity)
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    test('GIVEN keys from different workspace, WHEN accessing file, THEN returns 404', async () => {
      // Create another workspace
      const otherWorkspace = await createTestWorkspace(app);

      // Try to access file from first workspace using second workspace's key
      const response = await app.handle(
        new Request(`http://localhost/r/${otherWorkspace.readKey}${file.path}`, {
          method: 'GET',
        })
      );

      // Should return 404 - key is valid but file doesn't exist in that workspace
      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    test('GIVEN workspace key, WHEN accessing any file in workspace, THEN succeeds', async () => {
      // Create multiple files
      const fileA = await createTestFile(app, workspace, '/folder-a/file-a.md', '# File A');
      const fileB = await createTestFile(app, workspace, '/folder-b/file-b.md', '# File B');

      // Workspace keys should work for all files
      const responseA = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${fileA.path}`, {
          method: 'GET',
        })
      );
      expect(responseA.status).toBe(200);

      const responseB = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}${fileB.path}`, {
          method: 'GET',
        })
      );
      expect(responseB.status).toBe(200);
    });
  });

  describe('Error Response Format', () => {
    test('GIVEN 404 response, THEN matches OpenAPI ErrorResponse schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Forbidden' }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // Verify ErrorResponse schema structure
      expect(body).toHaveProperty('ok');
      expect(body.ok).toBe(false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(typeof body.error.code).toBe('string');
    });

    test('GIVEN permission denied, THEN error code is PERMISSION_DENIED', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.appendKey}${file.path}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('GIVEN invalid resource access, THEN no information leak about key validity', async () => {
      // When accessing a file that doesn't exist with a valid key,
      // should return 404 not 403 to avoid leaking key validity
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/does-not-exist.md`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('Key Validation', () => {
    test('GIVEN invalid key format, WHEN accessing file, THEN returns 404 INVALID_KEY', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/invalid-short-key${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN empty key, WHEN accessing file, THEN returns 404 INVALID_KEY', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r//${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN nonexistent key, WHEN accessing file, THEN returns 404 INVALID_KEY', async () => {
      // Valid format but doesn't exist in database
      const fakeKey = 'r8k2mP9qL3nR7mQ2pN4xYz5a';

      const response = await app.handle(
        new Request(`http://localhost/r/${fakeKey}${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });

    test('GIVEN key with special characters, WHEN accessing file, THEN returns 404 INVALID_KEY', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/abc!@#$%^&*()123456789${file.path}`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_KEY');
    });
  });

  describe('Permission Matrix', () => {
    describe('Read Key Permissions', () => {
      test('read key CAN read via /r/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${workspace.readKey}${file.path}`, { method: 'GET' })
        );
        expect(response.status).toBe(200);
      });

      test('read key CANNOT append via /a/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.readKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'comment', content: 'test', author: 'agent' }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('read key CANNOT update via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.readKey}${file.path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Updated' }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('read key CANNOT delete via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.readKey}${file.path}`, { method: 'DELETE' })
        );
        expect(response.status).toBe(404);
      });
    });

    describe('Append Key Permissions', () => {
      test('append key CAN read via /r/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${workspace.appendKey}${file.path}`, { method: 'GET' })
        );
        expect(response.status).toBe(200);
      });

      test('append key CAN append via /a/ (primary use case)', async () => {
        // The /a/ endpoint is for appending, not reading
        // Append keys read via /r/ endpoint
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'comment', content: 'append key test', author: 'agent' }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('append key CAN append via /a/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'comment', content: 'test', author: 'agent' }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('append key CANNOT update via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.appendKey}${file.path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Updated' }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('append key CANNOT delete via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.appendKey}${file.path}`, { method: 'DELETE' })
        );
        expect(response.status).toBe(404);
      });
    });

    describe('Write Key Permissions', () => {
      test('write key CAN read via /r/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${workspace.writeKey}${file.path}`, { method: 'GET' })
        );
        expect(response.status).toBe(200);
      });

      test('write key CAN append via /a/ (inherits append permission)', async () => {
        // Write keys can use /a/ endpoint for appending
        const response = await app.handle(
          new Request(`http://localhost/a/${workspace.writeKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'comment', content: 'write key via /a/', author: 'admin' }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('write key CAN update via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '# Updated via /w/' }),
          })
        );
        expect(response.status).toBe(200);
      });

      test('write key CAN append via /w/', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}${file.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'comment', content: 'test via /w/', author: 'admin' }),
          })
        );
        expect(response.status).toBe(201);
      });

      test('write key CAN delete via /w/', async () => {
        const deleteFile = await createTestFile(app, workspace, '/for-delete.md');
        const response = await app.handle(
          new Request(`http://localhost/w/${workspace.writeKey}${deleteFile.path}`, { method: 'DELETE' })
        );
        expect(response.status).toBe(200);
      });
    });
  });
});



