import type {
  CreateApiKeyData,
  CreateExportJobData,
  DeletedFileEntry,
  DeletedFilesListResponse,
  DownloadExportJobData,
  ExportJobCreateResponse,
  ExportJobStatusResponse,
  GetExportJobStatusData,
} from '@mdplane/shared';

export const VALID_SCOPES = ['read', 'append', 'write', 'export'] as const;
export type Scope = CreateApiKeyData['body']['permissions'][number];

export const VALID_FORMATS = ['zip', 'tar.gz'] as const;
export type ExportFormat = NonNullable<CreateExportJobData['body']['format']>;

export const VALID_JOB_STATUSES = ['queued', 'processing', 'ready', 'failed', 'expired'] as const;
export type JobStatus = ExportJobStatusResponse['data']['status'];

export type ExportProgress = NonNullable<ExportJobStatusResponse['data']['progress']>;

export type AuthenticatedKey = {
  id: string;
  workspaceId: string;
  scopes: Scope[];
};

export type ExportAuthResult =
  | { ok: true; key: AuthenticatedKey }
  | { ok: false; status: number; error: { code: 'UNAUTHORIZED'; message: string } };

export type SyncExportInput = {
  workspaceId: string;
  format: ExportFormat;
  includeAppends: boolean;
  includeDeleted: boolean;
  filterPaths: string[] | null;
};

export type CreateJobInput = {
  workspaceId: string;
  format: ExportFormat;
  include?: string[];
  notifyEmail?: string;
  folder?: string;
};

export type CreateJobResult = {
  jobId: ExportJobCreateResponse['data']['jobId'];
  status: Extract<ExportJobCreateResponse['data']['status'], 'queued'>;
  statusUrl: ExportJobCreateResponse['data']['statusUrl'];
  estimatedSize: NonNullable<ExportJobCreateResponse['data']['estimatedSize']>;
  position: NonNullable<ExportJobCreateResponse['data']['position']>;
};

export type ListDeletedInput = {
  workspaceId: string;
  limit: number;
  cursor?: string;
};

export type DeletedFileInfo = DeletedFileEntry;

export type ListDeletedResult = {
  files: DeletedFilesListResponse['data']['files'];
  pagination: {
    cursor?: NonNullable<DeletedFilesListResponse['pagination']>['cursor'];
    hasMore: boolean;
    total: number;
  };
};

export type GetJobStatusInput = {
  jobId: GetExportJobStatusData['path']['jobId'];
  workspaceId: string;
};

export type JobStatusResult = ExportJobStatusResponse['data'];

export type DownloadJobInput = {
  jobId: DownloadExportJobData['path']['jobId'];
  workspaceId: string;
};

