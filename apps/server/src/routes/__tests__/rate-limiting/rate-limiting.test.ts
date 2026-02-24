import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { createTestApp } from '../../../../tests/helpers/test-app';
import {
  createTestWorkspace,
  createTestFile,
  type TestWorkspace,
} from '../../../../tests/fixtures';
import { resetRateLimitTestState } from '../fixtures/rate-limit-fixtures';

let VALID_READ_KEY: string;
let VALID_APPEND_KEY: string;
let VALID_WRITE_KEY: string;
let testWorkspace: TestWorkspace;

describe('Rate Limiting Route Integration', () => {
  let app: Elysia;

  beforeAll(async () => {
    app = createTestApp({ withRateLimiting: true });
    testWorkspace = await createTestWorkspace(app);
    VALID_READ_KEY = testWorkspace.readKey;
    VALID_APPEND_KEY = testWorkspace.appendKey;
    VALID_WRITE_KEY = testWorkspace.writeKey;
    await createTestFile(app, testWorkspace, '/test-file.md', '# Test File');
  });

  beforeEach(() => {
    resetRateLimitTestState();
  });

  describe('Integration with Real Routes', () => {
    test('should add rate limit headers to read endpoint', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/test-file.md`)
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    test('should add rate limit headers to write endpoint', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/rate-limit-test.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# Test' }),
        })
      );

      expect(response.status).toBe(201);
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });

    test('should add rate limit headers to append endpoint', async () => {
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/test-file.md`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'comment', author: 'test', body: 'Test' }),
        })
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    });
  });
});

