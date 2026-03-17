import { statSync } from 'node:fs';
import { getIsoTimestamp, getUptimeSeconds } from '../../core/process-runtime';
import { serverEnv } from '../../config/env';
import { sqlite } from '../../db';
import { getActiveConnectionCount } from '../websocket/connection';
import { isWebSocketModuleInitialized } from '../websocket/init';
import type { ComponentStatus, RegionStatus, StatusResponseBody, SystemStatus, WebSocketStatus } from './types';

const DEGRADED_DB_LATENCY_MS = 150;
const DEGRADED_STORAGE_USAGE_RATIO = 0.9;
const DEGRADED_STORAGE_LATENCY_MS = 50;
const DEGRADED_WEBSOCKET_LATENCY_MS = 50;

type ComponentHealth = {
  status: ComponentStatus;
  latencyMs?: number;
};

type WebSocketHealth = {
  status: WebSocketStatus['status'];
  latencyMs?: number;
  activeConnections?: number;
};

export function deriveOverallSystemStatus(componentStatuses: ComponentStatus[]): SystemStatus {
  if (componentStatuses.some((status) => status === 'down')) {
    return 'major_outage';
  }

  const degradedCount = componentStatuses.filter((status) => status === 'degraded').length;
  if (degradedCount >= 2) {
    return 'partial_outage';
  }
  if (degradedCount === 1) {
    return 'degraded';
  }

  return 'operational';
}

export function buildDatabaseHealthCheck(
  runProbe: () => void = () => {
    sqlite.query<{ ok: number }, []>('SELECT 1 as ok').get();
  }
): ComponentHealth {
  const started = performance.now();
  try {
    runProbe();
    const latencyMs = Math.max(0, Math.round((performance.now() - started) * 100) / 100);
    return {
      status: latencyMs > DEGRADED_DB_LATENCY_MS ? 'degraded' : 'operational',
      latencyMs,
    };
  } catch {
    return { status: 'down' };
  }
}

export function buildStorageHealthCheck(
  databasePath: string = serverEnv.databaseUrl,
  maxVolumeBytes: number = serverEnv.maxVolumeSizeBytes,
  readStats: (path: string) => { size: number } = statSync
): ComponentHealth {
  const started = performance.now();

  if (databasePath === ':memory:') {
    return { status: 'operational', latencyMs: 0 };
  }

  try {
    const stats = readStats(databasePath);
    const latencyMs = Math.max(0, Math.round((performance.now() - started) * 100) / 100);

    if (maxVolumeBytes <= 0) {
      return { status: latencyMs > DEGRADED_STORAGE_LATENCY_MS ? 'degraded' : 'operational', latencyMs };
    }

    const usageRatio = stats.size / maxVolumeBytes;
    if (usageRatio >= DEGRADED_STORAGE_USAGE_RATIO || latencyMs > DEGRADED_STORAGE_LATENCY_MS) {
      return { status: 'degraded', latencyMs };
    }

    return { status: 'operational', latencyMs };
  } catch {
    return { status: 'down' };
  }
}

export function buildWebSocketHealthCheck(
  isInitialized: () => boolean = isWebSocketModuleInitialized,
  readActiveConnections: () => number = getActiveConnectionCount
): WebSocketHealth {
  const started = performance.now();

  try {
    if (!isInitialized()) {
      return { status: 'down' };
    }

    const activeConnections = readActiveConnections();
    const latencyMs = Math.max(0, Math.round((performance.now() - started) * 100) / 100);

    return {
      status: latencyMs > DEGRADED_WEBSOCKET_LATENCY_MS ? 'degraded' : 'operational',
      latencyMs,
      activeConnections,
    };
  } catch {
    return { status: 'down' };
  }
}

function deriveRegionStatus(componentStatuses: ComponentStatus[]): RegionStatus['status'] {
  if (componentStatuses.some((status) => status === 'down')) {
    return 'down';
  }
  if (componentStatuses.some((status) => status === 'degraded')) {
    return 'degraded';
  }
  return 'operational';
}

export function buildStatusResponse(): StatusResponseBody {
  const database = buildDatabaseHealthCheck();
  const storage = buildStorageHealthCheck();
  const websocket = buildWebSocketHealthCheck();
  const componentStatuses: ComponentStatus[] = [database.status, storage.status, websocket.status];
  const status = deriveOverallSystemStatus(componentStatuses);
  const nowMs = Date.now();
  const regionName =
    process.env.RAILWAY_REGION?.trim()
    || process.env.FLY_REGION?.trim()
    || process.env.AWS_REGION?.trim()
    || 'global';

  return {
    ok: true,
    data: {
      status,
      timestamp: getIsoTimestamp(nowMs),
      environment: serverEnv.nodeEnv,
      uptimeSeconds: getUptimeSeconds(nowMs),
      version: serverEnv.packageVersion,
      database,
      storage: { status: storage.status, latencyMs: storage.latencyMs },
      websocket,
      regions: [
        {
          name: regionName,
          status: deriveRegionStatus(componentStatuses),
        },
      ],
    },
  };
}
