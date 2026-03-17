import { beforeEach, describe, expect, test } from 'bun:test';
import type { Elysia } from 'elysia';
import { createTestApp } from '../helpers';
import {
  claimTask,
  completeTask,
  cancelClaim,
  createTestFile,
  createTestTask,
  createTestWorkspace,
  type TestFile,
  type TestWorkspace,
} from '../fixtures';

describe('Adversarial Hardening', () => {
  let app: Elysia;
  let workspace: TestWorkspace;
  let file: TestFile;

  beforeEach(async () => {
    app = createTestApp();
    workspace = await createTestWorkspace(app);
    file = await createTestFile(app, workspace, '/break/adversarial.md', '# Adversarial');
  });

  test('malformed requests return controlled client errors', async () => {
    const cases: Array<{
      name: string;
      method: string;
      url: string;
      body?: unknown;
      expectedStatus: number;
      expectedCode?: string;
    }> = [
      {
        name: 'malformed path encoding percent-hex',
        method: 'GET',
        url: `http://localhost/r/${workspace.readKey}/%ZZ`,
        expectedStatus: 400,
        expectedCode: 'INVALID_PATH',
      },
      {
        name: 'malformed path encoding trailing percent',
        method: 'GET',
        url: `http://localhost/r/${workspace.readKey}/%`,
        expectedStatus: 400,
        expectedCode: 'INVALID_PATH',
      },
      {
        name: 'invalid read format query enum',
        method: 'GET',
        url: `http://localhost/r/${workspace.readKey}${file.path}?format=bogus`,
        expectedStatus: 400,
        expectedCode: 'INVALID_REQUEST',
      },
      {
        name: 'private IPv6 webhook URL',
        method: 'POST',
        url: `http://localhost/w/${workspace.writeKey}/webhooks`,
        body: { url: 'https://[fd00::1]/callback', events: ['append'] },
        expectedStatus: 400,
        expectedCode: 'INVALID_WEBHOOK_URL',
      },
      {
        name: 'credential-bearing webhook URL',
        method: 'POST',
        url: `http://localhost/w/${workspace.writeKey}/webhooks`,
        body: { url: 'https://user:pass@example.com/callback', events: ['append'] },
        expectedStatus: 400,
        expectedCode: 'INVALID_WEBHOOK_URL',
      },
      {
        name: 'invalid folder pagination limit',
        method: 'GET',
        url: `http://localhost/w/${workspace.writeKey}/folders?limit=0`,
        expectedStatus: 400,
        expectedCode: 'INVALID_REQUEST',
      },
      {
        name: 'invalid orchestration limit',
        method: 'GET',
        url: `http://localhost/w/${workspace.writeKey}/orchestration?limit=999999`,
        expectedStatus: 400,
        expectedCode: 'INVALID_REQUEST',
      },
      {
        name: 'invalid includeRevoked query value',
        method: 'GET',
        url: `http://localhost/w/${workspace.writeKey}/keys?includeRevoked=maybe`,
        expectedStatus: 400,
        expectedCode: 'INVALID_REQUEST',
      },
      {
        name: 'path traversal attempt on append route',
        method: 'POST',
        url: `http://localhost/a/${workspace.appendKey}/%2e%2e/%2e%2e/etc/passwd`,
        body: { author: 'adversary', type: 'task', content: 'attempt' },
        expectedStatus: 404,
      },
    ];

    for (const tc of cases) {
      const headers: Record<string, string> = {};
      let payload: string | undefined;
      if (tc.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(tc.body);
      }

      const response = await app.handle(
        new Request(tc.url, {
          method: tc.method,
          headers,
          body: payload,
        })
      );

      expect(response.status).toBe(tc.expectedStatus);
      expect(response.status).toBeLessThan(500);

      if (tc.expectedCode) {
        const body = await response.json();
        expect(body.error.code).toBe(tc.expectedCode);
      }
    }
  });

  test('replayed claim mutations remain stable under concurrency', async () => {
    const task = await createTestTask(app, workspace, file, {
      author: 'agent-breakit',
      content: 'stress this task',
    });

    const claimResponse = await claimTask(app, workspace, file, task.ref, 'agent-breakit');
    expect(claimResponse.status).toBe(201);
    const claimBody = await claimResponse.json();
    const claimRef = claimBody.data.id as string;

    const completeResults = await Promise.all([
      completeTask(app, workspace, file, task.ref, 'agent-breakit', 'first completion'),
      completeTask(app, workspace, file, task.ref, 'agent-breakit', 'second completion'),
    ]);

    for (const result of completeResults) {
      expect(result.status).toBe(201);
      expect(result.status).toBeLessThan(500);
    }

    const cancelResults = await Promise.all([
      cancelClaim(app, workspace, file, claimRef, 'agent-breakit'),
      cancelClaim(app, workspace, file, claimRef, 'agent-breakit'),
    ]);

    for (const result of cancelResults) {
      expect(result.status).toBe(201);
      expect(result.status).toBeLessThan(500);
    }

    const readAfter = await app.handle(
      new Request(`http://localhost/r/${workspace.readKey}${file.path}?format=parsed&appends=20`, {
        method: 'GET',
      })
    );
    expect(readAfter.status).toBe(200);
  });
});

