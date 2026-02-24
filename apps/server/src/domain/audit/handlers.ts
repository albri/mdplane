import type { AuditAction, AuditLogFilters, ResourceType } from '../../services/audit';
import { getAuditLogs } from '../../services/audit';
import { db } from '../../db';
import type { CapabilityKeyRecord, KeyValidationResult, Permission } from '../../shared';
import { validateCapabilityKeyForCapabilityRoute } from '../../shared';

async function validateAndGetKey(
  keyString: string,
  requiredPermission?: Permission
): Promise<KeyValidationResult> {
  return validateCapabilityKeyForCapabilityRoute({
    keyString,
    lookupByHash: async (keyHash) => {
      const keyRecord = await db.query.capabilityKeys.findFirst({
        where: (fields, { eq }) => eq(fields.keyHash, keyHash),
      });
      return keyRecord as CapabilityKeyRecord | null;
    },
    requiredPermission,
  });
}

export async function handleGetAuditLogs(input: {
  key: string;
  query: {
    action?: string;
    resourceType?: string;
    actor?: string;
    since?: string;
    until?: string;
    limit?: number;
    cursor?: string;
  };
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const keyResult = await validateAndGetKey(input.key, 'write');
  if (!keyResult.ok) {
    return {
      status: keyResult.status,
      body: { ok: false, error: keyResult.error },
    };
  }

  const filters: AuditLogFilters = {
    action: input.query.action as AuditAction | undefined,
    resourceType: input.query.resourceType as ResourceType | undefined,
    actor: input.query.actor,
    since: input.query.since ? new Date(input.query.since) : undefined,
    until: input.query.until ? new Date(input.query.until) : undefined,
    limit: input.query.limit,
    cursor: input.query.cursor,
  };

  const result = await getAuditLogs(keyResult.key.workspaceId, filters);

  return {
    status: 200,
    body: {
      ok: true,
      data: result.logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId ?? undefined,
        resourcePath: log.resourcePath ?? undefined,
        actor: log.actor ?? undefined,
        actorType: log.actorType as 'capability_url' | 'api_key' | 'session' | undefined ?? undefined,
        metadata: log.metadata ?? undefined,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        total: result.pagination.total,
        limit: result.pagination.limit,
        cursor: result.pagination.cursor,
        hasMore: result.pagination.hasMore,
      },
    },
  };
}
