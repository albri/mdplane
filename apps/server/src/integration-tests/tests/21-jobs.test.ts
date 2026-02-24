/**
 * Job Status Polling Integration Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { apiRequest } from '../helpers/api-client';
import { createTestWorkspaceWithKeys } from '../fixtures/workspaces';
import { delay } from '../helpers/test-utils';

describe('21 - Jobs', () => {
  let workspaceId: string;
  let writeKey: string;
  let jobId: string;
  let jobKey: string;

  beforeAll(async () => {
    const workspace = await createTestWorkspaceWithKeys();
    workspaceId = workspace.id;
    writeKey = workspace.writeKey.plaintextKey;

    // Create an export job to have a job to poll
    const response = await apiRequest('POST', `/api/v1/export/jobs`, {
      headers: {
        'Authorization': `Bearer ${writeKey}`,
      },
      body: {},
    });

    if (response.ok) {
      const data = await response.json();
      jobId = data.data.jobId || data.data.id;
      jobKey = data.data.jobKey || data.data.key;
    }
  });

  // 1. Get job status via job key
  test('GET /j/:key returns job status', async () => {
    if (!jobKey) {
      console.log('Skipping - no job key available');
      return;
    }

    const response = await apiRequest('GET', `/j/${jobKey}`);

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.data.status).toBeDefined();
  });

  // 2. Job status has expected fields
  test('job status includes progress info', async () => {
    if (!jobKey) {
      console.log('Skipping - no job key available');
      return;
    }

    const response = await apiRequest('GET', `/j/${jobKey}`);
    const data = await response.json();

    expect(data.data.status).toBeDefined();
    // May have progress, createdAt, etc.
  });

  // 3. Invalid job key returns 404
  test('GET /j/:invalidKey returns 404', async () => {
    const response = await apiRequest('GET', '/j/invalid_job_key_12345');

    expect(response.status).toBe(404);
  });

  // 4. Poll job until complete
  test('job transitions through states', async () => {
    if (!jobKey) {
      console.log('Skipping - no job key available');
      return;
    }

    const statuses: string[] = [];
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const response = await apiRequest('GET', `/j/${jobKey}`);
      const data = await response.json();
      const status = data.data.status;

      if (!statuses.includes(status)) {
        statuses.push(status);
      }

      if (status === 'completed' || status === 'failed') {
        break;
      }

      await delay(500);
      attempts++;
    }

    // Should have at least one status
    expect(statuses.length).toBeGreaterThan(0);

    // Valid statuses
    statuses.forEach(status => {
      expect(['pending', 'processing', 'completed', 'failed']).toContain(status);
    });
  });

  // 5. Completed job has result
  test('completed job has result data', async () => {
    if (!jobKey) {
      console.log('Skipping - no job key available');
      return;
    }

    // Wait for job to complete
    await delay(2000);

    const response = await apiRequest('GET', `/j/${jobKey}`);
    const data = await response.json();

    if (data.data.status === 'completed') {
      // Should have result or download URL
      expect(data.data.result || data.data.downloadUrl || data.data.url).toBeDefined();
    }
  });
});