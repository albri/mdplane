/**
 * Demo Workspace Integration Tests
 *
 * Validates that demo seeding presents one coherent PR-review workflow story:
 * - Main workflow in /workflows/01-pr-reviews.md with all appends
 * - Automation guide in /workflows/02-automation.md explaining watchers
 */

import { describe, expect, test } from 'bun:test';
import { DEMO_READ_KEY } from '@mdplane/shared';
import { apiRequest } from '../helpers/api-client';

type OrchestrationStatus = 'pending' | 'claimed' | 'stalled' | 'completed' | 'cancelled';
type OrchestrationTask = { status: OrchestrationStatus };

describe('45 - Demo Workspace', () => {
  test('demo workspace is accessible via read key', async () => {
    const response = await apiRequest('GET', `/r/${DEMO_READ_KEY}/folders`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  test('demo workspace includes workflows folder with pr-reviews and automation files', async () => {
    const requiredPaths = ['/workflows/01-pr-reviews.md', '/workflows/02-automation.md'];

    for (const path of requiredPaths) {
      const fileResponse = await apiRequest('GET', `/r/${DEMO_READ_KEY}${path}`);
      expect(fileResponse.status).toBe(200);
    }
  });

  test('pr-reviews file explains the workflow and points to orchestration view', async () => {
    const response = await apiRequest('GET', `/r/${DEMO_READ_KEY}/workflows/01-pr-reviews.md`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);

    const content = data.data?.content ?? '';
    expect(content).toContain('orchestration view');
    expect(content).toContain('02-automation.md');
  });

  test('pr-reviews file has task, claim, response, renew, blocked, and answer appends', async () => {
    const response = await apiRequest(
      'GET',
      `/r/${DEMO_READ_KEY}/workflows/01-pr-reviews.md?format=parsed&appends=50`
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);

    const appends = data.data?.appends ?? [];
    expect(appends.length).toBeGreaterThan(0);

    const types = new Set(appends.map((append: { type: string }) => append.type));
    // Core workflow types
    expect(types.has('task')).toBe(true);
    expect(types.has('claim')).toBe(true);
    expect(types.has('response')).toBe(true);
    // Edge-case types (blocked/unblocked flow, renewal)
    expect(types.has('renew')).toBe(true);
    expect(types.has('blocked')).toBe(true);
    expect(types.has('answer')).toBe(true);
  });

  test('automation file explains watcher pattern with webhook examples', async () => {
    const response = await apiRequest('GET', `/r/${DEMO_READ_KEY}/workflows/02-automation.md`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);

    const content = data.data?.content ?? '';
    expect(content).toContain('watcher');
    expect(content).toContain('task.created');
    expect(content).toContain('webhook');
  });

  test('orchestration board has in-flight and resolved states', async () => {
    const response = await apiRequest('GET', `/r/${DEMO_READ_KEY}/orchestration`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);

    const summary = body.data?.summary ?? {};
    const tasks = (body.data?.tasks ?? []) as OrchestrationTask[];

    const inFlightTotal = (summary.pending ?? 0) + (summary.claimed ?? 0) + (summary.stalled ?? 0);
    const resolvedTotal = (summary.completed ?? 0) + (summary.cancelled ?? 0);

    expect(inFlightTotal).toBeGreaterThanOrEqual(2);
    expect(resolvedTotal).toBeGreaterThanOrEqual(2);
    expect(tasks.length).toBeGreaterThanOrEqual(5);
  });

  test('demo workspace remains read-only (no write key seeded)', async () => {
    const fakeWriteKey = DEMO_READ_KEY.replace('r_', 'w_');
    const response = await apiRequest('PUT', `/w/${fakeWriteKey}/test.md`, {
      body: { content: 'This should fail' },
    });

    expect([403, 404]).toContain(response.status);
  });
});
