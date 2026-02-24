import { describe, expect, test, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestApp } from '../../../../tests/helpers/test-app';
import {
  createTestWorkspace,
  createTestFile,
  createFolderScopedKey,
  createFileScopedKey,
  createAllowedTypesKey,
  type TestWorkspace,
} from '../../../../tests/fixtures';

describe('Scoped Key Restrictions', () => {
  let app: Elysia;
  let testWorkspace: TestWorkspace;
  let scopedFolderKey: string;
  let scopedFileKey: string;
  let allowedTypesKey: string;

  beforeAll(async () => {
    app = createTestApp();
    testWorkspace = await createTestWorkspace(app);
    await createTestFile(app, testWorkspace, '/path/to/file.md', '# Test File');
    scopedFolderKey = createFolderScopedKey(testWorkspace, 'append', '/docs/');
    scopedFileKey = createFileScopedKey(testWorkspace, 'append', '/allowed.md');
    allowedTypesKey = createAllowedTypesKey(testWorkspace, 'append', ['task', 'claim']);
  });

  describe('scopePath Enforcement', () => {
    test('should allow append to path within scope', async () => {
      await createTestFile(app, testWorkspace, '/docs/readme.md', '# Docs');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFolderKey}/docs/readme.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test comment within scope',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should allow append to nested path within scope', async () => {
      await createTestFile(app, testWorkspace, '/docs/guides/intro.md', '# Intro');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFolderKey}/docs/guides/intro.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test comment in nested path',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should reject append to path outside scope', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFolderKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test comment outside scope',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
      expect(body.error.message).toContain('outside of key scope');
    });

    test('should reject append to sibling folder outside scope', async () => {
      await createTestFile(app, testWorkspace, '/other/file.md', '# Other');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFolderKey}/other/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Test comment in sibling folder',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('allowedTypes Enforcement', () => {
    test('should allow append with allowed type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'task',
            author: 'test-user',
            content: '- [ ] Task within allowed types',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should allow append with another allowed type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'claim',
            ref: 'a1',
            author: 'test-user',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should reject append with disallowed type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'This comment type is not allowed',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TYPE_NOT_ALLOWED');
      expect(body.error.message).toContain('not allowed');
    });

    test('should reject append with response type (not in allowed list)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'response',
            ref: 'a1',
            author: 'test-user',
            content: 'Response not allowed',
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TYPE_NOT_ALLOWED');
    });

    test('should reject multi-append with disallowed type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'test-user',
            appends: [
              { type: 'comment', content: 'This comment type is not allowed via multi-append' },
            ],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TYPE_NOT_ALLOWED');
    });

    test('should reject multi-append when any item has disallowed type', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'test-user',
            appends: [
              { type: 'task', content: '- [ ] Allowed task' },
              { type: 'comment', content: 'Disallowed comment' },
            ],
          }),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TYPE_NOT_ALLOWED');
    });

    test('should allow multi-append when all items have allowed types', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${allowedTypesKey}/path/to/file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'test-user',
            appends: [
              { type: 'task', content: '- [ ] First allowed task' },
              { type: 'task', content: '- [ ] Second allowed task' },
            ],
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('File-Scoped Key Enforcement', () => {
    test('should allow append to exact scoped file path', async () => {
      await createTestFile(app, testWorkspace, '/allowed.md', '# Allowed File');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFileKey}/allowed.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'Comment on allowed file',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should reject append to different file', async () => {
      await createTestFile(app, testWorkspace, '/other.md', '# Other File');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFileKey}/other.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'This should be rejected - wrong file',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
      expect(body.error.message).toContain('outside of key scope');
    });

    test('should reject append to nested path under scoped file', async () => {
      await createTestFile(app, testWorkspace, '/allowed.md/nested', '# Nested file');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFileKey}/allowed.md/nested`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'This should be rejected - nested under file',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });

    test('should reject append to file in subfolder with similar name', async () => {
      await createTestFile(app, testWorkspace, '/folder/allowed.md', '# Similar name in folder');

      const response = await app.handle(
        new Request(`http://localhost/a/${scopedFileKey}/folder/allowed.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            author: 'test-user',
            content: 'This should be rejected - different path',
          }),
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('PERMISSION_DENIED');
    });
  });
});

