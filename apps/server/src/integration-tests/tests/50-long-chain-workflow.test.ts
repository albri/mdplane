/**
 * Long Chain Workflow Integration Test
 *
 * Exercises the full capability URL workflow end-to-end:
 * Bootstrap → Create Files → Create Folders → Appends → Read with Workspace Context
 *
 * This test verifies that all parts of the system work together correctly,
 * including the new workspace context enrichment in capability responses.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('50 - Long Chain Workflow', () => {
  let workspace: BootstrappedWorkspace;

  // File and folder names for the chain
  const projectFolder = uniqueName('project');
  const readmeFile = 'README.md';
  const taskFile = 'tasks.md';
  const nestedFolder = 'docs';
  const nestedFile = 'api-spec.md';

  beforeAll(async () => {
    // Step 0: Bootstrap workspace
    workspace = await bootstrap(uniqueName('longchain'));
  });

  describe('Step 1: Bootstrap Validation', () => {
    test('workspace has valid ID pattern', () => {
      expect(workspace.workspaceId).toMatch(/^ws_[A-Za-z0-9]{12,}$/);
    });

    test('all capability keys are present and valid', () => {
      expect(workspace.readKey).toBeDefined();
      expect(workspace.readKey.length).toBeGreaterThan(10);
      expect(workspace.appendKey).toBeDefined();
      expect(workspace.appendKey.length).toBeGreaterThan(10);
      expect(workspace.writeKey).toBeDefined();
      expect(workspace.writeKey.length).toBeGreaterThan(10);
    });
  });

  describe('Step 2: Create Root File', () => {
    test('create README at root via write key', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${readmeFile}`, {
        body: { content: '# Long Chain Test\n\nWorkspace for end-to-end workflow testing.' },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBeDefined();
    });

    test('read README returns workspace context', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${readmeFile}`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.content).toContain('Long Chain Test');

      // Verify workspace context enrichment
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
      expect(typeof data.data.workspace.claimed).toBe('boolean');
      expect(data.data.workspace.claimed).toBe(false); // Unclaimed workspace
    });
  });

  describe('Step 3: Create Project Folder Structure', () => {
    test('create files in project folder', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${projectFolder}/${taskFile}`, {
        body: { content: '# Tasks\n\n## Open Tasks\n\n- [ ] Complete workflow test' },
      });
      expect(response.status).toBe(201);
    });

    test('create nested folder with file', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${projectFolder}/${nestedFolder}/${nestedFile}`, {
        body: { content: '# API Specification\n\n## Endpoints\n\nTBD' },
      });
      expect(response.status).toBe(201);
    });

    test('folder listing returns workspace context', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/${projectFolder}/`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Verify folder has items
      expect(data.data.items).toBeDefined();
      expect(data.data.items.length).toBeGreaterThan(0);

      // Verify workspace context in folder response
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
      expect(data.data.workspace.claimed).toBe(false);
    });
  });

  describe('Step 4: Append Operations', () => {
    let taskAppendId: string;
    let commentAppendId: string;

    test('create task append on tasks file', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${projectFolder}/${taskFile}`, {
        body: {
          author: '__int_workflow',
          type: 'task',
          content: 'Add integration test coverage',
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toMatch(/^a\d+$/);
      taskAppendId = data.data.id;
    });

    test('add comment referencing task', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${projectFolder}/${taskFile}`, {
        body: {
          author: '__int_reviewer',
          type: 'comment',
          content: 'This is important for CI stability',
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      commentAppendId = data.data.id;
    });

    test('claim the task', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${projectFolder}/${taskFile}`, {
        body: {
          author: '__int_claimer',
          type: 'claim',
          ref: taskAppendId,
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.expiresAt).toBeDefined();
    });

    test('read file with appends shows all appends', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${projectFolder}/${taskFile}?format=parsed&appends=10`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.appends).toBeDefined();
      expect(data.data.appends.length).toBeGreaterThanOrEqual(3); // task, comment, claim

      // Verify workspace context is still present
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
    });
  });

  describe('Step 5: Write Key Read Operations', () => {
    test('write key can read file with workspace context', async () => {
      const response = await apiRequest('GET', `/w/${workspace.writeKey}/${projectFolder}/${taskFile}`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Workspace context should be present for write key reads too
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
      expect(data.data.workspace.claimed).toBe(false);
    });
  });

  describe('Step 6: File Update and Verification', () => {
    test('update nested file content', async () => {
      const response = await apiRequest('PUT', `/w/${workspace.writeKey}/${projectFolder}/${nestedFolder}/${nestedFile}`, {
        body: { content: '# API Specification\n\n## Endpoints\n\n### GET /health\n\nReturns server status.' },
      });
      expect(response.status).toBe(200);
    });

    test('read updated content with workspace context', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/${projectFolder}/${nestedFolder}/${nestedFile}`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.content).toContain('GET /health');
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
    });
  });

  describe('Step 7: Multi-File Append Operation', () => {
    test('multi-append creates multiple appends atomically', async () => {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}/${projectFolder}/${taskFile}`, {
        body: {
          author: '__int_multi',
          appends: [
            { type: 'task', content: 'First subtask' },
            { type: 'task', content: 'Second subtask' },
            { type: 'comment', content: 'Both tasks added for workflow' },
          ],
        },
      });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.appends).toBeDefined();
      expect(data.data.appends.length).toBe(3);
    });
  });

  describe('Step 8: Folder with Append Key', () => {
    test('folder listing works with append key', async () => {
      const response = await apiRequest('GET', `/a/${workspace.appendKey}/folders/${projectFolder}/`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
    });
  });

  describe('Step 9: Root Folder Listing', () => {
    test('root folder lists all created files/folders with workspace context', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/folders/`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);

      // Should contain README at root and project folder
      const items = data.data.items;
      const hasReadme = items.some((i: { name: string }) => i.name === readmeFile);
      const hasProject = items.some((i: { name: string }) => i.name === projectFolder);
      expect(hasReadme).toBe(true);
      expect(hasProject).toBe(true);

      // Workspace context
      expect(data.data.workspace).toBeDefined();
      expect(data.data.workspace.id).toBe(workspace.workspaceId);
      expect(data.data.workspace.claimed).toBe(false);
    });
  });

  describe('Step 10: Complete Workflow Summary', () => {
    test('full chain completed successfully', async () => {
      // Final verification: root folder has items
      const rootResponse = await apiRequest('GET', `/r/${workspace.readKey}/folders/`);
      expect(rootResponse.status).toBe(200);
      const rootData = await rootResponse.json();
      expect(rootData.ok).toBe(true);
      expect(rootData.data.items.length).toBeGreaterThanOrEqual(2);

      // Verify nested structure exists
      const nestedResponse = await apiRequest('GET', `/r/${workspace.readKey}/folders/${projectFolder}/${nestedFolder}/`);
      expect(nestedResponse.status).toBe(200);
      const nestedData = await nestedResponse.json();
      expect(nestedData.data.items.length).toBeGreaterThan(0);

      // All responses include workspace context
      expect(nestedData.data.workspace.id).toBe(workspace.workspaceId);
    });
  });
});
