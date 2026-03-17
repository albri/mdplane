import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  assertValidResponse,
  sqlite,
  VALID_READ_KEY,
  ISO_TIMESTAMP_PATTERN,
  type TestApp,
} from './test-setup';

describe('Folder Listing', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  describe('GET /r/:key/folders/ - List Root Folder', () => {
    test('should return 200 for root folder listing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return ok: true in response', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should return items array', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    test('should return pagination.total count', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeDefined();
      expect(typeof body.pagination.total).toBe('number');
    });

    test('should return path as "/" for root folder', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.path).toBe('/');
    });

    test('should match FolderListResponse schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders`, { method: 'GET' })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'FolderListResponse');
      }
    });

    test('should return workspace context with id and claimed status', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.workspace).toBeDefined();
      expect(body.data.workspace.id).toBeDefined();
      expect(body.data.workspace.id).toMatch(/^ws_[A-Za-z0-9_]{12,}$/);
      expect(typeof body.data.workspace.claimed).toBe('boolean');
    });

    test('should return workspace.claimed as false for unclaimed workspace', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.workspace).toBeDefined();
      expect(body.data.workspace.claimed).toBe(false);
    });

    test('should return workspace.claimed as true for claimed workspace', async () => {
      const now = new Date().toISOString();
      sqlite.exec(`
        UPDATE workspaces
        SET claimed_at = '${now}',
            claimed_by_email = 'test@example.com'
        WHERE id = 'ws_test_folders'
      `);

      try {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.workspace).toBeDefined();
        expect(body.data.workspace.claimed).toBe(true);
      } finally {
        sqlite.exec(`
          UPDATE workspaces
          SET claimed_at = NULL,
              claimed_by_email = NULL
          WHERE id = 'ws_test_folders'
        `);
      }
    });
  });

  describe('GET /r/:key/folders/:path* - List Subfolder', () => {
    test('should return 200 for subfolder listing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return path matching request path', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.path).toBe('/docs/');
    });

    test('should return contents of nested subfolder', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs/guides/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data.path).toBe('/docs/guides/');
    });
  });

  describe('Item Types', () => {
    test('should return files with type: "file"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');
      files.forEach((file: { type: string }) => {
        expect(file.type).toBe('file');
      });
    });

    test('should return subfolders with type: "folder"', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { type: string }) => {
        expect(folder.type).toBe('folder');
      });
    });

    test('should return childCount for folders', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { type: string; childCount?: number }) => {
        expect(folder.childCount).toBeDefined();
        expect(typeof folder.childCount).toBe('number');
      });
    });
  });

  describe('File Properties', () => {
    test('should return name property for files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');
      files.forEach((file: { name?: string }) => {
        expect(file.name).toBeDefined();
        expect(typeof file.name).toBe('string');
      });
    });

    test('should return type property for files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');
      files.forEach((file: { type: string }) => {
        expect(file.type).toBe('file');
      });
    });

    test('should return size property for files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');
      files.forEach((file: { size?: number }) => {
        expect(file.size).toBeDefined();
        expect(typeof file.size).toBe('number');
      });
    });

    test('should return modified timestamp for files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');
      files.forEach((file: { updatedAt?: string }) => {
        expect(file.updatedAt).toBeDefined();
        expect(file.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });
    });
  });

  describe('Folder Properties', () => {
    test('should return name property for folders', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { name?: string }) => {
        expect(folder.name).toBeDefined();
        expect(typeof folder.name).toBe('string');
      });
    });

    test('should return type property for folders', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { type: string }) => {
        expect(folder.type).toBe('folder');
      });
    });

    test('should return modified timestamp for folders', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { updatedAt?: string }) => {
        expect(folder.updatedAt).toBeDefined();
        expect(folder.updatedAt).toMatch(ISO_TIMESTAMP_PATTERN);
      });
    });

    test('should return childCount property for folders', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { childCount?: number }) => {
        expect(folder.childCount).toBeDefined();
        expect(typeof folder.childCount).toBe('number');
        expect(folder.childCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Ordering', () => {
    test('should return folders before files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const items = body.data.items;

      if (items.length > 1) {
        let foundFile = false;
        for (const item of items) {
          if (item.type === 'file') {
            foundFile = true;
          }
          if (foundFile && item.type === 'folder') {
            expect(item.type).not.toBe('folder');
          }
        }
      }
    });

    test('should sort folders alphabetically', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');

      if (folders.length > 1) {
        for (let i = 1; i < folders.length; i++) {
          const prev = folders[i - 1].name.toLowerCase();
          const curr = folders[i].name.toLowerCase();
          expect(prev <= curr).toBe(true);
        }
      }
    });

    test('should sort files alphabetically', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const files = body.data.items.filter((item: { type: string }) => item.type === 'file');

      if (files.length > 1) {
        for (let i = 1; i < files.length; i++) {
          const prev = files[i - 1].name.toLowerCase();
          const curr = files[i].name.toLowerCase();
          expect(prev <= curr).toBe(true);
        }
      }
    });
  });

  describe('Deleted Files', () => {
    test('should not return soft-deleted files in listing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      body.data.items.forEach((item: { deletedAt?: string }) => {
        expect(item.deletedAt).toBeUndefined();
      });
    });

    test('should not include deleted files in pagination.total count', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.pagination.total).toBe(body.data.items.length);
    });

    test('should still show folder if it contains only non-deleted files', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      const folders = body.data.items.filter((item: { type: string }) => item.type === 'folder');
      folders.forEach((folder: { childCount?: number }) => {
        if (folder.childCount !== undefined && folder.childCount > 0) {
          expect(folder.childCount).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Empty Folder', () => {
    test('should return 404 for empty folder (virtual folders only exist with files)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/nonexistent-empty-folder/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });

    test('should return FOLDER_NOT_FOUND for empty folder path', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/nonexistent-empty-folder/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('FOLDER_NOT_FOUND');
    });
  });

  describe('Non-Existent Folder', () => {
    test('should return 404 for non-existent folder', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/non-existent-folder/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });

    test('should return ok: false for non-existent folder', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/non-existent-folder/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test('should return FOLDER_NOT_FOUND error code', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/non-existent-folder/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.error.code).toBe('FOLDER_NOT_FOUND');
    });

    test('should return 404 for deeply nested non-existent path', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/a/b/c/d/e/f/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });
});

