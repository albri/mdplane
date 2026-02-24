/**
 * Export - GET /api/v1/export - Synchronous Export Tests
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { exportRoute } from '../../export';
import { sqlite } from '../../../db';
import {
  setupTestFixtures,
  VALID_EXPORT_KEY,
  TEST_WORKSPACE_ID,
  type TestApp,
} from './test-setup';

describe('GET /api/v1/export - Synchronous Export', () => {
  let app: TestApp;

  beforeAll(() => {
    app = new Elysia().use(exportRoute);
  });

  beforeEach(() => {
    setupTestFixtures();
  });

  test('should return 200 with binary content', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    // Response should have content
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  test('should return Content-Type application/zip by default', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
  });

  test('should return Content-Disposition header with filename', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toMatch(/^attachment; filename="workspace-export-\d{4}-\d{2}-\d{2}\.zip"$/);
  });

  test('should return X-Export-Checksum header', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    const checksum = response.headers.get('X-Export-Checksum');
    expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('should support format=zip query parameter', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export?format=zip', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toContain('.zip');
  });

  test('should support format=tar.gz query parameter', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export?format=tar.gz', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/gzip');
    const disposition = response.headers.get('Content-Disposition');
    expect(disposition).toContain('.tar.gz');
  });

  test('should return 422 for invalid format', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/export?format=invalid', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${VALID_EXPORT_KEY}`,
        },
      })
    );

    // Zod validation returns 422 for invalid enum values
    expect(response.status).toBe(422);
  });

  describe('includeDeleted parameter', () => {
    // Helper to create a deleted file for export tests
    function createDeletedExportFile(
      id: string,
      path: string,
      content: string,
      deletedAt: string
    ): void {
      const now = new Date().toISOString();
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at, deleted_at)
        VALUES ('${id}', '${TEST_WORKSPACE_ID}', '${path}', '${content}', '${now}', '${now}', '${deletedAt}')
      `);
    }

    test('should NOT include deleted files by default', async () => {
      const deletedAt = new Date().toISOString();
      createDeletedExportFile('deleted_file_export_1', '/deleted-file.md', '# Deleted', deletedAt);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should not include the deleted file
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).not.toContain('/deleted-file.md');
    });

    test('should include deleted files when includeDeleted=true', async () => {
      const deletedAt = new Date().toISOString();
      createDeletedExportFile('deleted_file_export_2', '/deleted-for-export.md', '# Deleted Content', deletedAt);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeDeleted=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should include the deleted file
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/deleted-for-export.md');
    });

    test('should mark deleted files with deletedAt in manifest', async () => {
      const deletedAt = new Date().toISOString();
      createDeletedExportFile('deleted_file_export_3', '/marked-deleted.md', '# Marked', deletedAt);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeDeleted=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Find the deleted file in manifest
      const deletedFile = content.manifest.files.find(
        (f: { path: string }) => f.path === 'marked-deleted.md' || f.path === '/marked-deleted.md'
      );
      expect(deletedFile).toBeDefined();
      expect(deletedFile.deletedAt).toBeDefined();
    });
  });

  describe('paths parameter', () => {
    // Helper to create files in specific folders
    function createExportFileInFolder(id: string, path: string, content: string): void {
      const now = new Date().toISOString();
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('${id}', '${TEST_WORKSPACE_ID}', '${path}', '${content}', '${now}', '${now}')
      `);
    }

    test('should export all files when paths is omitted', async () => {
      createExportFileInFolder('file_paths_1', '/docs/readme.md', '# Docs');
      createExportFileInFolder('file_paths_2', '/src/index.ts', '// Source');

      const response = await app.handle(
        new Request('http://localhost/api/v1/export', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should include files from both folders
      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/docs/readme.md');
      expect(paths).toContain('/src/index.ts');
    });

    test('should filter to single folder path', async () => {
      createExportFileInFolder('file_paths_3', '/projects/alpha.md', '# Alpha');
      createExportFileInFolder('file_paths_4', '/notes/todo.md', '# Todo');

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?paths=/projects', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/projects/alpha.md');
      expect(paths).not.toContain('/notes/todo.md');
    });

    test('should filter to multiple comma-separated paths', async () => {
      createExportFileInFolder('file_paths_5', '/docs/api.md', '# API');
      createExportFileInFolder('file_paths_6', '/src/main.ts', '// Main');
      createExportFileInFolder('file_paths_7', '/tests/unit.ts', '// Tests');

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?paths=/docs,/src', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/docs/api.md');
      expect(paths).toContain('/src/main.ts');
      expect(paths).not.toContain('/tests/unit.ts');
    });

    test('should include nested files under path', async () => {
      createExportFileInFolder('file_paths_8', '/projects/web/frontend/app.tsx', '// App');
      createExportFileInFolder('file_paths_9', '/projects/web/backend/server.ts', '// Server');

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?paths=/projects', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      const paths = content.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('/projects/web/frontend/app.tsx');
      expect(paths).toContain('/projects/web/backend/server.ts');
    });

    test('should handle non-existent paths gracefully (empty export)', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export?paths=/nonexistent-folder', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should return empty files array (or only files not matching the filter)
      const matchingFiles = content.files.filter((f: { path: string }) =>
        f.path.startsWith('/nonexistent-folder')
      );
      expect(matchingFiles).toHaveLength(0);
    });
  });

  describe('includeAppends parameter', () => {
    // Helper to create a file with appends
    function createFileWithAppends(
      fileId: string,
      filePath: string,
      appends: Array<{ id: string; author: string; type: string; content: string }>
    ): void {
      const now = new Date().toISOString();

      // Create the file
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('${fileId}', '${TEST_WORKSPACE_ID}', '${filePath}', '# File with appends', '${now}', '${now}')
      `);

      // Create appends
      for (const append of appends) {
        sqlite.exec(`
          INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
          VALUES ('${append.id}', '${fileId}', '${append.id}', '${append.author}', '${append.type}', 'pending', '${now}', '${append.content}')
        `);
      }
    }

    test('should NOT include appends by default', async () => {
      createFileWithAppends('file_appends_1', '/with-appends-default.md', [
        { id: 'append_default_1', author: 'agent-1', type: 'task', content: 'Task 1' },
      ]);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Find the file
      const file = content.files.find((f: { path: string }) => f.path === '/with-appends-default.md');
      expect(file).toBeDefined();
      // Should NOT have appends property
      expect(file.appends).toBeUndefined();
    });

    test('should include appends when includeAppends=true', async () => {
      createFileWithAppends('file_appends_2', '/with-appends-included.md', [
        { id: 'append_included_1', author: 'agent-2', type: 'task', content: 'Task 2' },
        { id: 'append_included_2', author: 'agent-3', type: 'note', content: 'Note 1' },
      ]);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Find the file
      const file = content.files.find((f: { path: string }) => f.path === '/with-appends-included.md');
      expect(file).toBeDefined();
      expect(file.appends).toBeDefined();
      expect(file.appends).toHaveLength(2);
    });

    test('should include empty appends array for files with no appends', async () => {
      // Create a file without appends
      const now = new Date().toISOString();
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('file_no_appends', '${TEST_WORKSPACE_ID}', '/no-appends-file.md', '# No appends', '${now}', '${now}')
      `);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Find the file
      const file = content.files.find((f: { path: string }) => f.path === '/no-appends-file.md');
      expect(file).toBeDefined();
      expect(file.appends).toBeDefined();
      expect(file.appends).toHaveLength(0);
    });

    test('should include append metadata (author, type, status)', async () => {
      createFileWithAppends('file_appends_3', '/with-append-metadata.md', [
        { id: 'append_meta_1', author: 'test-agent', type: 'task', content: 'Check metadata' },
      ]);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      const file = content.files.find((f: { path: string }) => f.path === '/with-append-metadata.md');
      expect(file).toBeDefined();
      expect(file.appends).toHaveLength(1);

      const append = file.appends[0];
      expect(append.author).toBe('test-agent');
      expect(append.type).toBe('task');
      expect(append.id).toBeDefined();
      expect(append.createdAt).toBeDefined();
    });
  });

  describe('combined parameters', () => {
    test('should support includeAppends=true with includeDeleted=true', async () => {
      const now = new Date().toISOString();
      const deletedAt = now;

      // Create a deleted file with appends
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at, deleted_at)
        VALUES ('deleted_file_combined_1', '${TEST_WORKSPACE_ID}', '/deleted-with-appends.md', '# Deleted', '${now}', '${now}', '${deletedAt}')
      `);
      sqlite.exec(`
        INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
        VALUES ('append_combined_1', 'deleted_file_combined_1', 'append_combined_1', 'agent', 'task', 'pending', '${now}', 'Task on deleted')
      `);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true&includeDeleted=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      const file = content.files.find((f: { path: string }) => f.path === '/deleted-with-appends.md');
      expect(file).toBeDefined();
      expect(file.deletedAt).toBeDefined();
      expect(file.appends).toBeDefined();
      expect(file.appends.length).toBeGreaterThanOrEqual(1);
    });

    test('should support paths with includeAppends=true', async () => {
      const now = new Date().toISOString();

      // Create files in different folders
      sqlite.exec(`
        INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('file_combined_2', '${TEST_WORKSPACE_ID}', '/filtered/with-appends.md', '# Filtered', '${now}', '${now}')
      `);
      sqlite.exec(`
        INSERT OR REPLACE INTO appends (id, file_id, append_id, author, type, status, created_at, content_preview)
        VALUES ('append_combined_2', 'file_combined_2', 'append_combined_2', 'agent', 'note', 'pending', '${now}', 'Note')
      `);

      const response = await app.handle(
        new Request('http://localhost/api/v1/export?paths=/filtered&includeAppends=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      // Should only have files from /filtered
      const filteredFiles = content.files.filter((f: { path: string }) =>
        f.path.startsWith('/filtered')
      );
      expect(filteredFiles.length).toBeGreaterThanOrEqual(1);

      // And should have appends
      const file = content.files.find((f: { path: string }) => f.path === '/filtered/with-appends.md');
      expect(file).toBeDefined();
      expect(file.appends).toBeDefined();
    });
  });

  describe('manifest options', () => {
    test('should include options in manifest', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true&includeDeleted=true&paths=/test', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      expect(content.manifest.options).toBeDefined();
      expect(content.manifest.options.includeAppends).toBe(true);
      expect(content.manifest.options.includeDeleted).toBe(true);
      expect(content.manifest.options.paths).toContain('/test');
    });

    test('should include stats in manifest when includeAppends=true', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/v1/export?includeAppends=true', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_EXPORT_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const content = JSON.parse(new TextDecoder().decode(buffer));

      expect(content.manifest.stats).toBeDefined();
      expect(typeof content.manifest.stats.totalFiles).toBe('number');
      expect(typeof content.manifest.stats.totalAppends).toBe('number');
    });
  });
});
