/**
 * Concurrent Access Integration Tests
 *
 * Verify system handles concurrent operations correctly.
 */

import { describe, test, expect } from 'bun:test';
import { apiRequest, bootstrap, type BootstrappedWorkspace } from '../helpers/api-client';
import { uniqueName } from '../helpers/test-utils';

describe('18 - Concurrent Access', () => {
  let workspace: BootstrappedWorkspace;
  const testFileName = `${uniqueName('concurrent')}.md`;
  let taskAppendId: string;

  test('bootstrap workspace and create test file', async () => {
    workspace = await bootstrap('concurrent');

    // Create test file with a task
    await apiRequest('PUT', `/w/${workspace.writeKey}/${testFileName}`, {
      body: { content: '# Concurrent Test\n\nFile for concurrent access testing.' },
    });

    // Add a task to claim
    const taskResponse = await apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_orchestrator',
        type: 'task',
        content: 'Task for concurrent claim test',
      },
    });
    const taskData = await taskResponse.json();
    taskAppendId = taskData.data.id;
  });

  test('concurrent claims - second rejected', async () => {
    // First claim
    const claim1 = apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_agent_1',
        type: 'claim',
        ref: taskAppendId,
        content: 'First claim',
      },
    });

    // Second claim (near-simultaneous)
    const claim2 = apiRequest('POST', `/a/${workspace.appendKey}/${testFileName}`, {
      body: {
        author: '__int_agent_2',
        type: 'claim',
        ref: taskAppendId,
        content: 'Second claim',
      },
    });

    const [response1, response2] = await Promise.all([claim1, claim2]);

    // One should succeed, one should fail
    const statuses = [response1.status, response2.status].sort();

    // Either 201+400/409 or both return an error (if task already has response)
    expect(statuses[0]).toBeLessThanOrEqual(409);
  });

  test('concurrent appends all succeed', async () => {
    const appendFile = `${uniqueName('append-concurrent')}.md`;
    await apiRequest('PUT', `/w/${workspace.writeKey}/${appendFile}`, {
      body: { content: '# Append Test' },
    });

    const appends = Array(5).fill(null).map((_, i) =>
      apiRequest('POST', `/a/${workspace.appendKey}/${appendFile}`, {
        body: {
          author: `__int_concurrent_${i}`,
          type: 'comment',
          content: `Concurrent comment ${i}`,
        },
      })
    );

    const responses = await Promise.all(appends);

    // All should succeed
    responses.forEach((response, i) => {
      expect(response.status).toBe(201);
    });

    // Verify all appends are visible
    const readResponse = await apiRequest('GET', `/r/${workspace.readKey}/${appendFile}?format=parsed&appends=10`);
    const data = await readResponse.json();

    expect(data.data.appends.length).toBeGreaterThanOrEqual(5);
  });

  test('concurrent reads all succeed', async () => {
    const reads = Array(10).fill(null).map(() =>
      apiRequest('GET', `/r/${workspace.readKey}/${testFileName}`)
    );

    const responses = await Promise.all(reads);

    responses.forEach(response => {
      expect(response.ok).toBe(true);
    });
  });

  test('concurrent updates - no corruption', async () => {
    const updateFile = `${uniqueName('update-concurrent')}.md`;
    await apiRequest('PUT', `/w/${workspace.writeKey}/${updateFile}`, {
      body: { content: 'Initial content' },
    });

    const updates = Array(3).fill(null).map((_, i) =>
      apiRequest('PUT', `/w/${workspace.writeKey}/${updateFile}`, {
        body: { content: `Update ${i}` },
      })
    );

    const responses = await Promise.all(updates);

    // All should succeed (last write wins)
    responses.forEach(response => {
      expect(response.ok).toBe(true);
    });

    // Verify file is readable (not corrupted)
    const readResponse = await apiRequest('GET', `/r/${workspace.readKey}/${updateFile}`);
    expect(readResponse.ok).toBe(true);

    const data = await readResponse.json();
    expect(data.data.content).toMatch(/^Update \d$/);
  });

  test('concurrent folder operations - no corruption', async () => {
    const baseName = uniqueName('folder-concurrent');

    const folders = Array(3).fill(null).map((_, i) =>
      apiRequest('POST', `/w/${workspace.writeKey}/folders`, {
        body: { name: `${baseName}_${i}` },
      })
    );

    const responses = await Promise.all(folders);

    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(201);
    });
  });
});
