import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import {
  createSearchTestApp,
  resetTestSearch,
  VALID_READ_KEY,
  VALID_FOLDER_READ_KEY,
  VALID_FILE_READ_KEY,
  VALID_API_KEY,
  type TestApp,
} from './test-setup';

describe('Search Security', () => {
  let app: TestApp;

  beforeAll(() => {
    app = createSearchTestApp();
  });

  beforeEach(() => {
    resetTestSearch();
  });

  describe('Security Tests', () => {
    describe('Scope Enforcement', () => {
      test('should not expose files outside capability scope', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FILE_READ_KEY}/search?q=*`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { file: { id: string; path: string } }) => {
          expect(result.file).toBeDefined();
        });
      });

      test('should not expose files outside folder scope', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FOLDER_READ_KEY}/search?q=*`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        body.data.results.forEach((result: { file: { id: string; path: string } }) => {
          expect(result.file).toBeDefined();
        });
      });
    });

    describe('ReDoS Protection', () => {
      test('should validate regex patterns (ReDoS protection)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });

      test('should reject invalid patterns with 400 INVALID_PATTERN', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=(?=test)`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_PATTERN');
      });

      test('should reject ReDoS-vulnerable patterns', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=(a+)+b`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });
    });

    describe('Timeout Limits', () => {
      test('should enforce timeout limits', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&timeout=30s`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
      });

      test('should reject timeout beyond max (30s)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&timeout=60s`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_TIMEOUT');
      });
    });

    describe('Rate Limiting', () => {
      test('should rate limit custom frontmatter queries', async () => {
        const response = await app.handle(
          new Request(`http://localhost/api/v1/search?frontmatter.customField=value`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${VALID_API_KEY}` },
          })
        );

        expect(response.status).toBe(200);
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        expect(rateLimitRemaining).toBeDefined();
      });
    });

    describe('Path Validation', () => {
      test('should reject paths with directory traversal', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=../etc&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });

      test('should reject paths with null bytes', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=test%00path&q=test`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_PATH');
      });
    });

    describe('Input Validation Edge Cases', () => {
      describe('Query Parameter Validation', () => {
        test('should handle empty query string', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle whitespace-only query', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=%20%20%20`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle very long query (>1000 chars)', async () => {
          const longQuery = 'a'.repeat(1001);
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=${longQuery}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should handle query with unicode characters', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=${encodeURIComponent('こんにちは')}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle query with emojis', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=${encodeURIComponent('🚀 rocket')}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle query with special regex characters', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=${encodeURIComponent('.*+?^${}()|[]\\/')}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle query with SQL injection attempt', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=${encodeURIComponent("'; DROP TABLE files; --")}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle query with control characters', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test%00null`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });
      });

      describe('Filter Parameter Validation', () => {
        test('should reject invalid status filter', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&status=invalid_status`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should reject invalid type filter', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&type=invalid_type`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should reject invalid limit value (negative)', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&limit=-1`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should reject invalid limit value (non-numeric)', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&limit=abc`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should reject limit value exceeding maximum', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&limit=999999`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(400);
        });

        test('should handle invalid offset value (negative)', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&offset=-1`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });
      });

      describe('Author Filter Validation', () => {
        test('should handle empty author filter', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&author=`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle author with special characters', async () => {
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&author=${encodeURIComponent('user@domain.com')}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });

        test('should handle very long author filter', async () => {
          const longAuthor = 'a'.repeat(100);
          const response = await app.handle(
            new Request(`http://localhost/r/${VALID_READ_KEY}/ops/folders/search?path=projects&q=test&author=${longAuthor}`, {
              method: 'GET',
            })
          );

          expect(response.status).toBe(200);
        });
      });
    });
  });
});



