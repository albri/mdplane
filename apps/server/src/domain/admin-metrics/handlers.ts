import { timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import { and, isNull, sql } from 'drizzle-orm';
import { db, sqlite } from '../../db';
import { capabilityKeys, files, folders, workspaces } from '../../db/schema';
import { readServerEnv } from '../../config/env';
import type { AdminMetricsErrorBody, AdminMetricsSuccessBody } from './types';

const SERVER_START_TIME = Date.now();

function secureCompare(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function getDatabaseSize(dbPath: string): number {
  try {
    if (dbPath === ':memory:') {
      return 0;
    }
    const stats = fs.statSync(dbPath);
    return stats.size;
  } catch {
    return 0;
  }
}

export async function handleGetAdminMetrics(
  request: Request
): Promise<{ status: number; body: AdminMetricsSuccessBody | AdminMetricsErrorBody }> {
  const env = readServerEnv();
  const adminSecret = env.adminSecret;
  if (!adminSecret) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      },
    };
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing Authorization header',
        },
      },
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Authorization format. Use: Bearer <token>',
        },
      },
    };
  }

  const token = authHeader.slice(7);
  if (!secureCompare(token, adminSecret)) {
    return {
      status: 403,
      body: {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid admin token',
        },
      },
    };
  }

  const databaseSizeBytes = getDatabaseSize(env.databaseUrl);
  const maxSizeBytes = env.maxVolumeSizeBytes;

  const [workspaceCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workspaces)
    .where(isNull(workspaces.deletedAt));
  const [fileCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(files)
    .where(isNull(files.deletedAt));
  const [folderCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(folders)
    .where(isNull(folders.deletedAt));

  let userCount = 0;
  try {
    const result = sqlite.query('SELECT COUNT(*) as count FROM user').get() as { count: number };
    userCount = result?.count ?? 0;
  } catch {
    userCount = 0;
  }

  let sessionCount = 0;
  try {
    const now = Date.now();
    const result = sqlite
      .query('SELECT COUNT(*) as count FROM session WHERE expires_at > ?')
      .get(now) as { count: number };
    sessionCount = result?.count ?? 0;
  } catch {
    sessionCount = 0;
  }

  const [keyCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(capabilityKeys)
    .where(isNull(capabilityKeys.revokedAt));

  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        storage: {
          databaseSizeBytes,
          databaseSizeMB: Math.round((databaseSizeBytes / 1024 / 1024) * 100) / 100,
          maxSizeBytes,
          maxSizeMB: Math.round((maxSizeBytes / 1024 / 1024) * 100) / 100,
          usagePercent: Math.round((databaseSizeBytes / maxSizeBytes) * 10000) / 100,
        },
        counts: {
          workspaces: workspaceCount?.count ?? 0,
          files: fileCount?.count ?? 0,
          folders: folderCount?.count ?? 0,
          users: userCount,
          activeSessions: sessionCount,
          capabilityKeys: keyCount?.count ?? 0,
        },
        quotas: {
          maxWorkspaceStorageBytes: env.maxWorkspaceStorageBytes,
          maxFileSizeBytes: env.maxFileSizeBytes,
        },
        uptime: {
          seconds: uptimeSeconds,
          formatted: formatUptime(uptimeSeconds),
        },
      },
    },
  };
}
