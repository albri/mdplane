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
  describe('GET /r/:readKey/agents/liveness - Scoped Liveness', () => {
    describe('Successful Query', () => {
      test('should return 200 with valid read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should return agents array', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(body.data.agents).toBeDefined();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should return agents specific to the key scope', async () => {
        // File-scoped read key should only return agents for that file
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_READ_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        const body = await response.json();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should return agents for folder scope with folder read key', async () => {
        // Folder-scoped read key should return agents for files in folder
        const response = await app.handle(
          new Request(`http://localhost/r/${VALID_FOLDER_READ_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });
    });

    describe('Query Parameters', () => {
      test('should support staleThresholdSeconds query param', async () => {
        const response = await app.handle(
          new Request(
            `http://localhost/r/${VALID_READ_KEY}/agents/liveness?staleThresholdSeconds=120`,
            {
              method: 'GET',
            }
          )
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });
    });

    describe('Key Validation', () => {
      test('should return 404 for invalid read key', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${INVALID_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_KEY');
      });

      test('should return 404 for expired key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${EXPIRED_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 404 for revoked key (capability URL security)', async () => {
        const response = await app.handle(
          new Request(`http://localhost/r/${REVOKED_KEY}/agents/liveness`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });
    });
  });

  // Heartbeat Storage Tests
});

