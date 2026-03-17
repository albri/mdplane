/**
 * Orchestration Endpoint Tests
 *
 * @see packages/shared/openapi/paths/orchestration.yaml
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Import the route under test
import { orchestrationRoute } from '../../../routes/orchestration';
// Import test fixtures
import { resetOrchestrationTestData } from '../../../../tests/helpers/orchestration-fixtures';

// Test capability keys (valid format, for testing purposes)
const VALID_READ_KEY = 'orchR8k2mP9qL3nR7mQ2pN4';
const VALID_APPEND_KEY = 'orchA8k2mP9qL3nR7mQ2pN4';
const VALID_WRITE_KEY = 'orchW8k2mP9qL3nR7mQ2pN4';
const EXPIRED_KEY = 'orchExpired0P9qL3nR7mQ2';
const REVOKED_KEY = 'orchRevoked0P9qL3nR7mQ2';
const INVALID_KEY = 'short';

// Patterns
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe('Orchestration', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with orchestration route
    app = new Elysia().use(orchestrationRoute);
  });

  beforeEach(() => {
    // Reset test data to ensure consistent state before each test
    resetOrchestrationTestData();
  });

  describe('Response Format', () => {
    test('should return proper JSON content-type header (read-only)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/r/${VALID_READ_KEY}/orchestration`, {
          method: 'GET',
        })
      );

      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });

    test('should return proper JSON content-type header (admin)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/w/${VALID_WRITE_KEY}/orchestration`, {
          method: 'GET',
        })
      );

      const contentType = response.headers.get('Content-Type');
      expect(contentType).not.toBeNull();
      expect(contentType!).toContain('application/json');
    });
  });
});

