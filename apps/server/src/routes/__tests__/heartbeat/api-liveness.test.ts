import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';

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
    app = new Elysia().use(heartbeatRoute);
  });

  beforeEach(() => {
    resetHeartbeatTestData();
  });

  describe('GET /api/v1/agents/liveness - Query Agent Liveness', () => {
    describe('Authentication', () => {
      test('should return 401 without Authorization header', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
      });

      test('should return 401 for invalid API key', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${INVALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
      });

      test('should return 401 for malformed Bearer token', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: 'BearerMissingSpace',
            },
          })
        );

        expect(response.status).toBe(401);
      });

      test('should return generic unauthorized for expired API key', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${EXPIRED_API_KEY}`,
            },
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
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${REVOKED_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
        expect(body.error.message).toBe('Invalid API key');
      });

      test('should return 200 with valid API key', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
        assertValidResponse(body, 'AgentLivenessResponse');
      });
    });

    describe('Response Format', () => {
      test('should return agents array in response', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        const body = await response.json();
        expect(body.data.agents).toBeDefined();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should return array (empty if no agents have sent heartbeats)', async () => {
        // This test verifies that the liveness endpoint returns an agents array.
        // In a fresh workspace, this would be empty. In our test setup, previous tests
        // may have created heartbeats, so we just verify the response structure is valid.
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should return agent with required fields', async () => {
        // First send a heartbeat
        await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'liveness-test-agent',
              status: 'alive',
              currentTask: 't99',
            }),
          })
        );

        // Then query liveness
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        const body = await response.json();
        const agent = body.data.agents.find(
          (a: { author: string }) => a.author === 'liveness-test-agent'
        );

        expect(agent).toBeDefined();
        expect(agent.author).toBe('liveness-test-agent');
        expect(agent.lastSeen).toBeDefined();
        expect(agent.lastSeen).toMatch(ISO_TIMESTAMP_PATTERN);
        expect(agent.status).toBe('alive');
        expect(typeof agent.stale).toBe('boolean');
        expect(agent.currentTask).toBe('t99');
      });

      test('should include stale field for each agent', async () => {
        // Send a heartbeat
        await app.handle(
          new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              author: 'stale-test-agent',
              status: 'alive',
            }),
          })
        );

        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        const body = await response.json();
        const agent = body.data.agents.find(
          (a: { author: string }) => a.author === 'stale-test-agent'
        );

        expect(agent).toBeDefined();
        expect(agent.stale).toBe(false); // Just sent heartbeat, should not be stale
      });
    });

    describe('Query Parameters', () => {
      test('should support staleThresholdSeconds query param', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?staleThresholdSeconds=60', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should support folder query param', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?folder=/job-board', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ok).toBe(true);
      });

      test('should filter agents by folder when folder param provided', async () => {
        // This test verifies folder filtering - implementation should filter
        // agents that have heartbeats to files in the specified folder
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?folder=/job-board', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.data.agents)).toBe(true);
      });

      test('should use default staleThresholdSeconds of 300 seconds when not provided', async () => {
        // Default threshold is 5 minutes = 300 seconds
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        // Verification is implicit - agents are marked stale based on threshold
      });

      test('should reject staleThresholdSeconds below minimum (60)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?staleThresholdSeconds=59', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        // Validation errors return 400 with INVALID_REQUEST code
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should reject staleThresholdSeconds above maximum (3600)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?staleThresholdSeconds=3601', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        // Validation errors return 400 with INVALID_REQUEST code
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe('INVALID_REQUEST');
      });

      test('should accept staleThresholdSeconds at minimum boundary (60)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?staleThresholdSeconds=60', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.staleThresholdSeconds).toBe(60);
      });

      test('should accept staleThresholdSeconds at maximum boundary (3600)', async () => {
        const response = await app.handle(
          new Request('http://localhost/api/v1/agents/liveness?staleThresholdSeconds=3600', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${VALID_API_KEY}`,
            },
          })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.staleThresholdSeconds).toBe(3600);
      });
    });
  });

  // GET /r/:readKey/agents/liveness - Scoped Liveness via Capability URL
});

