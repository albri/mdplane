import { describe, expect, test, beforeEach } from 'bun:test';
import { sqlite } from '../../../db';
import { generateKey, hashKey } from '../../../core/capability-keys';
import { createJob, getJobById, updateJob } from '../handlers';
import type { JobStatus } from '../types';

function resetJobsTable(): void {
  sqlite.exec('DELETE FROM jobs');
}

function createTestJob(status: JobStatus, type = 'test'): string {
  const jobKey = `job_test_${generateKey(16)}`;
  const keyHash = hashKey(jobKey);
  const jobId = `job_${generateKey(8)}`;
  const now = new Date().toISOString();

  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(jobId, keyHash, 'ws_jobs_domain', status, type, now);

  return jobKey;
}

function getJobIdFromKey(jobKey: string): string {
  const keyHash = hashKey(jobKey);
  const row = sqlite.query(`SELECT id FROM jobs WHERE key_hash = ?`).get(keyHash) as { id: string } | null;
  expect(row).not.toBeNull();
  return row!.id;
}

function getRecordProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (!(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

describe('jobs handlers', () => {
  beforeEach(() => {
    resetJobsTable();
  });

  test('createJob should create job when workspace and type contain quotes', () => {
    const workspaceId = "ws_quotes_'_test";
    const type = "exp'ort \"quoted\" type";

    const { jobId, jobKey } = createJob({ workspaceId, type });

    expect(jobKey.startsWith('job_')).toBe(true);
    expect(jobId.startsWith('job_')).toBe(true);

    const job = getJobById(jobId);
    expect(job).toBeDefined();
    expect(job?.workspaceId).toBe(workspaceId);
    expect(job?.type).toBe(type);
  });

  test('updateJob should update JSON fields containing quotes', () => {
    const jobKey = createTestJob('pending');
    const jobId = getJobIdFromKey(jobKey);

    const result = updateJob(jobId, {
      status: 'processing',
      progress: {
        current: 50,
        total: 100,
        message: "It's working! 'Quote' test \"double quote\"",
      },
      result: {
        data: 'Result with "quotes" and \'apostrophes\'',
        nested: {
          value: 'Test "with" mixed \'quotes\'',
        },
      },
    });

    expect(result).toBe(true);

    const job = getJobById(jobId);
    expect(job).toBeDefined();
    expect(job!.status).toBe('processing');
    expect(job!.progress?.message).toBe("It's working! 'Quote' test \"double quote\"");
    expect(getRecordProperty(job!.result, 'data')).toBe('Result with "quotes" and \'apostrophes\'');
    const nested = getRecordProperty(job!.result, 'nested');
    expect(getRecordProperty(nested, 'value')).toBe('Test "with" mixed \'quotes\'');
  });

  test('updateJob should safely handle SQL-looking jobId values', () => {
    const jobKey = createTestJob('pending');
    const actualJobId = getJobIdFromKey(jobKey);
    const maliciousJobId = `${actualJobId}' OR '1'='1`;

    const result = updateJob(maliciousJobId, { status: 'completed' });

    expect(result).toBe(true);
    const originalJob = getJobById(actualJobId);
    expect(originalJob).toBeDefined();
    expect(originalJob!.status).toBe('pending');
    expect(getJobById(maliciousJobId)).toBeUndefined();
  });
});
