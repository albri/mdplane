import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  sqlite,
  assertValidResponse,
  VALID_READ_KEY,
  VALID_WRITE_KEY,
  VALID_APPEND_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Move and Settings', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  describe('POST /w/:key/folders/:path/move - Move Folder', () => {
    function setupSourceFolder(): void {
      const now = new Date().toISOString();
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movesrc/%')`);
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movedest/%')`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movesrc/%'`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movedest/%'`);
      sqlite.exec(`
        INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES
          ('move_file1', 'ws_test_folders', '/movesrc/file1.md', '# File 1', '${now}', '${now}'),
          ('move_file2', 'ws_test_folders', '/movesrc/sub/file2.md', '# File 2', '${now}', '${now}')
      `);
    }

    beforeEach(() => {
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movesrc/%')`);
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movedest/%')`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movesrc/%'`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movedest/%'`);
      sqlite.exec(`DELETE FROM folders WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movesrc%'`);
      sqlite.exec(`DELETE FROM folders WHERE workspace_id = 'ws_test_folders' AND path LIKE '/movedest%'`);
    });

    describe('Success Cases', () => {
      test('should return 200 when moving folder successfully', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movedest' }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.previousPath).toBe('/movesrc');
        expect(body.data.newPath).toBe('/movedest');
        expect(body.data.filesUpdated).toBe(2);
        assertValidResponse(body, 'FolderMoveResponse');
      });

      test('should update file paths after move', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movedest' }),
          })
        );

        const listResponse = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/movedest/`, {
            method: 'GET',
          })
        );
        expect(listResponse.status).toBe(200);
        const listBody = await listResponse.json();
        expect(listBody.data.items.length).toBeGreaterThan(0);
      });
    });

    describe('Error Cases', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request('http://localhost/w/invalidkey12345678901234/folders/src/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for non-write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_READ_KEY}/folders/src/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 400 for root folder move', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
        expect(body.error.message).toContain('root');
      });

      test('should return 404 for empty source folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/emptyfolder/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('FOLDER_NOT_FOUND');
      });

      test('should return 409 when destination has files', async () => {
        setupSourceFolder();
        const now = new Date().toISOString();
        sqlite.exec(`
          INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
          VALUES ('dest_file', 'ws_test_folders', '/movedest/existing.md', '# Existing', '${now}', '${now}')
        `);

        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movedest' }),
          })
        );
        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.error.code).toBe('FOLDER_EXISTS');
      });

      test('should return 400 for path traversal in destination', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '../etc' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should return 400 for path traversal in source', async () => {
        const encodedPath = encodeURIComponent('../etc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should return 400 when moving folder into itself', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movesrc/subfolder' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
        expect(body.error.message).toContain('itself');
      });

      test('should return 400 when source and destination are the same', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movesrc' }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
        expect(body.error.message).toContain('same');
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${EXPIRED_KEY}/folders/src/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${REVOKED_KEY}/folders/src/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/dest' }),
          })
        );
        expect(response.status).toBe(404);
      });
    });

    describe('Response Format', () => {
      test('should return proper response structure', async () => {
        setupSourceFolder();
        const encodedPath = encodeURIComponent('movesrc');
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/${encodedPath}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: '/movedest' }),
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('previousPath');
        expect(body.data).toHaveProperty('newPath');
        expect(body.data).toHaveProperty('filesUpdated');
        expect(typeof body.data.filesUpdated).toBe('number');
      });
    });
  });

  describe('Folder Settings', () => {
    describe('GET /w/:key/folders/:path/settings', () => {
      test('should return 200 with default settings for root folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.inheritSettings).toBeDefined();
        expect(body.data.allowedTypes).toBeDefined();
        expect(Array.isArray(body.data.allowedTypes)).toBe(true);
        assertValidResponse(body, 'GetFolderSettingsResponse');
      });

      test('should return 200 with settings for subfolder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data).toBeDefined();
      });

      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for read-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_READ_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${EXPIRED_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${REVOKED_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for append-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_APPEND_KEY}/folders/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for non-existent folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/nonexistent/settings`, {
            method: 'GET',
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FOLDER_NOT_FOUND');
      });
    });

    describe('PATCH /w/:key/folders/:path/settings', () => {
      test('should return 200 when updating inheritSettings', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.inheritSettings).toBe(false);
      });

      test('should return 200 when updating defaultLabels', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultLabels: ['bug', 'feature', 'urgent'] }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.defaultLabels).toEqual(['bug', 'feature', 'urgent']);
      });

      test('should return 200 when updating allowedTypes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowedTypes: ['task', 'claim', 'response'] }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.allowedTypes).toEqual(['task', 'claim', 'response']);
      });

      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${INVALID_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${EXPIRED_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${REVOKED_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for read-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_READ_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for append-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_APPEND_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 422 for invalid allowedTypes value', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowedTypes: ['invalid_type'] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should partially update settings (preserve existing)', async () => {
        await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ defaultLabels: ['label1', 'label2'] }),
          })
        );

        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowedTypes: ['task', 'claim'] }),
          })
        );

        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.defaultLabels).toEqual(['label1', 'label2']);
        expect(body.data.allowedTypes).toEqual(['task', 'claim']);
      });

      test('should create folder settings for virtual folder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/docs/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inheritSettings: false }),
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.inheritSettings).toBe(false);
      });
    });
  });
});

