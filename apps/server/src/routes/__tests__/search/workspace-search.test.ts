import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  assertValidResponse,
  sqlite,
  VALID_API_KEY,
  EXPIRED_API_KEY,
  REVOKED_API_KEY,
  ISO_TIMESTAMP_PATTERN,
  type TestApp,
} from './test-setup';

describe('Workspace Search', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('GET /api/v1/search - Workspace Search', () => {
    describe('Authentication', () => {
      test('should require API key (401 without)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should return generic unauthorized for expired API key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=test`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${EXPIRED_API_KEY}` },
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Invalid API key');
      });

      test('should return generic unauthorized for revoked API key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=test`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${REVOKED_API_KEY}` },
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Invalid API key');
      });

      test('should accept valid API key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=test`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'SearchWorkspaceResponse');
        expect(body.ok).toBe(true);
      });
    });

    describe('Search Filters', () => {
      test('should filter by type (?type=task)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?type=task`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { type: string }) => {
          expect(result.type).toBe('task');
        });
      });

      test('should filter by status (?status=pending)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?status=pending`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { status?: string }) => {
          if (result.status) {
            expect(result.status).toBe('pending');
          }
        });
      });

      test('should filter by author (?author=jordan)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?author=jordan`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { author?: string }) => {
          if (result.author) {
            expect(result.author).toBe('jordan');
          }
        });
      });

      test('should filter by folder (?folder=/projects)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?folder=/projects`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { file: { id: string; path: string } }) => {
          expect(result.file.path).toMatch(/^\/projects\//);
        });
      });

      test('should support full-text search (?q=keyword)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=authentication`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.results).toBeDefined();
      });
    });

    describe('Pagination', () => {
      test('should support pagination (?limit=50&cursor=abc)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?limit=50`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pagination).toBeDefined();
        expect(body.data.total).toBeDefined();
      });

      test('should respect limit parameter', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?limit=5`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        const body = await response.json();
        expect(body.data.results.length).toBeLessThanOrEqual(5);
      });
    });

    describe('Response Format', () => {
      test('should return proper response structure', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?type=task`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.results).toBeDefined();
        if (body.data.results.length > 0) {
          const result = body.data.results[0];
          expect(result.file).toBeDefined();
          expect(result.id).toBeDefined();
          expect(result.type).toBeDefined();
          expect(result.createdAt).toMatch(ISO_TIMESTAMP_PATTERN);
        }
      });
    });

    describe('File Content Search', () => {
      test('should return file results when query matches markdown content', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=Gamma%20Project`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'SearchResponse');

        const fileHits = (body.data.results as Array<{ type: string; file?: { path: string } }>).filter(
          (r) => r.type === 'file'
        );
        expect(fileHits.length).toBeGreaterThan(0);
        expect(fileHits.some((r) => r.file?.path === '/projects/gamma/readme.md')).toBe(true);
      });

      test('should exclude deleted files from file-content search results', async () => {
        sqlite.exec("UPDATE files SET deleted_at = '2026-01-01T00:00:00Z' WHERE id = 'file_3'");

        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?q=Gamma%20Project`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'SearchResponse');

        const hasGamma = (body.data.results as Array<{ file?: { path: string } }>).some(
          (r) => r.file?.path === '/projects/gamma/readme.md'
        );
        expect(hasGamma).toBe(false);
      });
    });
  });
});

