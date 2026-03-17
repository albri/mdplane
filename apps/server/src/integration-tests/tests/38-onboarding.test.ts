/**
 * Onboarding Workflow Integration Test
 *
 * Tests new user and agent onboarding scenarios.
 * Reference: apps/server/tests/scenarios/onboarding-scenarios.test.ts
 *
 * Use Cases Covered:
 * - New user onboarding (<60 seconds)
 * - Agent self-configuration
 * - Diagnose claim failure
 * - Claim existing workspace (OAuth required - skipped)
 *
 * @see packages/shared/openapi/paths/bootstrap.yaml
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('38 - Onboarding Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const testPrefix = '__int_onboarding';

  beforeAll(async () => {
    workspace = await bootstrap();
  });

  describe('New User Onboarding', () => {
    test('POST /bootstrap creates workspace with all required fields', async () => {
      const response = await apiRequest('POST', '/bootstrap', {
        body: { workspaceName: `${testPrefix}_new` },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Workspace ID format
      expect(data.data.workspaceId).toMatch(/^ws_[A-Za-z0-9]+$/);

      // Keys object with capability keys
      expect(data.data.keys).toBeDefined();
      expect(data.data.keys.read).toBeDefined();
      expect(data.data.keys.append).toBeDefined();
      expect(data.data.keys.write).toBeDefined();

      // URLs object with API and Web URLs
      expect(data.data.urls).toBeDefined();
      expect(data.data.urls.api).toBeDefined();
      expect(data.data.urls.api.read).toContain('/r/');
      expect(data.data.urls.api.append).toContain('/a/');
      expect(data.data.urls.api.write).toContain('/w/');
      expect(data.data.urls.web).toBeDefined();
      expect(data.data.urls.web.read).toContain('/r/');
      expect(data.data.urls.web.claim).toContain('/claim/');
    });

    test('bootstrap requires no authentication', async () => {
      // Bootstrap should work without any auth headers
      const response = await apiRequest('POST', '/bootstrap', {
        body: { workspaceName: `${testPrefix}_noauth` },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    test('workspace is immediately usable for file creation', async () => {
      // Create file immediately after bootstrap
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${testPrefix}_first.md`, {
        body: { content: '# First File\n\nCreated immediately after bootstrap.' },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBeDefined();
    });

    test('workspace is immediately usable for appends', async () => {
      // Create append immediately after bootstrap
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${testPrefix}_first.md`, {
        body: {
          type: 'comment',
          author: 'int-test',
          content: 'First append after bootstrap',
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toMatch(/^a\d+$/);
    });

    test('bootstrap with custom workspace name', async () => {
      const customName = `${testPrefix}_custom_workspace`;
      const response = await apiRequest('POST', '/bootstrap', {
        body: { workspaceName: customName },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.workspaceId).toMatch(/^ws_/);
    });
  });

  describe('Agent Self-Configuration', () => {
    test('agent can create config file in .mdplane folder', async () => {
      const configContent = `# Agent Configuration
agent_id: int-test-agent
capabilities:
  - read
  - append
`;
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/.mdplane/config.md`, {
        body: { content: configContent },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    test('agent can read its own config', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/.mdplane/config.md`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('agent_id: int-test-agent');
    });

    test('agent can update config file', async () => {
      const updatedConfig = `# Agent Configuration
agent_id: int-test-agent
capabilities:
  - read
  - append
  - write
updated: true
`;
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/.mdplane/config.md`, {
        body: { content: updatedConfig },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
    });
  });
});

