import { eq, and } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { exportJobs as exportJobsTable } from '../../db/schema';
import type {
  SyncExportInput,
  CreateJobInput,
  CreateJobResult,
  ListDeletedInput,
  ListDeletedResult,
  GetJobStatusInput,
  JobStatusResult,
  DownloadJobInput,
  ExportProgress,
  JobStatus,
} from './types';
import { generateJobId, computeChecksum, formatExportDate, formatEstimatedSize, RETENTION_WINDOW_MS } from './utils';
import { VALID_FORMATS } from './types';

type ExportErrorCode = 'INVALID_REQUEST' | 'JOB_NOT_FOUND' | 'JOB_NOT_READY';

type HandlerResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: { code: ExportErrorCode; message: string; details?: Record<string, unknown> } };

export function buildSyncExportPayload(input: SyncExportInput): {
  contentBuffer: Buffer;
  checksum: string;
  filename: string;
  contentType: string;
  fileCount: number;
  appendCount: number;
} {
  const deletedCondition = input.includeDeleted ? '' : 'AND deleted_at IS NULL';

  const workspaceFiles = sqlite
    .query(`SELECT id, path, content, created_at, updated_at, deleted_at FROM files WHERE workspace_id = ? ${deletedCondition}`)
    .all(input.workspaceId) as Array<{
    id: string; path: string; content: string; created_at: string; updated_at: string; deleted_at: string | null;
  }>;

  let filteredFiles = workspaceFiles;
  if (input.filterPaths && input.filterPaths.length > 0) {
    filteredFiles = workspaceFiles.filter(file => {
      return input.filterPaths!.some(filterPath => {
        const normalizedFilter = filterPath.startsWith('/') ? filterPath : '/' + filterPath;
        return file.path.startsWith(normalizedFilter + '/') || file.path === normalizedFilter;
      });
    });
  }

  let appendsByFileId = new Map<string, Array<{
    id: string; author: string; type: string; status: string; createdAt: string; content: string;
  }>>();

  if (input.includeAppends) {
    const fileIds = filteredFiles.map(f => f.id);
    if (fileIds.length > 0) {
      const placeholders = fileIds.map(() => '?').join(',');
      const appendRows = sqlite
        .query(`SELECT id, file_id, author, type, status, created_at, content_preview FROM appends WHERE file_id IN (${placeholders})`)
        .all(...fileIds) as Array<{
        id: string; file_id: string; author: string; type: string; status: string; created_at: string; content_preview: string;
      }>;

      for (const append of appendRows) {
        const existing = appendsByFileId.get(append.file_id) || [];
        existing.push({
          id: append.id,
          author: append.author,
          type: append.type,
          status: append.status,
          createdAt: append.created_at,
          content: append.content_preview,
        });
        appendsByFileId.set(append.file_id, existing);
      }
    }
  }

  const exportFiles = filteredFiles.map(f => {
    const base: Record<string, unknown> = {
      id: f.id,
      path: f.path,
      content: f.content,
      created_at: f.created_at,
      updated_at: f.updated_at,
    };
    if (f.deleted_at) base.deletedAt = f.deleted_at;
    if (input.includeAppends) base.appends = appendsByFileId.get(f.id) || [];
    return base;
  });

  let totalAppends = 0;
  if (input.includeAppends) {
    for (const appends of appendsByFileId.values()) {
      totalAppends += appends.length;
    }
  }

  const manifest: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    consistency: 'eventual',
    files: filteredFiles.map(f => {
      const fileManifest: Record<string, unknown> = {
        path: f.path.startsWith('/') ? f.path.substring(1) : f.path,
        sha256: new Bun.CryptoHasher('sha256').update(f.content).digest('hex'),
        size: Buffer.byteLength(f.content, 'utf-8'),
        modifiedAt: f.updated_at,
      };
      if (f.deleted_at) fileManifest.deletedAt = f.deleted_at;
      return fileManifest;
    }),
    options: {
      includeAppends: input.includeAppends,
      includeDeleted: input.includeDeleted,
      paths: input.filterPaths || [],
    },
  };

  if (input.includeAppends) {
    manifest.stats = { totalFiles: filteredFiles.length, totalAppends };
  }

  const archiveContent = JSON.stringify({ manifest, files: exportFiles }, null, 2);
  const contentBuffer = Buffer.from(archiveContent, 'utf-8');
  const checksum = computeChecksum(contentBuffer);
  const contentType = input.format === 'zip' ? 'application/zip' : 'application/gzip';
  const filename = `workspace-export-${formatExportDate()}.${input.format}`;

  return { contentBuffer, checksum, filename, contentType, fileCount: filteredFiles.length, appendCount: totalAppends };
}

export function handleCreateJob(input: CreateJobInput): HandlerResult<CreateJobResult> {
  if (!VALID_FORMATS.includes(input.format)) {
    return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Invalid format. Use zip or tar.gz' } };
  }

  const sizeResult = sqlite
    .query(`SELECT storage_used_bytes, (SELECT COUNT(*) FROM files WHERE workspace_id = w.id AND deleted_at IS NULL) as file_count FROM workspaces w WHERE id = ?`)
    .get(input.workspaceId) as { storage_used_bytes: number; file_count: number };

  const estimatedBytes = sizeResult?.storage_used_bytes || 0;
  const estimatedSize = formatEstimatedSize(estimatedBytes);

  const jobId = generateJobId();
  const now = new Date().toISOString();

  const queueCount = db.select().from(exportJobsTable).where(eq(exportJobsTable.status, 'queued')).all();
  const position = queueCount.length + 1;

  db.insert(exportJobsTable).values({
    id: jobId,
    workspaceId: input.workspaceId,
    status: 'queued',
    format: input.format,
    include: JSON.stringify(input.include || []),
    notifyEmail: input.notifyEmail,
    folder: input.folder,
    createdAt: now,
    position,
  }).run();

  return {
    ok: true,
    data: { jobId, status: 'queued' as const, statusUrl: `/api/v1/export/jobs/${jobId}`, estimatedSize, position },
  };
}

export function handleListDeleted(input: ListDeletedInput): ListDeletedResult {
  const cutoffDate = new Date(Date.now() - RETENTION_WINDOW_MS).toISOString();

  let deletedFiles: Array<{ id: string; path: string; content: string; deleted_at: string }>;

  if (input.cursor) {
    deletedFiles = sqlite
      .query(`SELECT id, path, content, deleted_at FROM files WHERE workspace_id = ? AND deleted_at IS NOT NULL AND deleted_at > ? AND deleted_at < ? ORDER BY deleted_at DESC LIMIT ?`)
      .all(input.workspaceId, cutoffDate, input.cursor, input.limit + 1) as typeof deletedFiles;
  } else {
    deletedFiles = sqlite
      .query(`SELECT id, path, content, deleted_at FROM files WHERE workspace_id = ? AND deleted_at IS NOT NULL AND deleted_at > ? ORDER BY deleted_at DESC LIMIT ?`)
      .all(input.workspaceId, cutoffDate, input.limit + 1) as typeof deletedFiles;
  }

  const hasMore = deletedFiles.length > input.limit;
  if (hasMore) deletedFiles = deletedFiles.slice(0, input.limit);

  const totalResult = sqlite
    .query(`SELECT COUNT(*) as count FROM files WHERE workspace_id = ? AND deleted_at IS NOT NULL AND deleted_at > ?`)
    .get(input.workspaceId, cutoffDate) as { count: number };

  const files = deletedFiles.map((f) => {
    const deletedAt = f.deleted_at;
    const expiresAt = new Date(new Date(deletedAt).getTime() + RETENTION_WINDOW_MS).toISOString();
    return { id: f.id, path: f.path, deletedAt, expiresAt, size: Buffer.byteLength(f.content, 'utf-8') };
  });

  const nextCursor = hasMore && files.length > 0 ? files[files.length - 1].deletedAt : undefined;

  return { files, pagination: { cursor: nextCursor, hasMore, total: totalResult.count } };
}

export function handleGetJobStatus(input: GetJobStatusInput): HandlerResult<JobStatusResult> {
  const job = db.select().from(exportJobsTable)
    .where(and(eq(exportJobsTable.id, input.jobId), eq(exportJobsTable.workspaceId, input.workspaceId)))
    .get();

  if (!job) {
    return { ok: false, status: 404, error: { code: 'JOB_NOT_FOUND', message: 'Export job not found' } };
  }

  const response: JobStatusResult = { id: job.id, status: job.status as JobStatus };

  if (job.status === 'processing' && job.progress) {
    response.progress = JSON.parse(job.progress) as ExportProgress;
    response.startedAt = job.startedAt ?? undefined;
  }

  if (job.status === 'ready') {
    response.downloadUrl = job.downloadUrl ?? undefined;
    response.expiresAt = job.expiresAt ?? undefined;
    response.checksum = job.checksum ?? undefined;
    response.size = job.size ?? undefined;
  }

  return { ok: true, data: response };
}

export function handleDownloadJob(input: DownloadJobInput): HandlerResult<{
  contentBuffer: Buffer;
  checksum: string;
  filename: string;
  contentType: string;
  fileCount: number;
  jobId: string;
}> {
  const job = db.select().from(exportJobsTable)
    .where(and(eq(exportJobsTable.id, input.jobId), eq(exportJobsTable.workspaceId, input.workspaceId)))
    .get();

  if (!job) {
    return { ok: false, status: 404, error: { code: 'JOB_NOT_FOUND', message: 'Export job not found' } };
  }

  if (job.status !== 'ready') {
    return { ok: false, status: 403, error: { code: 'JOB_NOT_READY', message: 'Export job is not ready for download yet', details: { status: job.status } } };
  }

  const workspaceFiles = sqlite
    .query(`SELECT id, path, content, created_at, updated_at FROM files WHERE workspace_id = ? AND deleted_at IS NULL`)
    .all(input.workspaceId) as Array<{ id: string; path: string; content: string; created_at: string; updated_at: string }>;

  const manifest = {
    exportedAt: new Date().toISOString(),
    jobId: job.id,
    consistency: 'eventual',
    files: workspaceFiles.map(f => ({
      path: f.path.startsWith('/') ? f.path.substring(1) : f.path,
      sha256: new Bun.CryptoHasher('sha256').update(f.content).digest('hex'),
      size: Buffer.byteLength(f.content, 'utf-8'),
      modifiedAt: f.updated_at,
    })),
  };

  const archiveContent = JSON.stringify({ manifest, files: workspaceFiles }, null, 2);
  const contentBuffer = Buffer.from(archiveContent, 'utf-8');
  const checksum = computeChecksum(contentBuffer);
  const contentType = job.format === 'zip' ? 'application/zip' : 'application/gzip';
  const filename = `workspace-export-${formatExportDate()}.${job.format}`;

  return { ok: true, data: { contentBuffer, checksum, filename, contentType, fileCount: workspaceFiles.length, jobId: job.id } };
}

