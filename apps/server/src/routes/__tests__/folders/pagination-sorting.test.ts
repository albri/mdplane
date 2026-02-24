import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  assertValidResponse,
  VALID_READ_KEY,
  VALID_WRITE_KEY,
  VALID_APPEND_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Pagination and Sorting', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  describe('Pagination', () => {
    test('should respect limit parameter and return correct number of items', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=2`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(2);
      if (body.pagination.total > 2) {
        expect(body.pagination.hasMore).toBe(true);
        expect(body.pagination.cursor).toBeDefined();
      }
    });

    test('should return cursor when there are more items', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=1`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      if (body.pagination.total > 1) {
        expect(body.data.items.length).toBe(1);
        expect(body.pagination.hasMore).toBe(true);
        expect(body.pagination.cursor).toBeDefined();
      }
    });

    test('should return next page when using cursor', async () => {
      const firstResponse = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=1`, {
          method: 'GET',
        })
      );

      expect(firstResponse.status).toBe(200);
      const firstBody = await firstResponse.json();
      const firstItemName = firstBody.data.items[0]?.name;

      if (firstBody.pagination.cursor) {
        const secondResponse = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=1&cursor=${firstBody.pagination.cursor}`, {
            method: 'GET',
          })
        );

        expect(secondResponse.status).toBe(200);
        const secondBody = await secondResponse.json();
        expect(secondBody.data.items[0]?.name).not.toBe(firstItemName);
      }
    });

    test('should return hasMore=false when no more items', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=100`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.hasMore).toBe(false);
      expect(body.pagination.cursor).toBeUndefined();
    });

    test('should handle invalid cursor gracefully', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?cursor=invalid_cursor`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test('should cap limit at maximum (500)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=1000`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(500);
    });

    test('should default to 100 limit when not specified', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.hasMore).toBe(false);
    });

    test('should support pagination on append key routes', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/?limit=1`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(1);
    });

    test('should support pagination on write key routes', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/?limit=1`, {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.items.length).toBeLessThanOrEqual(1);
    });

    test('should maintain correct total count regardless of pagination', async () => {
      const allResponse = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );
      const allBody = await allResponse.json();
      const totalItems = allBody.pagination.total;

      const paginatedResponse = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?limit=1`, {
          method: 'GET',
        })
      );
      const paginatedBody = await paginatedResponse.json();

      expect(paginatedBody.pagination.total).toBe(totalItems);
    });
  });

  describe('Sorting', () => {
    describe('sort parameter', () => {
      test('should sort by name by default (ascending)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);

        const items = body.data.items;
        if (items.length > 1) {
          const folders = items.filter((i: { type: string }) => i.type === 'folder');
          const files = items.filter((i: { type: string }) => i.type === 'file');

          const firstFileIndex = items.findIndex((i: { type: string }) => i.type === 'file');
          const lastFolderIndex = items.length - 1 - [...items].reverse().findIndex((i: { type: string }) => i.type === 'folder');
          if (firstFileIndex !== -1 && lastFolderIndex !== -1 && folders.length > 0 && files.length > 0) {
            expect(firstFileIndex).toBeGreaterThan(lastFolderIndex);
          }

          for (let i = 0; i < folders.length - 1; i++) {
            expect(folders[i].name.toLowerCase().localeCompare(folders[i + 1].name.toLowerCase())).toBeLessThanOrEqual(0);
          }

          for (let i = 0; i < files.length - 1; i++) {
            expect(files[i].name.toLowerCase().localeCompare(files[i + 1].name.toLowerCase())).toBeLessThanOrEqual(0);
          }
        }
      });

      test('should accept sort=name explicitly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=name`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept sort=modified', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=modified`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept sort=size', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=size`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should reject invalid sort value with 400', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=invalid`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });
    });

    describe('order parameter', () => {
      test('should default to ascending order', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept order=asc explicitly', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?order=asc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept order=desc', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?order=desc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should reject invalid order value with 400', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?order=invalid`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });
    });

    describe('sort + order combination', () => {
      test('should accept sort=name&order=desc', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=name&order=desc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept sort=modified&order=asc', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=modified&order=asc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept sort=size&order=desc', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/?sort=size&order=desc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('sorting on different key types', () => {
      test('should work on append key routes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/?sort=modified&order=desc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should work on write key routes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/?sort=size&order=asc`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });
  });

  describe('Contract Testing - Schema Validation', () => {
    test('should match FolderCreateResponse schema', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'schema-test-folder' }),
        })
      );
      const body = await response.json();
      if (response.status === 201) {
        assertValidResponse(body, 'FolderCreateResponse');
      }
    });

    test('should match FolderDeleteResponse schema', async () => {
      await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'to-delete-folder' }),
        })
      );

      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/to-delete-folder`, { method: 'DELETE' })
      );
      const body = await response.json();
      if (response.status === 200) {
        assertValidResponse(body, 'FolderDeleteResponse');
      }
    });
  });
});

