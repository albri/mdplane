import { sqlite } from '../../../db';
import { generateKey, hashKey } from '../../../core/capability-keys';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
type Job = {
  id: string;
  keyHash: string;
  workspaceId: string;
  status: JobStatus;
  type: string;
  progress: string | null;
  result: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

export const TEST_PENDING_JOB_KEY = 'job_pending_testkey123456';
export const TEST_PROCESSING_JOB_KEY = 'job_processing_testkey456';
export const TEST_COMPLETED_JOB_KEY = 'job_completed_testkey789';
export const TEST_FAILED_JOB_KEY = 'job_failed_testkey000111';

const TEST_WORKSPACE_ID = 'ws_test_jobs';

export function resetJobsTestData(): void {
  sqlite.exec('DELETE FROM jobs');
  setupTestFixtures();
}

export function createTestJob(
  status: JobStatus,
  options?: Partial<Omit<Job, 'id' | 'keyHash' | 'status'>>
): string {
  const jobKey = `job_test_${generateKey(16)}`;
  const keyHash = hashKey(jobKey);
  const now = new Date().toISOString();
  const jobId = `job_${generateKey(8)}`;

  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, progress, result, error, created_at, completed_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    keyHash,
    options?.workspaceId || TEST_WORKSPACE_ID,
    status,
    options?.type || 'test',
    options?.progress ? JSON.stringify(options.progress) : null,
    options?.result ? JSON.stringify(options.result) : null,
    options?.error ? JSON.stringify(options.error) : null,
    options?.createdAt || now,
    options?.completedAt ?? null,
    options?.expiresAt ?? null
  );

  return jobKey;
}

function setupTestFixtures(): void {
  const now = new Date().toISOString();
  const completedAt = new Date().toISOString();

  const pendingHash = hashKey(TEST_PENDING_JOB_KEY);
  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('job_pending_001', pendingHash, TEST_WORKSPACE_ID, 'pending', 'export', now);

  const processingHash = hashKey(TEST_PROCESSING_JOB_KEY);
  const processingProgress = JSON.stringify({ current: 25, total: 100, message: 'Processing files...' });
  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, progress, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('job_processing_001', processingHash, TEST_WORKSPACE_ID, 'processing', 'export', processingProgress, now);

  const completedHash = hashKey(TEST_COMPLETED_JOB_KEY);
  const completedResult = JSON.stringify({ downloadUrl: 'https://example.com/download/xyz' });
  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, result, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('job_completed_001', completedHash, TEST_WORKSPACE_ID, 'completed', 'export', completedResult, now, completedAt);

  const failedHash = hashKey(TEST_FAILED_JOB_KEY);
  const failedError = JSON.stringify({ code: 'EXPORT_FAILED', message: 'Export failed due to timeout' });
  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, error, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('job_failed_001', failedHash, TEST_WORKSPACE_ID, 'failed', 'export', failedError, now, completedAt);
}
