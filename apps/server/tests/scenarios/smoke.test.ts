/**
 * Scenario Test Infrastructure Test
 *
 * Verifies that the test helpers and fixtures can be imported and used.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestApp } from '../helpers';
import { createTestWorkspace, createTestFile, createTestTask } from '../fixtures';

describe('Test Infrastructure', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  test('createTestApp returns an Elysia instance', () => {
    expect(app).toBeDefined();
    expect(typeof app.handle).toBe('function');
  });

  test('can bootstrap a workspace', async () => {
    const workspace = await createTestWorkspace(app);

    expect(workspace.workspaceId).toMatch(/^ws_/);
    expect(workspace.readKey).toBeDefined();
    expect(workspace.appendKey).toBeDefined();
    expect(workspace.writeKey).toBeDefined();
  });

  test('can create a file', async () => {
    const workspace = await createTestWorkspace(app);
    const file = await createTestFile(app, workspace, '/test.md', '# Hello World');

    expect(file.id).toBeDefined();
    expect(file.path).toBe('/test.md');
    expect(file.content).toBe('# Hello World');
    expect(file.etag).toBeDefined();
  });

  test('can create a task', async () => {
    const workspace = await createTestWorkspace(app);
    const file = await createTestFile(app, workspace, '/tasks.md');
    const task = await createTestTask(app, workspace, file, {
      author: 'test-agent',
      content: 'Test task content',
    });

    expect(task.appendId).toMatch(/^a\d+$/);
    expect(task.ref).toBe(task.appendId);
    expect(task.author).toBe('test-agent');
  });
});

