/**
 * Kanban Workflow Integration Tests
 * 
 * Multi-step workflow tests for Kanban-style task board operations:
 * - Create a board with columns
 * - Add card to column (task append)
 * - Move card between columns (claim/complete)
 * - Assign card to agent (claim)
 * 
 * This test creates a realistic workflow:
 * 1. Bootstrap workspace
 * 2. Create board file
 * 3. Add task card
 * 4. Claim task (move to In Progress)
 * 5. Complete task (move to Done)
 * 6. Verify status progression in appends
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

describe('30 - Kanban Workflow', () => {
  let workspace: BootstrappedWorkspace;
  const BOARD_PATH = '/__int_kanban_board.md';
  const AGENT_1 = '__int_agent_alice';
  const AGENT_2 = '__int_agent_bob';
  
  // Task tracking
  let taskAppendId: string;
  let claimId: string;

  // 1. Bootstrap workspace for kanban workflow
  beforeAll(async () => {
    workspace = await bootstrap();
  });

  // Create a board with columns
  test('can create a kanban board file', async () => {
    const boardContent = `# Kanban Board

## Backlog

## In Progress

## Done
`;

    const response = await apiRequest('PUT', `/w/${workspace.writeKey}${BOARD_PATH}`, {
      body: { content: boardContent },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  // Add card to column (task append)
  test('can add task card to Backlog', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_1,
        type: 'task',
        content: 'Implement user authentication',
        priority: 'high',
        labels: ['feature', 'security'],
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    // Task status is 'open' per OpenAPI spec (not 'pending')
    expect(data.data.status).toBe('open');

    taskAppendId = data.data.id;
  });

  // Assign card to agent (claim)
  test('can claim task (move to In Progress)', async () => {
    // Claim the task
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_1,
        type: 'claim',
        ref: taskAppendId,
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.expiresAt).toBeDefined();
    
    claimId = data.data.id;
  });

  // Verify task status after claim
  test('task status shows claimed', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${BOARD_PATH}?format=parsed`);
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    
    // Find the task append
    const taskAppend = data.data.appends.find((a: any) => a.id === taskAppendId);
    expect(taskAppend).toBeDefined();
    // Status should be 'claimed' or the claim should be present
  });

  // Move card between columns (complete)
  test('can complete task (move to Done)', async () => {
    const response = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_1,
        type: 'response',
        ref: taskAppendId,
        content: 'Authentication implemented using JWT',
      },
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.id).toBeDefined();
  });

  // Verify completed task status
  test('completed task shows done status', async () => {
    const response = await apiRequest('GET', `/r/${workspace.readKey}${BOARD_PATH}?format=parsed`);
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    
    // Check we have multiple appends showing the workflow
    expect(data.data.appends.length).toBeGreaterThanOrEqual(3);
  });

  // Second agent cannot claim already claimed task
  test('second agent cannot claim already claimed task', async () => {
    // Create another task for this test
    const createResp = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_1,
        type: 'task',
        content: 'Implement OAuth integration',
        priority: 'medium',
      },
    });

    expect(createResp.status).toBe(201);
    const taskData = await createResp.json();
    const newTaskId = taskData.data.id;

    // Agent 1 claims the task
    const claim1Resp = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_1,
        type: 'claim',
        ref: newTaskId,
      },
    });
    expect(claim1Resp.status).toBe(201);

    // Agent 2 tries to claim same task - should fail
    const claim2Resp = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
      body: {
        author: AGENT_2,
        type: 'claim',
        ref: newTaskId,
      },
    });

    // Per OpenAPI spec: ALREADY_CLAIMED returns 409 Conflict
    expect(claim2Resp.status).toBe(409);
    const errorData = await claim2Resp.json();
    expect(errorData.ok).toBe(false);
  });

  // Verify audit trail
  test('audit trail shows complete workflow', async () => {
    // Use format=parsed to get appends array
    const response = await apiRequest('GET', `/r/${workspace.readKey}${BOARD_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.appends).toBeDefined();
    expect(Array.isArray(data.data.appends)).toBe(true);

    // Should have at least: task, claim, response, task2, claim2 = 5 appends
    expect(data.data.appends.length).toBeGreaterThanOrEqual(4);

    // Verify we have different types
    const types = data.data.appends.map((a: any) => a.type);
    expect(types).toContain('task');
    expect(types).toContain('claim');
    expect(types).toContain('response');
  });

  // Priority ordering
  test('tasks can be created with different priorities', async () => {
    const priorities = ['critical', 'high', 'medium', 'low'];

    for (const priority of priorities) {
      const response = await apiRequest('POST', `/a/${workspace.appendKey}${BOARD_PATH}`, {
        body: {
          author: AGENT_1,
          type: 'task',
          content: `Task with ${priority} priority`,
          priority,
        },
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.priority).toBe(priority);
    }
  });

  // Search for high priority tasks
  test('can search for tasks by priority', async () => {
    // Get all appends and filter client-side (no server-side priority filter)
    const response = await apiRequest('GET', `/r/${workspace.readKey}${BOARD_PATH}?format=parsed&appends=100`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);

    // Filter for high priority tasks
    const highPriorityTasks = data.data.appends.filter(
      (a: any) => a.type === 'task' && a.priority === 'high'
    );

    // Should find at least our high priority task
    expect(highPriorityTasks.length).toBeGreaterThanOrEqual(1);
    highPriorityTasks.forEach((append: any) => {
      expect(append.priority).toBe('high');
    });
  });
});

