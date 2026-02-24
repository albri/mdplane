import { Elysia } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { zAppendRequest, zMultiAppendRequest, zAppendResponse, zError } from '@mdplane/shared';
import type { AppendItem, AppendType as GeneratedAppendType, Priority } from '@mdplane/shared';
import { db, sqlite } from '../../db';
import { capabilityKeys, files } from '../../db/schema';
import { hashKey } from '../../core/capability-keys';
import type { KeyValidationResult, Permission } from '../../shared';

type AppendRequestBody = {
  author: string;
  type?: GeneratedAppendType;
  content?: string;
  ref?: string;
  priority?: Priority;
  labels?: string[];
  dueAt?: string;
  assigned?: string;
  value?: '+1' | '-1';
  relatedTo?: string[];
  expiresInSeconds?: number;
  appends?: AppendItem[];
};

const zAppendRequestBody = z.union([zAppendRequest, zMultiAppendRequest]);

type HandleAppendRequestInput = {
  key: string;
  path: string;
  body: AppendRequestBody;
  idempotencyKey: string | null;
  keyResult: KeyValidationResult;
};

type HandleAppendRequest = (
  input: HandleAppendRequestInput,
) => Promise<{ status: number; body: Record<string, unknown>; headers?: Record<string, string> }>;

type CreateAppendPathRoutesInput = {
  validateAndGetKey: (keyString: string, requiredPermission?: Permission) => Promise<KeyValidationResult>;
  handleAppendRequest: HandleAppendRequest;
};

async function handleAppendStats(input: {
  key: string;
  request: Request;
  validateAndGetKey: (keyString: string, requiredPermission?: Permission) => Promise<KeyValidationResult>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { key, request, validateAndGetKey } = input;

  const rawUrl = request.url;
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_PATH', message: 'Path traversal not allowed' } },
    };
  }

  const keyResult = await validateAndGetKey(key, 'append');
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const capKey = await db.query.capabilityKeys.findFirst({
    where: eq(capabilityKeys.keyHash, hashKey(key)),
  });
  if (!capKey) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'INVALID_KEY', message: 'Invalid or missing capability key' } },
    };
  }

  let file;
  if (capKey.scopeType === 'file' && capKey.scopePath) {
    file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        eq(files.path, capKey.scopePath)
      ),
    });
  } else {
    file = await db.query.files.findFirst({
      where: and(
        eq(files.workspaceId, keyResult.key.workspaceId),
        isNull(files.deletedAt)
      ),
      orderBy: (fileFields, { asc }) => [asc(fileFields.createdAt), asc(fileFields.path)],
    });
  }

  if (!file) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
    };
  }

  if (file.deletedAt) {
    return {
      status: 410,
      body: {
        ok: false,
        error: {
          code: 'FILE_DELETED',
          message: 'File has been deleted',
          deletedAt: file.deletedAt,
        },
      },
    };
  }

  const now = new Date().toISOString();

  const appendCountResult = sqlite.query(
    `SELECT COUNT(*) as count FROM appends WHERE file_id = ?`
  ).get(file.id) as { count: number };
  const appendCount = appendCountResult?.count ?? 0;

  const taskStatsResult = sqlite.query(`
      WITH tasks AS (
        SELECT append_id FROM appends
        WHERE file_id = ? AND type = 'task'
      ),
      active_claims AS (
        SELECT DISTINCT ref FROM appends
        WHERE file_id = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
      ),
      completed_tasks AS (
        SELECT DISTINCT ref FROM appends
        WHERE file_id = ? AND type = 'response'
      ),
      active_claim_count AS (
        SELECT COUNT(*) as count FROM appends
        WHERE file_id = ? AND type = 'claim' AND status = 'active' AND expires_at > ?
      )
      SELECT
        (SELECT COUNT(*) FROM tasks WHERE append_id NOT IN (SELECT ref FROM active_claims) AND append_id NOT IN (SELECT ref FROM completed_tasks)) as pending,
        (SELECT COUNT(*) FROM tasks WHERE append_id IN (SELECT ref FROM active_claims) AND append_id NOT IN (SELECT ref FROM completed_tasks)) as claimed,
        (SELECT COUNT(*) FROM tasks WHERE append_id IN (SELECT ref FROM completed_tasks)) as completed,
        (SELECT count FROM active_claim_count) as activeClaims
    `).get(file.id, file.id, now, file.id, file.id, now) as {
    pending: number;
    claimed: number;
    completed: number;
    activeClaims: number;
  };

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        appendCount,
        taskStats: {
          pending: taskStatsResult?.pending ?? 0,
          claimed: taskStatsResult?.claimed ?? 0,
          completed: taskStatsResult?.completed ?? 0,
          activeClaims: taskStatsResult?.activeClaims ?? 0,
        },
      },
    },
  };
}

export const createAppendPathRoutes = ({
  validateAndGetKey,
  handleAppendRequest,
}: CreateAppendPathRoutesInput) => new Elysia()
  .post('/a/:key/*', async ({ params, body, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';
    const idempotencyKey = request.headers.get('Idempotency-Key');

    const keyResult = await validateAndGetKey(key, 'append');
    const result = await handleAppendRequest({
      key,
      path,
      body: body as AppendRequestBody,
      idempotencyKey,
      keyResult,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    if (result.headers) {
      Object.assign(set.headers, result.headers);
    }
    return result.body;
  }, {
    body: zAppendRequestBody,
    response: {
      201: zAppendResponse,
      400: zError,
      404: zError,
      409: zError,
      410: zError,
      413: zError,
      429: zError,
    },
  })
  .post('/w/:key/*', async ({ params, body, set, request }) => {
    const key = params.key;
    const path = (params as Record<string, string>)['*'] || '';
    const idempotencyKey = request.headers.get('Idempotency-Key');

    const keyResult = await validateAndGetKey(key, 'append');
    const result = await handleAppendRequest({
      key,
      path,
      body: body as AppendRequestBody,
      idempotencyKey,
      keyResult,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    if (result.headers) {
      Object.assign(set.headers, result.headers);
    }
    return result.body;
  }, {
    body: zAppendRequestBody,
    response: {
      201: zAppendResponse,
      400: zError,
      404: zError,
      409: zError,
      410: zError,
      413: zError,
      429: zError,
    },
  })
  .get('/a/:key/ops/file/stats', async ({ params, set, request }) => {
    const result = await handleAppendStats({
      key: params.key,
      request,
      validateAndGetKey,
    });

    set.status = result.status;
    set.headers['Content-Type'] = 'application/json';
    return result.body;
  });
