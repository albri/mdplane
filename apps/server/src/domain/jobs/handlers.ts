import { sqlite } from '../../db';
import { generateKey, hashKey } from '../../core/capability-keys';
import type {
  CreateJobInput,
  Job,
  JobError,
  JobPollResponseData,
  JobProgress,
  JobRow,
  JobStatus,
} from './types';

export function validateJobKeyFormat(key: string): boolean {
  return /^[A-Za-z0-9_]{20,}$/.test(key);
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    keyHash: row.key_hash,
    workspaceId: row.workspace_id,
    status: row.status as JobStatus,
    type: row.type,
    progress: row.progress ? JSON.parse(row.progress) : undefined,
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error ? JSON.parse(row.error) : undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

export function getJobByKey(key: string): Job | undefined {
  const keyHash = hashKey(key);
  const row = sqlite.query(`SELECT * FROM jobs WHERE key_hash = ?`).get(keyHash) as JobRow | null;
  if (!row) {
    return undefined;
  }
  return rowToJob(row);
}

export function isJobExpired(job: Job): boolean {
  if (!job.expiresAt) {
    return false;
  }
  return new Date(job.expiresAt) < new Date();
}

export function createJob({ workspaceId, type, options: _options }: CreateJobInput): { jobKey: string; jobId: string } {
  const jobKey = `job_${generateKey(20)}`;
  const keyHash = hashKey(jobKey);
  const jobId = `job_${generateKey(8)}`;
  const now = new Date().toISOString();

  sqlite.query(`
    INSERT INTO jobs (id, key_hash, workspace_id, status, type, created_at)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).run(jobId, keyHash, workspaceId, type, now);

  return { jobKey, jobId };
}

export function updateJob(
  jobId: string,
  updates: {
    status?: JobStatus;
    progress?: JobProgress;
    result?: Record<string, unknown>;
    error?: JobError;
    completedAt?: string;
    expiresAt?: string;
  }
): boolean {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  if (updates.progress !== undefined) {
    setClauses.push('progress = ?');
    params.push(JSON.stringify(updates.progress));
  }
  if (updates.result !== undefined) {
    setClauses.push('result = ?');
    params.push(JSON.stringify(updates.result));
  }
  if (updates.error !== undefined) {
    setClauses.push('error = ?');
    params.push(JSON.stringify(updates.error));
  }
  if (updates.completedAt !== undefined) {
    setClauses.push('completed_at = ?');
    params.push(updates.completedAt);
  }
  if (updates.expiresAt !== undefined) {
    setClauses.push('expires_at = ?');
    params.push(updates.expiresAt);
  }

  if (setClauses.length === 0) {
    return false;
  }

  params.push(jobId);
  const stmt = sqlite.prepare(`UPDATE jobs SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...params);
  return true;
}

export function getJobById(jobId: string): Job | undefined {
  const row = sqlite.query(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as JobRow | null;
  if (!row) {
    return undefined;
  }
  return rowToJob(row);
}

export function toJobPollResponseData(job: Job): JobPollResponseData {
  const responseData: JobPollResponseData = {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
  };

  if (job.progress) {
    responseData.progress = job.progress;
  }

  if (job.status === 'completed' && job.result) {
    responseData.result = job.result;
    responseData.completedAt = job.completedAt;
  }

  if (job.status === 'failed' && job.error) {
    responseData.error = job.error;
    responseData.completedAt = job.completedAt;
  }

  return responseData;
}
