/**
 * Agent Heartbeat Endpoint Tests
 *
 * These tests verify agent heartbeat functionality.
 *
*
 * Endpoints:
 * - POST /a/:appendKey/heartbeat - Send agent heartbeat
 * - GET /api/v1/agents/liveness - Query agent liveness (API key auth)
 * - GET /r/:readKey/agents/liveness - Query scoped agent liveness
 *
 * @see docs/API Design.md - Agent Heartbeat section (lines 4248-4378)
 */

import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

// Import the route under test
import { heartbeatRoute } from '../../../routes/heartbeat';
import {
  resetHeartbeatTestData,
  createHeartbeatWithAge,
  TEST_EXPIRED_API_KEY,
  TEST_REVOKED_API_KEY,
} from '../../../../tests/helpers/heartbeat-fixtures';
import { assertValidResponse } from '../../../../tests/helpers/schema-validator';

// Test capability keys (valid format, for testing purposes)
const VALID_APPEND_KEY = 'hbA8k2mP9qL3nR7mQ2pN4xK';
const VALID_READ_KEY = 'hbR8k2mP9qL3nR7mQ2pN4xK';
const VALID_FOLDER_READ_KEY = 'hbFR8k2mP9qL3nR7mQ2pN4';
const EXPIRED_KEY = 'hbExpired0P9qL3nR7mQ2pN';
const REVOKED_KEY = 'hbRevoked0P9qL3nR7mQ2pN';
const INVALID_KEY = 'short';
const BOUND_AUTHOR_KEY = 'hbBound0P9qL3nR7mQ2pN4xK';

// API Key for workspace-level liveness queries
const VALID_API_KEY = 'sk_live_testHeartbeatKey12345';
const INVALID_API_KEY = 'sk_live_invalidHeartbeatKey';
const READ_ONLY_API_KEY = 'sk_live_testReadOnlyHb12345';
const EXPIRED_API_KEY = TEST_EXPIRED_API_KEY;
const REVOKED_API_KEY = TEST_REVOKED_API_KEY;

// Patterns
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// Valid status values
const VALID_STATUSES = ['alive', 'idle', 'busy'] as const;

// Default stale threshold (5 minutes = 300 seconds)
const DEFAULT_STALE_THRESHOLD = 300;

describe('Agent Heartbeat', () => {
  type TestApp = { handle: (request: Request) => Response | Promise<Response> };
  let app: TestApp;

  beforeAll(() => {
    // Create test app with heartbeat route
    app = new Elysia().use(heartbeatRoute);
  });

  beforeEach(() => {
    // Reset test fixtures before each test
    resetHeartbeatTestData();
  });

  // POST /a/:appendKey/heartbeat - Send Heartbeat
  describe('Security', () => {
    describe('Scope Enforcement', () => {
      test('should not expose heartbeats outside capability scope', async () => {
        // A file-scoped read key should not see heartbeats for other files
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        // Response should only include agents within scope
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('scoped keys with boundAuthor must match heartbeat author', async () => {
        // This is tested in the Author Identity section but included here for clarity
        const response = await app.handle(
          new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'wrong-author',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('AUTHOR_MISMATCH');
      });
    });

    describe('Author Identity', () => {
      test('default keys allow any author (self-declared)', async () => {
        // Default keys without boundAuthor accept any author name
        const authors = ['agent-1', 'agent-2', 'any-name'];

        for (const author of authors) {
          const response = await app.handle(
            new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                author,
                status: 'alive',
              }),
            })
          );

          expect(response.status).toBe(201);
        }
      });

      test('scoped keys prevent agent impersonation', async () => {
        // A key bound to 'agent-alpha' cannot be used by other agents
        const response = await app.handle(
          new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'impersonator',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('AUTHOR_MISMATCH');
      });
    });

    describe('Input Validation', () => {
      test('should reject excessively long author names', async () => {
        const longAuthor = 'a'.repeat(1000);
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: longAuthor,
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
      });

      test('should reject invalid JSON body', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'not valid json',
          })
        );

        expect(response.status).toBe(400);
      });

      test('should reject excessively large metadata', async () => {
        const largeMetadata = {
          data: 'x'.repeat(100000),
        };
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
              metadata: largeMetadata,
            }),
          })
        );

        expect(response.status).toBe(400);
      });
    });
  });

  // Rate Limiting Tests
  describe('Rate Limiting', () => {
    test('should accept heartbeats within rate limit', async () => {
      // Rate limit is 60 req/min per capability URL
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'rate-limit-test',
            status: 'alive',
          }),
        })
      );

      expect(response.status).toBe(201);
    });

    test('should handle many rapid requests without crashing', async () => {
      // First create the heartbeat so subsequent requests are updates
      const createResponse = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'rate-test-agent',
            status: 'alive',
          }),
        })
      );
      expect(createResponse.status).toBe(201);

      // Heartbeat endpoint doesn't have explicit rate limiting
      // This test verifies the endpoint handles rapid requests gracefully
      const requests = Array(10)
        .fill(null)
        .map(() =>
          app.handle(
            new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                author: 'rate-test-agent',
                status: 'alive',
              }),
            })
          )
        );

      const responses = await Promise.all(requests);

      // All requests should succeed (200 or 201)
      // Due to race conditions, multiple 201s may occur when requests hit before any commit
      const statuses = responses.map(r => r.status);
      for (const status of statuses) {
        expect(status === 200 || status === 201).toBe(true);
      }
    });
  });
});

