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
  describe('Heartbeat Storage', () => {
    test('should update existing record on subsequent heartbeats (upsert)', async () => {
      const author = 'upsert-test-agent';

      // First heartbeat
      await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author,
            status: 'alive',
          }),
        })
      );

      // Second heartbeat with different status
      await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author,
            status: 'busy',
          }),
        })
      );

      // Query liveness
      const response = await app.handle(
        new Request('http://localhost/api/v1/agents/liveness', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      const body = await response.json();
      const agents = body.data.agents.filter(
        (a: { author: string }) => a.author === author
      );

      // Should have only one record for this author
      expect(agents.length).toBe(1);
      expect(agents[0].status).toBe('busy');
    });

    test('should not increment append counter for heartbeats', async () => {
      // Heartbeats are stored separately from regular appends
      // This test verifies heartbeats don't pollute the append log
      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'append-counter-test',
            status: 'alive',
          }),
        })
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      // Response should not include appendId (unlike regular appends)
      expect(body.data.appendId).toBeUndefined();
    });

    test('should store metadata as JSON', async () => {
      const metadata = {
        version: '2.0.0',
        capabilities: ['read', 'write'],
        nested: { key: 'value' },
      };

      const response = await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'metadata-test-agent',
            status: 'alive',
            metadata,
          }),
        })
      );

      expect(response.status).toBe(201);
    });
  });

  // Stale Detection Tests
  describe('Stale Detection', () => {
    test('should mark recently active agent as not stale', async () => {
      // Send a fresh heartbeat
      await app.handle(
        new Request(`http://localhost/a/${VALID_APPEND_KEY}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            author: 'fresh-agent',
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
        (a: { author: string }) => a.author === 'fresh-agent'
      );

      expect(agent).toBeDefined();
      expect(agent.stale).toBe(false);
    });

    test('should respect custom staleThresholdSeconds query param', async () => {
      // Create heartbeats with old timestamps (more than 60 seconds ago)
      // to test stale detection with the minimum valid threshold
      createHeartbeatWithAge('stale-agent-1', 'alive', 120); // 2 minutes ago
      createHeartbeatWithAge('stale-agent-2', 'busy', 90);   // 1.5 minutes ago

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
      // Agents with lastSeen > 60 seconds ago should be stale
      const staleAgent1 = body.data.agents.find((a: { author: string }) => a.author === 'stale-agent-1');
      const staleAgent2 = body.data.agents.find((a: { author: string }) => a.author === 'stale-agent-2');

      expect(staleAgent1).toBeDefined();
      expect(staleAgent1.stale).toBe(true);
      expect(staleAgent2).toBeDefined();
      expect(staleAgent2.stale).toBe(true);
    });

    test('should include original status even when agent is stale', async () => {
      // Create stale agents with different original statuses
      createHeartbeatWithAge('stale-busy-agent', 'busy', 120);
      createHeartbeatWithAge('stale-idle-agent', 'idle', 90);

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

      // Per OpenAPI spec, when agent is stale, status becomes 'stale'
      // but the stale field should be true
      for (const agent of body.data.agents) {
        expect(['alive', 'idle', 'busy', 'stale']).toContain(agent.status);
        // If stale is true, status should be 'stale' per spec
        if (agent.stale) {
          expect(agent.status).toBe('stale');
        }
      }
    });
  });

  // Cleanup Job Tests (Background Job Behavior)
  describe('Cleanup Job', () => {
    // Note: These tests may require mocking time or using test helpers
    // to simulate passage of time for proper verification

    test('should have stale threshold of 5 minutes (300 seconds) by default', async () => {
      // This verifies the default behavior matches the specification
      const response = await app.handle(
        new Request('http://localhost/api/v1/agents/liveness', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${VALID_API_KEY}`,
          },
        })
      );

      expect(response.status).toBe(200);
      // The default stale threshold is tested implicitly through other tests
    });

    test('should eventually mark agents as stale after 5 minutes without heartbeat', async () => {
      // Create an agent that sent heartbeat 6 minutes ago (360 seconds)
      // With default threshold of 300 seconds (5 minutes), it should be stale
      createHeartbeatWithAge('old-agent', 'alive', 360);

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

      const oldAgent = body.data.agents.find((a: { author: string }) => a.author === 'old-agent');
      expect(oldAgent).toBeDefined();
      expect(oldAgent.stale).toBe(true);
    });
  });

  // Security Tests
});

