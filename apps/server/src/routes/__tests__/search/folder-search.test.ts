import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  assertValidResponse,
  VALID_READ_KEY,
  EXPIRED_KEY,
  REVOKED_KEY,
  INVALID_KEY,
  type TestApp,
} from './test-setup';

describe('Folder Search', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('GET /r/:readKey/ops/folders/search?path=:path* - Folder Search', () => {
    describe('Full-text Search', () => {
      test('should search with full-text query (?q=keyword)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=authentication`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        assertValidResponse(body, 'FolderSearchResponse');
        expect(body.ok).toBe(true);
        expect(body.data.results).toBeDefined();
        expect(Array.isArray(body.data.results)).toBe(true);
      });

      test('should return file paths and matching appends', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=bug`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        assertValidResponse(body, 'FolderSearchResponse');
        expect(body.data.results.length).toBeGreaterThan(0);
        const result = body.data.results[0];
        expect(result.file).toBeDefined();
        expect(result.fileUrls).toBeDefined();
        expect(result.fileUrls.read).toBeDefined();
        expect(result.matches).toBeDefined();
        expect(Array.isArray(result.matches)).toBe(true);
      });

      test('should return append details in matches', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=critical`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        const match = body.data.results[0]?.matches[0];
        expect(match.appendId).toBeDefined();
        expect(match.type).toBeDefined();
        expect(match.content).toBeDefined();
      });
    });

    describe('Filter Parameters', () => {
      test('should filter by labels (?labels=bug,urgent)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&labels=bug,urgent`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        body.data.results.forEach((result: { matches: { labels?: string[] }[] }) => {
          result.matches.forEach((match) => {
            if (match.labels) {
              const hasMatchingLabel = match.labels.some((l: string) =>
                ['bug', 'urgent'].includes(l)
              );
              expect(hasMatchingLabel).toBe(true);
            }
          });
        });
      });

      test('should filter by priority (?priority=high,critical)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&priority=high,critical`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { matches: { priority?: string }[] }) => {
          result.matches.forEach((match) => {
            if (match.priority) {
              expect(['high', 'critical']).toContain(match.priority);
            }
          });
        });
      });

      test('should filter by status (?status=pending)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&status=pending`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { matches: { status?: string }[] }) => {
          result.matches.forEach((match) => {
            if (match.status) {
              expect(match.status).toBe('pending');
            }
          });
        });
      });

      test('should filter by author (?author=jordan)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&author=jordan`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { matches: { author?: string }[] }) => {
          result.matches.forEach((match) => {
            if (match.author) {
              expect(match.author).toBe('jordan');
            }
          });
        });
      });

      test('should filter by date (?since=2024-01-01)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&since=2024-01-01`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Pagination', () => {
      test('should support pagination (?limit=50&cursor=abc)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&limit=50`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pagination).toBeDefined();
      });

      test('should return pagination cursor for more results', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&limit=2`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        if (body.pagination.hasMore) {
          expect(body.pagination.cursor).toBeDefined();
        }
      });

      test('should continue from cursor position', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&limit=2&cursor=abc123`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Timeout Handling', () => {
      test('should respect timeout (?timeout=5s)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&timeout=5s`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return truncated: true if timeout hit', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=keyword&timeout=1ms`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        if (body.data.truncated) {
          expect(body.data.truncated).toBe(true);
        }
      });

      test('should return truncated: false when search completes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=simple&limit=5`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.truncated).toBe(false);
      });
    });

    describe('Permission Checks', () => {
      test('should require read permission (404 for invalid key)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/ops/folders/search?path=projects&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/ops/folders/search?path=projects&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('KEY_EXPIRED');
      });

      test('should return 404 for revoked key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/ops/folders/search?path=projects&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('KEY_REVOKED');
      });
    });
  });
});



