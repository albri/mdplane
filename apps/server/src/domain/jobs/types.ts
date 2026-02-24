import type { ExtractData, JobResponse, JobStatus as SharedJobStatus } from '@mdplane/shared';

export type JobStatus = SharedJobStatus;
export type JobPollResponseData = ExtractData<JobResponse>;

export type JobProgress = NonNullable<JobPollResponseData['progress']>;

export type JobError = NonNullable<JobPollResponseData['error']>;

export interface Job {
  id: string;
  keyHash: string;
  workspaceId: string;
  status: JobStatus;
  type: string;
  progress?: JobProgress;
  result?: Record<string, unknown>;
  error?: JobError;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export type JobRow = {
  id: string;
  key_hash: string;
  workspace_id: string;
  status: string;
  type: string;
  progress: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
};

export type CreateJobInput = {
  workspaceId: string;
  type: string;
  options?: {
    expiresIn?: number;
  };
};
