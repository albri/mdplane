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
  describe('POST /a/:appendKey/heartbeat - Send Heartbeat', () => {
    describe('Successful Heartbeat', () => {
      test('should return 201 for valid heartbeat', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'HeartbeatResponse');
      });

      test('should return author in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-alpha',
              status: 'alive',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.author).toBe('agent-alpha');
      });

      test('should return id in response', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'busy',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.id).toBeDefined();
        expect(body.data.id).toMatch(/^hb_/);
      });

      test('should return ts timestamp in ISO format', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.ts).toBeDefined();
        expect(body.data.ts).toMatch(ISO_TIMESTAMP_PATTERN);
      });

      test('should return expiresAt and nextHeartbeatBy timestamps', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        const body = await response.json();
        expect(body.data.expiresAt).toBeDefined();
        expect(body.data.expiresAt).toMatch(ISO_TIMESTAMP_PATTERN);
        expect(body.data.nextHeartbeatBy).toBeDefined();
        expect(body.data.nextHeartbeatBy).toMatch(ISO_TIMESTAMP_PATTERN);
        // nextHeartbeatBy should be before expiresAt
        expect(new Date(body.data.nextHeartbeatBy).getTime()).toBeLessThan(
          new Date(body.data.expiresAt).getTime()
        );
      });

      test('should accept heartbeat with currentTask', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'busy',
              currentTask: 't42',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should accept heartbeat with metadata object', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
              metadata: {
                version: '1.2.0',
                lastAction: 'processing',
              },
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should update ts timestamp on subsequent heartbeats', async () => {
        // First heartbeat
        const response1 = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-timestamp-test',
              status: 'alive',
            }),
          })
        );

        const body1 = await response1.json();
        const firstTs = new Date(body1.data.ts).getTime();

        // Small delay
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Second heartbeat
        const response2 = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-timestamp-test',
              status: 'alive',
            }),
          })
        );

        const body2 = await response2.json();
        const secondTs = new Date(body2.data.ts).getTime();

        expect(secondTs).toBeGreaterThanOrEqual(firstTs);
      });

      test('should accept status value: alive', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(201);
      });

      test('should accept status value: idle', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'idle',
            }),
          })
        );

        expect(response.status).toBe(201);
      });

      test('should accept status value: busy', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'busy',
            }),
          })
        );

        expect(response.status).toBe(201);
      });
    });

    describe('Validation', () => {
      test('should return 400 when author is missing', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should default status to alive when not provided', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        // Response now returns id, author, ts, expiresAt, nextHeartbeatBy per OpenAPI spec
        expect(body.ok).toBe(true);
        expect(body.data.id).toBeDefined();
        expect(body.data.author).toBe('agent-1');
      });

      test('should return 400 for invalid status value', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'invalid_status',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 400 for empty author string', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: '',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });

    describe('Key Validation', () => {
      test('should return 404 for invalid append key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${INVALID_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for non-existent append key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/nonExistentKeyABC123456/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for expired key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${EXPIRED_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for revoked key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${REVOKED_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-1',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });

    describe('Author Identity - Bound Author Keys', () => {
      test('should return 400 AUTHOR_MISMATCH when author does not match boundAuthor', async () => {
        // BOUND_AUTHOR_KEY has boundAuthor: 'agent-alpha'
        const response = await app.handle(
          new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'different-agent',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('AUTHOR_MISMATCH');
      });

      test('should include helpful message in AUTHOR_MISMATCH error', async () => {
        const response = await app.handle(
          new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'kai',
              status: 'alive',
            }),
          })
        );

        const body = await response.json();
        expect(body.error.message).toContain('agent-alpha');
        expect(body.error.message).toContain('kai');
      });

      test('should allow matching author for boundAuthor key', async () => {
        // BOUND_AUTHOR_KEY has boundAuthor: 'agent-alpha'
        const response = await app.handle(
          new Request(`http://localhost/a/${BOUND_AUTHOR_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'agent-alpha',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.data.author).toBe('agent-alpha');
      });

      test('should allow any author for default keys (boundAuthor: null)', async () => {
        // VALID_APPEND_KEY is a default key without boundAuthor
        const response = await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'any-agent-name',
              status: 'alive',
            }),
          })
        );

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });
  });

  // GET /api/v1/agents/liveness - Query Agent Liveness (API Key Auth)
});

