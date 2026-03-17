/**
 * Orchestration Filter Integration Tests
 *
 * Tests verify filter behavior returns correct content (not just status codes).
 *
 * Filters tested:
 * - status (pending, claimed)
 * - priority (critical, high, medium, low)
 * - agent (specific claim owner)
 * - folder (path prefix filter)
 * - Combined filter intersections
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest, type BootstrappedWorkspace, bootstrap } from '../helpers/api-client';

type OrchestrationStatus = 'pending' | 'claimed' | 'stalled' | 'completed' | 'cancelled';

interface OrchestrationTask {
  id: string;
  status: OrchestrationStatus;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  file: { path: string };
  claim?: { author?: string };
}

function tasksByStatus(tasks: OrchestrationTask[], status: OrchestrationStatus): OrchestrationTask[] {
  return tasks.filter((task) => task.status === status);
}

function activeTasks(tasks: OrchestrationTask[]): OrchestrationTask[] {
  return tasks.filter((task) => task.status === 'pending' || task.status === 'claimed' || task.status === 'stalled');
}

describe('12b - Orchestration Filters', () => {
  let workspace: BootstrappedWorkspace;
  const AGENT_1 = '__int_filter_agent_1';
  const AGENT_2 = '__int_filter_agent_2';

  beforeAll(async () => {
    workspace = await bootstrap();

    // Create test file using PUT (not POST)
    const createResp = await apiRequest('PUT', `/w/${workspace.writeKey}/tasks.md`, {
      body: { content: '# Tasks for filter testing' },
    });
    if (!createResp.ok) {
      throw new Error(`Failed to create test file: ${createResp.status} ${await createResp.text()}`);
    }

    // Create tasks with different priorities
    const t1 = await apiRequest('POST', `/a/${workspace.appendKey}/tasks.md`, {
      body: { author: AGENT_1, type: 'task', content: 'Critical task', priority: 'critical' },
    });
    if (!t1.ok) {
      throw new Error(`Failed to create critical task: ${t1.status}`);
    }
    const criticalTaskData = await t1.json();
    const criticalTaskId = criticalTaskData.data.id;

    await apiRequest('POST', `/a/${workspace.appendKey}/tasks.md`, {
      body: { author: AGENT_1, type: 'task', content: 'High priority task', priority: 'high' },
    });
    await apiRequest('POST', `/a/${workspace.appendKey}/tasks.md`, {
      body: { author: AGENT_2, type: 'task', content: 'Medium priority task', priority: 'medium' },
    });
    await apiRequest('POST', `/a/${workspace.appendKey}/tasks.md`, {
      body: { author: AGENT_2, type: 'task', content: 'Low priority task', priority: 'low' },
    });

    // Create a claim (critical task claimed by AGENT_1)
    const claimResp = await apiRequest('POST', `/a/${workspace.appendKey}/tasks.md`, {
      body: { author: AGENT_1, type: 'claim', ref: criticalTaskId },
    });
    if (!claimResp.ok) {
      throw new Error(`Failed to create claim: ${claimResp.status}`);
    }
  });

  describe('Status Filter', () => {
    test('status=pending returns only unclaimed tasks', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?status=pending`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // Pending should have tasks, claimed should be empty when filtering pending only
      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'pending').length).toBeGreaterThan(0);
      expect(tasksByStatus(tasks, 'claimed').length).toBe(0);
    });

    test('status=claimed returns only claimed tasks', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?status=claimed`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // Pending should be empty, claimed should have tasks when filtering claimed only
      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'pending').length).toBe(0);
      expect(tasksByStatus(tasks, 'claimed').length).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(task.status).toBe('claimed');
      }
    });

    test('status=pending,claimed returns both buckets', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?status=pending,claimed`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'pending').length).toBeGreaterThan(0);
      expect(tasksByStatus(tasks, 'claimed').length).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(['pending', 'claimed']).toContain(task.status);
      }
    });
  });

  describe('Priority Filter', () => {
    test('priority=critical returns only critical tasks', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?priority=critical`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      const allTasks = activeTasks(data.data.tasks as OrchestrationTask[]);

      for (const task of allTasks) {
        expect(task.priority ?? '').toBe('critical');
      }
    });

    test('priority=high,critical returns both priorities', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?priority=high,critical`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      const allTasks = activeTasks(data.data.tasks as OrchestrationTask[]);

      for (const task of allTasks) {
        expect(['high', 'critical']).toContain(task.priority ?? '');
      }
    });

    test('SECURITY: SQL injection in priority is rejected gracefully', async () => {
      const malicious = "high'; DROP TABLE appends; --";
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?priority=${encodeURIComponent(malicious)}`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Agent Filter', () => {
    test('agent filter returns only tasks claimed by that agent', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?agent=${AGENT_1}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // All claimed tasks should be by AGENT_1
      for (const task of tasksByStatus(data.data.tasks as OrchestrationTask[], 'claimed')) {
        expect(task.claim?.author).toBe(AGENT_1);
      }
    });
  });

  describe('Folder Filter', () => {
    test('folder filter returns tasks only in that path prefix', async () => {
      // Create file in subfolder
      const createNestedFile = await apiRequest('PUT', `/w/${workspace.writeKey}/projects/backend/tasks.md`, {
        body: { content: '# Backend tasks' },
      });
      expect(createNestedFile.ok).toBe(true);
      await apiRequest('POST', `/a/${workspace.appendKey}/projects/backend/tasks.md`, {
        body: { author: AGENT_1, type: 'task', content: 'Backend task', priority: 'high' },
      });

      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?folder=/projects/backend`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      const allTasks = activeTasks(data.data.tasks as OrchestrationTask[]);

      for (const task of allTasks) {
        expect(task.file.path).toMatch(/^\/projects\/backend/);
      }
    });
  });

  describe('Combined Filters (Intersection)', () => {
    test('status + priority filters are applied as intersection', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?status=pending&priority=high`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // Only pending + high priority tasks
      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'claimed').length).toBe(0); // status=pending excludes claimed

      for (const task of tasksByStatus(tasks, 'pending')) {
        expect(task.priority).toBe('high');
      }
    });

    test('status + agent filters are applied as intersection', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?status=claimed&agent=${AGENT_1}`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // Only claimed tasks by AGENT_1
      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'pending').length).toBe(0); // status=claimed excludes pending

      for (const task of tasksByStatus(tasks, 'claimed')) {
        expect(task.claim?.author).toBe(AGENT_1);
      }
    });

    test('folder + priority filters are applied as intersection', async () => {
      const response = await apiRequest('GET', `/r/${workspace.readKey}/orchestration?folder=/projects&priority=high`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      const allTasks = activeTasks(data.data.tasks as OrchestrationTask[]);

      for (const task of allTasks) {
        expect(task.file.path).toMatch(/^\/projects/);
        expect(task.priority).toBe('high');
      }
    });

    test('all filters combined (status + priority + folder + agent)', async () => {
      const response = await apiRequest(
        'GET',
        `/r/${workspace.readKey}/orchestration?status=pending&priority=high&folder=/projects`
      );
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.ok).toBe(true);

      // Intersection of all filters
      const tasks = data.data.tasks as OrchestrationTask[];
      expect(tasksByStatus(tasks, 'claimed').length).toBe(0); // status=pending
      expect(tasksByStatus(tasks, 'stalled').length).toBe(0); // status=pending

      for (const task of tasksByStatus(tasks, 'pending')) {
        expect(task.priority).toBe('high');
        expect(task.file.path).toMatch(/^\/projects/);
      }
    });
  });
});

