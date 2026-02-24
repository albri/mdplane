import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  sqlite,
  hashKey,
  assertValidResponse,
  VALID_READ_KEY,
  VALID_WRITE_KEY,
  VALID_APPEND_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Mutations', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  describe('POST /a/:key/folders/:path/copy - Copy File to Folder', () => {
    const TEST_SOURCE_READ_KEY = 'srcR8k2mP9qL3nR7mQ2pN4';
    const TEST_SOURCE_FILE_PATH = '/source/test-source.md';
    const TEST_SOURCE_CONTENT = '# Source File Content\n\nThis is the source file.';

    function setupSourceFile(): void {
      const now = new Date().toISOString();
      const fileId = 'src_file_' + Date.now();
      const keyId = 'src_key_' + Date.now();

      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND path = '${TEST_SOURCE_FILE_PATH}')`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND path = '${TEST_SOURCE_FILE_PATH}'`);
      sqlite.exec(`
        INSERT INTO files (id, workspace_id, path, content, created_at, updated_at)
        VALUES ('${fileId}', 'ws_test_folders', '${TEST_SOURCE_FILE_PATH}', '${TEST_SOURCE_CONTENT}', '${now}', '${now}')
      `);

      const keyHash = hashKey(TEST_SOURCE_READ_KEY);
      sqlite.exec(`DELETE FROM capability_keys WHERE key_hash = '${keyHash}'`);
      sqlite.exec(`
        INSERT INTO capability_keys (
          id, workspace_id, prefix, key_hash, permission, scope_type, scope_path, created_at, expires_at, revoked_at
        ) VALUES (
          '${keyId}', 'ws_test_folders', 'srcR', '${keyHash}',
          'read', 'file', '${TEST_SOURCE_FILE_PATH}', '${now}',
          NULL, NULL
        )
      `);
    }

    beforeEach(() => {
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND (path LIKE '/dest%' OR path LIKE '/perm-%' OR path LIKE '/conflict-%' OR path LIKE '/Dest%' OR path LIKE '/src/%' OR path LIKE '/copied-%'))`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND (path LIKE '/dest%' OR path LIKE '/perm-%' OR path LIKE '/conflict-%' OR path LIKE '/Dest%' OR path LIKE '/src/%' OR path LIKE '/copied-%')`);
      sqlite.exec(`DELETE FROM folders WHERE workspace_id = 'ws_test_folders' AND (path LIKE '/dest%' OR path LIKE '/perm-%' OR path LIKE '/conflict-%' OR path LIKE '/Dest%' OR path LIKE '/src%')`);
    });

    describe('Success Cases', () => {
      test('should return 201 when copying a file successfully', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(201);
      });

      test('should return ok: true in response', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest2/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return CreateFileResponse shape', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest3/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        const body = await response.json();
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.filename).toBeDefined();
        expect(body.data.path).toBeDefined();
        expect(body.data.urls).toBeDefined();
        expect(body.data.urls.read).toBeDefined();
        expect(body.data.urls.append).toBeDefined();
        expect(body.data.urls.write).toBeDefined();
        expect(body.data.createdAt).toBeDefined();
      });

      test('should use source filename when filename is not provided', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest4/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        const body = await response.json();
        expect(body.data.filename).toBe('test-source.md');
      });

      test('should use custom filename when provided', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest5/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY, filename: 'custom-name.md' }),
            }
          )
        );

        const body = await response.json();
        expect(body.data.filename).toBe('custom-name.md');
      });

      test('should copy file content correctly', async () => {
        setupSourceFile();

        const copyResponse = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest6/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(copyResponse.status).toBe(201);
      });

      test('should generate new capability keys for copied file', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest7/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        const body = await response.json();
        expect(body.data.urls.read).not.toContain(TEST_SOURCE_READ_KEY);
      });
    });

    describe('Error Cases', () => {
      test('should return 404 for invalid destination key', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${INVALID_KEY}/folders/Dest123/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: 'someValidSourceKey12345' }),
            }
          )
        );

        expect(response.status).toBe(404);
      });

      test('should return 404 for expired destination key', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${EXPIRED_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: 'someValidSourceKey12345' }),
            }
          )
        );

        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked destination key', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${REVOKED_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: 'someValidSourceKey12345' }),
            }
          )
        );

        expect(response.status).toBe(404);
      });

      test('should return 404 for read-only destination key', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_READ_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 404 for invalid source key', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: INVALID_KEY }),
            }
          )
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('SOURCE_NOT_FOUND');
      });

      test('should return 404 for non-existent source key', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: 'NonExistentKey12345678901234' }),
            }
          )
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('SOURCE_NOT_FOUND');
      });

      test('should return 422 for missing sourceKey', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/src/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }
          )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 409 when file already exists at destination', async () => {
        setupSourceFile();

        const now = new Date().toISOString();
        sqlite.exec(`
          INSERT OR REPLACE INTO files (id, workspace_id, path, content, created_at, updated_at)
          VALUES ('conflict_file', 'ws_test_folders', '/conflict-dest/test-source.md', '# Existing', '${now}', '${now}')
        `);

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/conflict-dest/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_ALREADY_EXISTS');
      });

      test('should return 400 for invalid destination path', async () => {
        setupSourceFile();

        const invalidPath = encodeURIComponent('../etc');
        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/${invalidPath}/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should return 400 for invalid filename', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/dest-invalid/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY, filename: 'invalid/name.md' }),
            }
          )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Permission Checks', () => {
      test('should work with append key', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/perm-append/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(201);
      });

      test('should work with write key', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_WRITE_KEY}/folders/perm-write/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY }),
            }
          )
        );

        expect(response.status).toBe(201);
      });
    });

    describe('Copy to Root Folder', () => {
      test('should copy file to root folder', async () => {
        setupSourceFile();

        const response = await app.handle(
          new Request(
            `http://localhost/a/${VALID_APPEND_KEY}/folders/copy`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceKey: TEST_SOURCE_READ_KEY, filename: 'copied-to-root.md' }),
            }
          )
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.data.path).toBe('/copied-to-root.md');
      });
    });
  });

  describe('POST /a/:key/folders/:path/bulk - Bulk Create Files', () => {
    beforeEach(() => {
      sqlite.exec(`DELETE FROM appends WHERE file_id IN (SELECT id FROM files WHERE workspace_id = 'ws_test_folders' AND (path LIKE '/bulk%' OR path = '/empty-content.md' OR path = '/write-key-bulk.md' OR path = '/async1.md' OR path = '/structure-test.md'))`);
      sqlite.exec(`DELETE FROM files WHERE workspace_id = 'ws_test_folders' AND (path LIKE '/bulk%' OR path = '/empty-content.md' OR path = '/write-key-bulk.md' OR path = '/async1.md' OR path = '/structure-test.md')`);
      sqlite.exec(`DELETE FROM folders WHERE workspace_id = 'ws_test_folders' AND path LIKE '/bulk%'`);
    });

    describe('Success Cases', () => {
      test('should return 201 when bulk creating files successfully', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [
                { filename: 'bulk1.md', content: '# File 1' },
                { filename: 'bulk2.md', content: '# File 2' },
              ],
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.created).toHaveLength(2);
        expect(body.data.created[0].filename).toBe('bulk1.md');
        expect(body.data.created[0].id).toBeDefined();
        expect(body.data.created[0].urls.read).toBeDefined();
        expect(body.data.created[0].urls.append).toBeDefined();
        expect(body.data.created[0].urls.write).toBeDefined();
        assertValidResponse(body, 'FolderBulkCreateResponse');
      });

      test('should return 201 for bulk create in subfolder', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk-test-subfolder/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [
                { filename: 'sub1.md', content: '# Subfolder File 1' },
              ],
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.created).toHaveLength(1);
        expect(body.data.created[0].filename).toBe('sub1.md');
      });

      test('should return 202 for async mode', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk?async=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [{ filename: 'async1.md' }],
            }),
          })
        );
        expect(response.status).toBe(202);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.jobId).toMatch(/^job_/);
      });

      test('should create files with empty content', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [{ filename: 'empty-content.md' }],
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.created[0].filename).toBe('empty-content.md');
      });

      test('should work with write key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_WRITE_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [{ filename: 'write-key-bulk.md', content: '# Created with write key' }],
            }),
          })
        );
        expect(response.status).toBe(201);
      });
    });

    describe('Error Cases', () => {
      test('should return 404 for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${INVALID_KEY}/folders/Bulk123/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'test.md' }] }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${EXPIRED_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'test.md' }] }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${REVOKED_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'test.md' }] }),
          })
        );
        expect(response.status).toBe(404);
      });

      test('should return 404 for read-only key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_READ_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'test.md' }] }),
          })
        );
        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('PERMISSION_DENIED');
        expect(body.error.message).toBe('Insufficient permissions for this operation');
      });

      test('should return 400 for empty files array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 422 for more than 100 files', async () => {
        const files = Array.from({ length: 101 }, (_, i) => ({ filename: `file${i}.md` }));
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 400 for invalid filename with path separator', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'invalid/name.md' }] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should return 400 for filename with path traversal', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: '../etc/passwd' }] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should return 422 for missing files field', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should return 409 when file already exists', async () => {
        await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'existing-bulk.md' }] }),
          })
        );
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'existing-bulk.md' }] }),
          })
        );
        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('FILE_ALREADY_EXISTS');
      });

      test('should return 400 for path traversal in folder path', async () => {
        const invalidPath = encodeURIComponent('../etc');
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/${invalidPath}/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [{ filename: 'test.md' }] }),
          })
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Response Format', () => {
      test('should return proper response structure for sync mode', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [{ filename: 'structure-test.md', content: '# Test' }],
            }),
          })
        );
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('created');
        expect(Array.isArray(body.data.created)).toBe(true);

        const created = body.data.created[0];
        expect(created).toHaveProperty('filename');
        expect(created).toHaveProperty('id');
        expect(created).toHaveProperty('urls');
        expect(created.urls).toHaveProperty('read');
        expect(created.urls).toHaveProperty('append');
        expect(created.urls).toHaveProperty('write');
      });

      test('should return proper response structure for async mode', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/bulk?async=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: [{ filename: 'async-structure.md' }],
            }),
          })
        );
        expect(response.status).toBe(202);
        const body = await response.json();
        expect(body).toHaveProperty('ok', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('jobId');
        expect(typeof body.data.jobId).toBe('string');
      });
    });
  });
});

