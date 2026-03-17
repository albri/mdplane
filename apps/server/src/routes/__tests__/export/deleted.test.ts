import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { exportRoute } from '../../export';
import { sqlite } from '../../../db';
import {
  setupTestFixtures,
  assertValidResponse,
  VALID_EXPORT_KEY,
  VALID_READ_ONLY_KEY,
  INVALID_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  MALFORMED_KEY,
  TEST_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  ISO_TIMESTAMP_PATTERN,
  type TestApp,
} from './test-setup';

describe('GET /api/v1/deleted - List Deleted Files', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(exportRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  // Helper to create a deleted file
  function createDeletedFile(
    id: string,
    path: string,
    content: string,
    deletedAt: string,
    workspaceId: string = TEST_WORKSPACE_ID
  ): void {
    const now = new Date().toISOString();
    sqlite.exec(`
      INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at, deleted_at)
      VALUES ('${id}', '${workspaceId}', '${path}', '${content}', '${now}', '${now}', '${deletedAt}')
    `);
  }

  // Helper to cleanup deleted test files
  function cleanupDeletedFiles(): void {
    // Delete appends first (FK constraint requires child records deleted before parent)
    sqlite.exec(`DELETE FROM appends WHERE file_id LIKE 'deleted_file_%'`);
    sqlite.exec(`DELETE FROM files WHERE id LIKE 'deleted_file_%'`);
  }

  test('should return 401 without Bearer token', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with invalid API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${INVALID_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 403 when API key missing export scope', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_READ_ONLY_KEY}`,
        },
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });

  test('should return 200 with empty files array when no deleted files', async () => {
    cleanupDeletedFiles();

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.files).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.total).toBe(0);
    assertValidResponse(body, 'ListDeletedFilesResponse');
  });

  test('should return deleted files with correct shape', async () => {
    cleanupDeletedFiles();
    const deletedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    createDeletedFile('deleted_file_1', '/old-notes.md', '# Old Notes', deletedAt);

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.files).toHaveLength(1);

    const file = body.data.files[0];
    expect(file.id).toBe('deleted_file_1');
    expect(file.path).toBe('/old-notes.md');
    expect(file.deletedAt).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(file.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
    expect(file.size).toBe(11); // '# Old Notes'.length = 11
  });

  test('should calculate expiresAt as 7 days after deletedAt', async () => {
    cleanupDeletedFiles();
    const deletedAt = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // 1 day ago
    createDeletedFile('deleted_file_1', '/test.md', 'content', deletedAt);

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const file = body.data.files[0];

    const deletedDate = new Date(file.deletedAt);
    const expiresDate = new Date(file.expiresAt);
    const diffDays = (expiresDate.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24);

    expect(diffDays).toBe(7);
  });

  test('should not include files deleted more than 7 days ago', async () => {
    cleanupDeletedFiles();
    const recentDeletedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(); // 3 days ago
    const oldDeletedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(); // 10 days ago

    createDeletedFile('deleted_file_recent', '/recent.md', 'recent', recentDeletedAt);
    createDeletedFile('deleted_file_old', '/old.md', 'old', oldDeletedAt);

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.files).toHaveLength(1);
    expect(body.data.files[0].id).toBe('deleted_file_recent');
  });

  test('should only return files from authenticated workspace', async () => {
    cleanupDeletedFiles();
    const deletedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    createDeletedFile('deleted_file_own', '/own.md', 'own content', deletedAt, TEST_WORKSPACE_ID);
    createDeletedFile('deleted_file_other', '/other.md', 'other content', deletedAt, OTHER_WORKSPACE_ID);

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.files).toHaveLength(1);
    expect(body.data.files[0].id).toBe('deleted_file_own');
  });

  test('should respect limit parameter', async () => {
    cleanupDeletedFiles();
    const deletedAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    for (let i = 1; i <= 5; i++) {
      createDeletedFile(`deleted_file_${i}`, `/file${i}.md`, `content ${i}`, deletedAt);
    }

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted?limit=2', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.files).toHaveLength(2);
    expect(body.pagination.hasMore).toBe(true);
    expect(body.pagination.total).toBe(5);
  });

  test('should support cursor-based pagination', async () => {
    cleanupDeletedFiles();
    // Create files with different deletedAt times
    const now = Date.now();
    for (let i = 1; i <= 5; i++) {
      const deletedAt = new Date(now - 1000 * 60 * 60 * i).toISOString(); // i hours ago
      createDeletedFile(`deleted_file_${i}`, `/file${i}.md`, `content ${i}`, deletedAt);
    }

    // Get first page
    const response1 = await app.handle(
      new Request('http://localhost/api/v1/deleted?limit=2', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response1.status).toBe(200);
    const body1 = await response1.json();
    expect(body1.data.files).toHaveLength(2);
    expect(body1.pagination.hasMore).toBe(true);
    expect(body1.pagination.cursor).toBeDefined();

    // Get second page using cursor
    const response2 = await app.handle(
      new Request(`http://localhost/api/v1/deleted?limit=2&cursor=${encodeURIComponent(body1.pagination.cursor)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response2.status).toBe(200);
    const body2 = await response2.json();
    expect(body2.data.files).toHaveLength(2);

    // Verify no overlap between pages
    const page1Ids = body1.data.files.map((f: { id: string }) => f.id);
    const page2Ids = body2.data.files.map((f: { id: string }) => f.id);
    for (const id of page1Ids) {
      expect(page2Ids).not.toContain(id);
    }
  });

  test('should return 401 with expired API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${EXPIRED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with revoked API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${REVOKED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with malformed API key', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${MALFORMED_KEY}`,
        },
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should order files by deletedAt descending (most recent first)', async () => {
    cleanupDeletedFiles();
    const now = Date.now();

    // Create files with different deletion times
    createDeletedFile('deleted_file_oldest', '/oldest.md', 'oldest', new Date(now - 1000 * 60 * 60 * 6).toISOString());
    createDeletedFile('deleted_file_newest', '/newest.md', 'newest', new Date(now - 1000 * 60 * 60 * 1).toISOString());
    createDeletedFile('deleted_file_middle', '/middle.md', 'middle', new Date(now - 1000 * 60 * 60 * 3).toISOString());

    const response = await app.handle(
      new Request('http://localhost/api/v1/deleted', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.files).toHaveLength(3);

    // Should be ordered newest to oldest
    expect(body.data.files[0].id).toBe('deleted_file_newest');
    expect(body.data.files[1].id).toBe('deleted_file_middle');
    expect(body.data.files[2].id).toBe('deleted_file_oldest');
  });
});

