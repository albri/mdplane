import { sqlite } from '../../db';
import { generateKey } from '../../core/capability-keys';
import { emit } from '../../services/event-bus';
import type { CapabilityKeyRecord, Permission } from '../../shared';
import { serverEnv } from '../../config/env';
import {
  validateApiKeyFromRequestWithLookup,
  validateCapabilityKeyWithLookup,
} from '../../shared';
import type {
  ApiLivenessQuery,
  CapabilityKeyValidationResult,
  GetAgentsInput,
  HeartbeatRequestBody,
  HeartbeatRouteResult,
  HeartbeatStatus,
  ScopedLivenessQuery,
  ScopedFilter,
} from './types';
import {
  DEFAULT_STALE_THRESHOLD,
  MAX_AUTHOR_LENGTH,
  MAX_METADATA_SIZE,
  VALID_STATUSES,
} from './types';

const APP_URL = serverEnv.appUrl;

export function validateAndGetCapabilityKey({
  keyString,
  requiredPermission,
}: {
  keyString: string;
  requiredPermission?: Permission;
}): CapabilityKeyValidationResult {
  return validateCapabilityKeyWithLookup({
    keyString,
    lookupByHash: (keyHash) => {
      const keyRecord = sqlite
        .query(
          `
        SELECT id, workspace_id, permission, bound_author, scope_type, scope_path, expires_at, revoked_at
        FROM capability_keys
        WHERE key_hash = ?
      `
        )
        .get(keyHash) as {
        id: string;
        workspace_id: string;
        permission: Permission;
        bound_author: string | null;
        scope_type: 'workspace' | 'folder' | 'file';
        scope_path: string | null;
        expires_at: string | null;
        revoked_at: string | null;
      } | null;

      if (!keyRecord) {
        return null;
      }

      return {
        id: keyRecord.id,
        workspaceId: keyRecord.workspace_id,
        permission: keyRecord.permission,
        boundAuthor: keyRecord.bound_author,
        scopeType: keyRecord.scope_type,
        scopePath: keyRecord.scope_path,
        expiresAt: keyRecord.expires_at,
        revokedAt: keyRecord.revoked_at,
      };
    },
    requiredPermission,
  });
}

export function getAgents({
  workspaceId,
  staleThreshold,
  scopeFilter,
}: GetAgentsInput): Array<{
  author: string;
  lastSeen: string;
  status: string;
  stale: boolean;
  currentTask?: string;
}> {
  const now = Math.floor(Date.now() / 1000);
  const staleTime = now - staleThreshold;

  const heartbeats = sqlite.query(
    `
    SELECT author, status, current_task, last_seen, file_id
    FROM heartbeats
    WHERE workspace_id = ?
  `
  ).all(workspaceId) as Array<{
    author: string;
    status: string;
    current_task: string | null;
    last_seen: number;
    file_id: string | null;
  }>;

  let filteredHeartbeats = heartbeats;
  if (scopeFilter) {
    filteredHeartbeats = heartbeats;
  }

  return filteredHeartbeats.map((heartbeat) => {
    const isStale = heartbeat.last_seen <= staleTime;
    const result: {
      author: string;
      lastSeen: string;
      status: string;
      stale: boolean;
      currentTask?: string;
    } = {
      author: heartbeat.author,
      lastSeen: new Date(heartbeat.last_seen * 1000).toISOString(),
      status: isStale ? 'stale' : heartbeat.status,
      stale: isStale,
    };
    if (heartbeat.current_task !== null) {
      result.currentTask = heartbeat.current_task;
    }
    return result;
  });
}

export function recordHeartbeat({
  keyString,
  body,
}: {
  keyString: string;
  body: HeartbeatRequestBody;
}): HeartbeatRouteResult {
  const keyResult = validateAndGetCapabilityKey({
    keyString,
    requiredPermission: 'append',
  });
  if (!keyResult.ok) {
    return { status: keyResult.status, body: { ok: false, error: keyResult.error } };
  }

  const requestBody = body;
  if (!requestBody || !requestBody.author) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'author is required' },
      },
    };
  }

  if (requestBody.author === '') {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'author cannot be empty' },
      },
    };
  }

  if (requestBody.author.length > MAX_AUTHOR_LENGTH) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'author too long' },
      },
    };
  }

  const status = (requestBody.status as HeartbeatStatus) || 'alive';
  if (requestBody.status && !VALID_STATUSES.includes(status)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid status value' },
      },
    };
  }

  const capabilityKey = keyResult.key;
  if (capabilityKey.boundAuthor && capabilityKey.boundAuthor !== requestBody.author) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: 'AUTHOR_MISMATCH',
          message: `Key is bound to author '${capabilityKey.boundAuthor}', but heartbeat author is '${requestBody.author}'`,
        },
      },
    };
  }

  if (requestBody.metadata) {
    const metadataJson = JSON.stringify(requestBody.metadata);
    if (metadataJson.length > MAX_METADATA_SIZE) {
      return {
        status: 400,
        body: {
          ok: false,
          error: { code: 'INVALID_REQUEST', message: 'metadata too large' },
        },
      };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const metadataStr = requestBody.metadata ? JSON.stringify(requestBody.metadata) : null;
  const heartbeatId = `hb_${generateKey(16)}`;
  const expiresAt = now + DEFAULT_STALE_THRESHOLD;
  const nextHeartbeatBy = now + Math.floor(DEFAULT_STALE_THRESHOLD * 0.8);

  sqlite
    .prepare(
      `
      INSERT INTO heartbeats (workspace_id, author, status, current_task, metadata, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, author) DO UPDATE SET
        status = excluded.status,
        current_task = excluded.current_task,
        metadata = excluded.metadata,
        last_seen = excluded.last_seen
    `
    )
    .run(
      capabilityKey.workspaceId,
      requestBody.author,
      status,
      requestBody.currentTask ?? null,
      metadataStr,
      now
    );

  emit({
    type: 'heartbeat',
    workspaceId: capabilityKey.workspaceId,
    filePath: '/',
    data: {
      author: requestBody.author,
      status,
      currentTask: requestBody.currentTask,
    },
    timestamp: new Date(now * 1000).toISOString(),
  });

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: heartbeatId,
        author: requestBody.author,
        ts: new Date(now * 1000).toISOString(),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        nextHeartbeatBy: new Date(nextHeartbeatBy * 1000).toISOString(),
      },
    },
  };
}

function resolveScopeFilter({
  scopeType,
  scopePath,
  folder,
}: {
  scopeType?: string;
  scopePath?: string | null;
  folder?: string;
}): ScopedFilter | undefined {
  if (folder) {
    return { type: 'folder', path: folder };
  }
  if (scopeType) {
    return { type: scopeType, path: scopePath ?? null };
  }
  return undefined;
}

export function getApiAgentsLiveness({
  request,
  query,
}: {
  request: Request;
  query: ApiLivenessQuery;
}): HeartbeatRouteResult {
  const keyResult = validateApiKeyFromRequestWithLookup({
    request,
    lookupByHash: (keyHash) => {
      const keyRecord = sqlite
        .query(
          `
          SELECT id, workspace_id, expires_at, revoked_at
          FROM api_keys
          WHERE key_hash = ?
        `
        )
        .get(keyHash) as {
        id: string;
        workspace_id: string;
        expires_at: string | null;
        revoked_at: string | null;
      } | null;

      if (!keyRecord) {
        return null;
      }

      return {
        id: keyRecord.id,
        workspaceId: keyRecord.workspace_id,
        expiresAt: keyRecord.expires_at,
        revokedAt: keyRecord.revoked_at,
      };
    },
    options: { missingHeaderMessage: 'Authorization header required' },
  });

  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const staleThresholdSeconds = query.staleThresholdSeconds ?? DEFAULT_STALE_THRESHOLD;
  const agents = getAgents({
    workspaceId: keyResult.key.workspaceId,
    staleThreshold: staleThresholdSeconds,
    scopeFilter: resolveScopeFilter({ folder: query.folder }),
  });

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        agents,
        staleThresholdSeconds,
        webUrl: `${APP_URL}/control/${keyResult.key.workspaceId}/orchestration`,
      },
    },
  };
}

export function getScopedAgentsLiveness({
  keyString,
  query,
}: {
  keyString: string;
  query: ScopedLivenessQuery;
}): HeartbeatRouteResult {
  const keyResult = validateAndGetCapabilityKey({ keyString });
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const staleThresholdSeconds = query.staleThresholdSeconds ?? DEFAULT_STALE_THRESHOLD;
  const agents = getAgents({
    workspaceId: keyResult.key.workspaceId,
    staleThreshold: staleThresholdSeconds,
    scopeFilter: resolveScopeFilter({
      scopeType: keyResult.key.scopeType,
      scopePath: keyResult.key.scopePath,
    }),
  });

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        agents,
        staleThresholdSeconds,
        webUrl: `${APP_URL}/control/${keyResult.key.workspaceId}/orchestration`,
      },
    },
  };
}
