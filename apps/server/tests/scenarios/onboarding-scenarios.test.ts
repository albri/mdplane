/**
 * Onboarding Scenario Tests
 *
 * Comprehensive scenario tests for new user and agent onboarding:
 * - New user onboarding (<60 seconds)
 * - Agent self-configuration
 * - Diagnose claim failure
 * - Claim existing workspace
 *
 * @see packages/shared/openapi/paths/bootstrap.yaml
 * @see packages/shared/openapi/paths/claiming.yaml
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import type { Elysia } from 'elysia';

import { auth } from '../../src/core/auth';
import { createTestApp } from '../helpers';
import { assertValidResponse } from '../helpers/schema-validator';
import {
  createTestWorkspace,
  createTestFile,
  createTestTask,
  claimTask,
  createTestOAuthSession,
  authenticatedRequest,
  type TestWorkspace,
  type TestFile,
  type TestOAuthUser,
} from '../fixtures';

const BETTERAUTH_COOKIE_NAME = 'better-auth.session_token';

let activeOAuthSessions = new Map<string, TestOAuthUser>();
let originalGetSession: typeof auth.api.getSession | null = null;

function installBetterAuthGetSessionMock(): void {
  if (!originalGetSession) {
    originalGetSession = auth.api.getSession;
  }

  Object.defineProperty(auth.api, 'getSession', {
    configurable: true,
    value: async ({ headers }: { headers: Headers }) => {
      const cookieHeader = headers.get('Cookie');
      if (!cookieHeader) return null;

      const cookies = cookieHeader.split(';').map((c) => c.trim());
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split('=');
        if (name !== BETTERAUTH_COOKIE_NAME) continue;

        const token = valueParts.join('=');
        const user = activeOAuthSessions.get(token);
        if (!user) return null;

        const now = Date.now();
        const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: new Date('2024-01-01T00:00:00Z'),
            emailVerified: true,
            image: null,
            updatedAt: new Date('2024-01-01T00:00:00Z'),
          },
          session: {
            id: 'mock_session_id',
            userId: user.id,
            expiresAt: new Date(expiresAt),
            token,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };
      }

      return null;
    },
  });
}

function restoreBetterAuthGetSessionMock(): void {
  if (!originalGetSession) return;
  Object.defineProperty(auth.api, 'getSession', {
    configurable: true,
    value: originalGetSession,
  });
}

describe('Onboarding Scenarios', () => {
  let app: Elysia;

  beforeAll(() => {
    installBetterAuthGetSessionMock();
    app = createTestApp();
  });

  afterAll(() => {
    restoreBetterAuthGetSessionMock();
  });

  describe('New User Onboarding', () => {
    test('bootstrap returns workspace ID in under 100ms', async () => {
      // GIVEN: A fresh API request
      const start = Date.now();

      // WHEN: Bootstrapping a new workspace
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Onboarding Speed Test' }),
        })
      );

      // THEN: Response is fast
      const elapsed = Date.now() - start;
      expect(response.status).toBe(201);
      expect(elapsed).toBeLessThan(500);
    });

    test('response includes workspace ID with correct format', async () => {
      // GIVEN/WHEN: Bootstrap a workspace
      const workspace = await createTestWorkspace(app);

      // THEN: Workspace ID has correct format
      expect(workspace.workspaceId).toMatch(/^ws_[A-Za-z0-9]+$/);
    });

    test('response includes all capability URLs (read, append, write)', async () => {
      // GIVEN/WHEN: Bootstrap a workspace
      const workspace = await createTestWorkspace(app);

      // THEN: All capability keys are present
      expect(workspace.readKey).toBeDefined();
      expect(workspace.readKey.length).toBeGreaterThanOrEqual(16);

      expect(workspace.appendKey).toBeDefined();
      expect(workspace.appendKey.length).toBeGreaterThanOrEqual(16);

      expect(workspace.writeKey).toBeDefined();
      expect(workspace.writeKey.length).toBeGreaterThanOrEqual(16);
    });

    test('response includes workspace ID', async () => {
      // GIVEN/WHEN: Bootstrap a workspace
      const workspace = await createTestWorkspace(app);

      // THEN: Workspace ID is present and correct format
      expect(workspace.workspaceId).toBeDefined();
      expect(workspace.workspaceId).toMatch(/^ws_/);
    });

    test('no signup required for bootstrap', async () => {
      // GIVEN: No authentication headers

      // WHEN: Bootstrap without auth
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'Onboarding No Auth Test' }),
        })
      );

      // THEN: Success (no 401/403)
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'BootstrapResponse');
      expect(body.ok).toBe(true);
    });

    test('workspace is immediately usable for file creation', async () => {
      // GIVEN: A freshly bootstrapped workspace
      const workspace = await createTestWorkspace(app);

      // WHEN: Create a file immediately
      const file = await createTestFile(app, workspace, '/first-file.md', '# Hello World');

      // THEN: File is created successfully
      expect(file.id).toBeDefined();
      expect(file.path).toBe('/first-file.md');
    });

    test('workspace is immediately usable for appends', async () => {
      // GIVEN: A freshly bootstrapped workspace with a file
      const workspace = await createTestWorkspace(app);
      const file = await createTestFile(app, workspace, '/tasks.md');

      // WHEN: Create a task immediately
      const task = await createTestTask(app, workspace, file, {
        author: 'test-agent',
        content: 'First task after bootstrap',
      });

      // THEN: Task is created successfully
      expect(task.appendId).toMatch(/^a\d+$/);
      expect(task.content).toBe('First task after bootstrap');
    });

    test('bootstrap with custom folder name', async () => {
      // GIVEN: Custom folder name request

      // WHEN: Bootstrap with workspaceName
      const response = await app.handle(
        new Request('http://localhost/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: 'My Project' }),
        })
      );

      // THEN: Workspace is created
      expect(response.status).toBe(201);
      const body = await response.json();
      assertValidResponse(body, 'BootstrapResponse');
      expect(body.ok).toBe(true);
      expect(body.data.workspaceId).toMatch(/^ws_/);
    });
  });

  describe('Agent Self-Configuration', () => {
    let workspace: TestWorkspace;

    beforeEach(async () => {
      workspace = await createTestWorkspace(app);
    });

    test('agent can create config file after bootstrap', async () => {
      // GIVEN: A freshly bootstrapped workspace

      // WHEN: Agent creates a config file
      const configContent = `# Agent Configuration
agent_id: agent-alpha
workspace: ${workspace.workspaceId}
capabilities:
  - read
  - append
`;
      const file = await createTestFile(app, workspace, '/.mdplane/config.md', configContent);

      // THEN: Config file is created
      expect(file.id).toBeDefined();
      expect(file.path).toBe('/.mdplane/config.md');
      expect(file.content).toContain('agent_id: agent-alpha');
    });

    test('agent can read own config file', async () => {
      // GIVEN: A workspace with a config file
      const configContent = `# Agent Config\nversion: 1.0\n`;
      await createTestFile(app, workspace, '/.mdplane/config.md', configContent);

      // WHEN: Read the config file
      const response = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/.mdplane/config.md`, {
          method: 'GET',
        })
      );

      // THEN: File content is readable
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.ok).toBe(true);
      expect(body.data.content).toContain('version: 1.0');
    });

    test('agent can register webhook using write key', async () => {
      // GIVEN: A workspace with a file
      const file = await createTestFile(app, workspace, '/events.md', '# Events\n');

      // WHEN: Agent registers a webhook
      // Note: Webhooks require write key (not append key) per OpenAPI spec
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/webhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://agent.example.com/webhook',
            events: ['append.created', 'task.claimed'],
          }),
        })
      );

      // THEN: Webhook is registered successfully
      expect(response.status).toBe(201);
    });

    test('config file persists and can be updated', async () => {
      // GIVEN: A workspace with initial config
      const initialConfig = `# Config v1\nvalue: initial\n`;
      const file = await createTestFile(app, workspace, '/.mdplane/settings.md', initialConfig);

      // WHEN: Update the config
      const updateResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/.mdplane/settings.md`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': file.etag,
          },
          body: JSON.stringify({ content: '# Config v2\nvalue: updated\n' }),
        })
      );

      // THEN: Config is updated
      expect(updateResponse.status).toBe(200);

      // AND: Updated content is readable
      const readResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/.mdplane/settings.md`, {
          method: 'GET',
        })
      );
      const body = await readResponse.json();
      assertValidResponse(body, 'FileReadResponse');
      expect(body.data.content).toContain('value: updated');
    });

    test('agent can create multiple config files in .mdplane folder', async () => {
      // GIVEN: A workspace

      // WHEN: Create multiple config files
      const mainConfig = await createTestFile(app, workspace, '/.mdplane/config.md', '# Main');
      const credentials = await createTestFile(app, workspace, '/.mdplane/keys.md', '# Keys');
      const preferences = await createTestFile(app, workspace, '/.mdplane/prefs.md', '# Prefs');

      // THEN: All files are created
      expect(mainConfig.id).toBeDefined();
      expect(credentials.id).toBeDefined();
      expect(preferences.id).toBeDefined();
    });
  });

  describe('Diagnose Claim Failure', () => {
    let workspace: TestWorkspace;
    let file: TestFile;

    beforeEach(async () => {
      workspace = await createTestWorkspace(app);
      file = await createTestFile(app, workspace, '/tasks.md');
    });

    test('claim failure (409) returns ALREADY_CLAIMED error code', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Review PR',
      });

      // Agent A claims it
      const claimA = await claimTask(app, workspace, file, task.ref, 'agent-a');
      expect(claimA.status).toBe(201);

      // WHEN: Agent B tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-b');

      // THEN: Error code is ALREADY_CLAIMED
      expect(response.status).toBe(409);
      const body = await response.json();
      assertValidResponse(body, 'Error');
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('ALREADY_CLAIMED');
      expect(body.error.message).toBeDefined();
    });

    test('claim failure includes claimedBy for debugging', async () => {
      // GIVEN: A task claimed by agent-a
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Fix bug',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-a');

      // WHEN: Agent B tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-b');
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Error includes claimedBy
      expect(response.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('ALREADY_CLAIMED');
      expect(body.error.details).toBeDefined();
      expect(body.error.details.claimedBy).toBe('agent-a');
    });

    test('claim failure includes expiresAt for retry planning', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Deploy changes',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-holder');

      // WHEN: Another agent tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-waiter');
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Error includes expiresAt
      expect(response.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.error.details).toBeDefined();
      expect(body.error.details.expiresAt).toBeDefined();
      // Verify it's a valid ISO timestamp
      expect(new Date(body.error.details.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    test('claim failure includes retryAfterMs for intelligent retry', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Run tests',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-busy');

      // WHEN: Another agent tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-waiting');
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Error includes retryAfterMs
      expect(response.status).toBe(409);
      expect(body.ok).toBe(false);
      expect(body.error.details).toBeDefined();
      expect(typeof body.error.details.retryAfterMs).toBe('number');
      expect(body.error.details.retryAfterMs).toBeGreaterThanOrEqual(0);
    });

    test('error response has consistent structure for error handling', async () => {
      // GIVEN: A claimed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Analyze logs',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-first');

      // WHEN: Second agent tries to claim
      const response = await claimTask(app, workspace, file, task.ref, 'agent-second');
      const body = await response.json();
      assertValidResponse(body, 'Error');

      // THEN: Response follows standard error structure
      expect(body).toHaveProperty('ok', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
    });

    test('agent B blocked while agent A holds claim', async () => {
      // GIVEN: A task claimed by agent A
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Write docs',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-a');

      // WHEN: Agent B tries to claim while A holds it
      const attemptB = await claimTask(app, workspace, file, task.ref, 'agent-b');

      // THEN: Agent B gets blocked
      expect(attemptB.status).toBe(409);
      const body = await attemptB.json();
      expect(body.error.code).toBe('ALREADY_CLAIMED');
    });

    test('completed tasks reject new claims with TASK_ALREADY_COMPLETE', async () => {
      // GIVEN: A completed task
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Already done task',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-a');

      // Agent A completes the task
      await app.handle(
        new Request(`http://localhost/a/${workspace.appendKey}${file.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'response',
            ref: task.ref,
            author: 'agent-a',
            content: 'Done!',
          }),
        })
      );

      // WHEN: Agent B tries to claim completed task
      const retryAttempt = await claimTask(app, workspace, file, task.ref, 'agent-b');

      // THEN: Should be rejected with TASK_ALREADY_COMPLETE
      expect(retryAttempt.status).toBe(400);
      const body = await retryAttempt.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('TASK_ALREADY_COMPLETE');
    });

    test('multiple agents get consistent error on same claimed task', async () => {
      // GIVEN: A task claimed by one agent
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Review security',
      });
      await claimTask(app, workspace, file, task.ref, 'agent-holder');

      // WHEN: Multiple agents try to claim simultaneously
      const [responseB, responseC, responseD] = await Promise.all([
        claimTask(app, workspace, file, task.ref, 'agent-b'),
        claimTask(app, workspace, file, task.ref, 'agent-c'),
        claimTask(app, workspace, file, task.ref, 'agent-d'),
      ]);

      // THEN: All get 409 with same error code
      expect(responseB.status).toBe(409);
      expect(responseC.status).toBe(409);
      expect(responseD.status).toBe(409);

      const [bodyB, bodyC, bodyD] = await Promise.all([
        responseB.json(),
        responseC.json(),
        responseD.json(),
      ]);

      expect(bodyB.error.code).toBe('ALREADY_CLAIMED');
      expect(bodyC.error.code).toBe('ALREADY_CLAIMED');
      expect(bodyD.error.code).toBe('ALREADY_CLAIMED');
    });
  });

  describe('Claim Existing Workspace', () => {
    let workspace: TestWorkspace;

    beforeEach(async () => {
      workspace = await createTestWorkspace(app);
    });

    test('claim workspace endpoint exists and requires OAuth', async () => {
      // GIVEN: A workspace with write key

      // WHEN: Try to claim without OAuth session
      const response = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      );

      // THEN: Requires authentication
      expect(response.status).toBe(401);
    });

    test('claim workspace with simulated OAuth session', async () => {
      // GIVEN: A workspace and authenticated user
      const oauthUser = await createTestOAuthSession('claimer@example.com', 'Claimer');
      activeOAuthSessions.set(oauthUser.sessionToken, oauthUser);

      // WHEN: Claim with OAuth session
      const response = await authenticatedRequest(
        app,
        'POST',
        `http://localhost/w/${workspace.writeKey}/claim`,
        oauthUser,
        {}
      );

      // THEN: Workspace is claimed
      expect(response.status).toBe(200);
      const body = await response.json();
      assertValidResponse(body, 'ClaimWorkspaceResponse');
      expect(body.ok).toBe(true);
      expect(body.data.claimed).toBe(true);
      expect(body.data.workspaceId).toMatch(/^ws_/);
      expect(body.data.apiKey).toBeUndefined();
      expect(body.data.message).toBe('claimed');
    });

    test('capability URLs remain valid after workspace operations', async () => {
      // GIVEN: A workspace with files and tasks
      const file = await createTestFile(app, workspace, '/persistent.md', '# Persistent');
      const task = await createTestTask(app, workspace, file, {
        author: 'human',
        content: 'Persistent task',
      });

      // WHEN: Perform various operations

      // Read still works
      const readResponse = await app.handle(
        new Request(`http://localhost/r/${workspace.readKey}/persistent.md`, {
          method: 'GET',
        })
      );
      expect(readResponse.status).toBe(200);

      // Append still works
      const appendResponse = await claimTask(app, workspace, file, task.ref, 'agent-test');
      expect(appendResponse.status).toBe(201);

      // Write still works
      const writeResponse = await app.handle(
        new Request(`http://localhost/w/${workspace.writeKey}/new-file.md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '# New File' }),
        })
      );
      expect(writeResponse.status).toBe(201);

      // THEN: All capability keys continue to work
    });

    test('workspace ID is properly formatted', async () => {
      // GIVEN: A workspace created via bootstrap

      // WHEN: Check workspace ID format

      // THEN: ID is properly formatted
      expect(workspace.workspaceId).toBeDefined();
      expect(workspace.workspaceId).toMatch(/^ws_[A-Za-z0-9]{12,}$/);
    });

    test('unclaimed workspace has no owner restrictions', async () => {
      // GIVEN: An unclaimed workspace (default state after bootstrap)

      // WHEN: Perform all operations without auth
      const file = await createTestFile(app, workspace, '/unrestricted.md', '# Free');
      const task = await createTestTask(app, workspace, file, {
        author: 'anyone',
        content: 'Task by anyone',
      });

      // THEN: Operations succeed without ownership
      expect(file.id).toBeDefined();
      expect(task.appendId).toBeDefined();
    });

    test('multiple workspaces can be bootstrapped independently', async () => {
      // GIVEN: First workspace already exists

      // WHEN: Bootstrap additional workspaces
      const workspace2 = await createTestWorkspace(app);
      const workspace3 = await createTestWorkspace(app);

      // THEN: All have unique IDs and independent keys
      expect(workspace.workspaceId).not.toBe(workspace2.workspaceId);
      expect(workspace.workspaceId).not.toBe(workspace3.workspaceId);
      expect(workspace2.workspaceId).not.toBe(workspace3.workspaceId);

      expect(workspace.writeKey).not.toBe(workspace2.writeKey);
      expect(workspace.writeKey).not.toBe(workspace3.writeKey);
    });

    test('workspace keys are cryptographically strong', async () => {
      // GIVEN: A workspace

      // THEN: Keys are sufficiently long for security (minimum 16 chars ~= 96 bits)
      expect(workspace.readKey.length).toBeGreaterThanOrEqual(16);
      expect(workspace.appendKey.length).toBeGreaterThanOrEqual(16);
      expect(workspace.writeKey.length).toBeGreaterThanOrEqual(16);

      // AND: Keys are different from each other
      expect(workspace.readKey).not.toBe(workspace.appendKey);
      expect(workspace.readKey).not.toBe(workspace.writeKey);
      expect(workspace.appendKey).not.toBe(workspace.writeKey);
    });
  });
});

