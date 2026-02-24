import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createFoldersTestApp,
  resetTestFolders,
  VALID_READ_KEY,
  VALID_WRITE_KEY,
  VALID_APPEND_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Security', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createFoldersTestApp();
  });

  beforeEach(() => {
    resetTestFolders();
  });

  describe('Permission Checks', () => {
    describe('Valid Keys', () => {
      test('should return 200 for read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });

      test('should return 200 for append key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });

      test('should return 200 for write/admin key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/w/${VALID_WRITE_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('Invalid Key Format', () => {
      test('should return 404 for invalid key format', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
      });

      test('should return INVALID_KEY error code for invalid key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/folders/`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for empty key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r//folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
      });

      test('should return 404 for key with special characters', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/x8k2mP9qL3nR7mQ2pN4x!@/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_KEY');
      });
    });

    describe('Expired Key', () => {
      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
      });

      test('should return KEY_EXPIRED error code for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/folders/`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_EXPIRED');
      });
    });

    describe('Revoked Key', () => {
      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/folders/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
      });

      test('should return KEY_REVOKED error code for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/folders/`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });

  describe('Path Validation', () => {
    describe('Directory Traversal Prevention', () => {
      test('should reject paths with ".."', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/../etc/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject encoded ".." traversal attempts', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/%2e%2e/etc/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject mid-path ".." traversal', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/valid/path/../../../etc/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Null Byte Injection Prevention', () => {
      test('should reject paths with null bytes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/path%00/`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Path Normalization', () => {
      test('should normalize double slashes in path', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs//guides/`, {
            method: 'GET',
          })
        );

        expect(response.status).not.toBe(400);
        if (response.status === 404) {
          const body = await response.json();
          expect(body.ok).toBe(false);
          expect(body.error.code).toBe('FOLDER_NOT_FOUND');
        } else {
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.data.path).toBe('/docs/guides/');
        }
      });

      test('should handle paths without trailing slash', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/folders/docs`, {
            method: 'GET',
          })
        );

        expect(response.status).not.toBe(400);
      });
    });
  });

  describe('Response Format', () => {
    test('should return proper JSON content-type header', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });

    test('should return consistent response envelope structure', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body).toHaveProperty('ok');
      expect(body).toHaveProperty('data');
    });

    test('should return data with required folder listing fields', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/folders/`, {
          method: 'GET',
        })
      );

      const body = await response.json();
      expect(body.data).toHaveProperty('path');
      expect(body.data).toHaveProperty('items');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination).toHaveProperty('total');
    });
  });
});

