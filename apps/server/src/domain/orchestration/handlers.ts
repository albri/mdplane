import { db } from '../../db';
import type { CapabilityKeyRecord, KeyValidationResult, Permission } from '../../shared';
import { validateCapabilityKeyForCapabilityRoute } from '../../shared';
import { queryOrchestrationBoard } from './query';
import type { OrchestrationBoard, OrchestrationQueryFilters } from './types';
import type { GetOrchestrationReadOnlyQuery } from '@mdplane/shared';
import { serverEnv } from '../../config/env';

const APP_URL = serverEnv.appUrl;

export type GetOrchestrationBoardResult =
  | { ok: true; data: OrchestrationBoard; webUrl: string }
  | { ok: false; status: number; error: { code: string; message: string } };

async function validateOrchestrationKey(
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

function buildFilters(query: GetOrchestrationReadOnlyQuery): OrchestrationQueryFilters {
  return {
    status: query.status,
    agent: query.agent,
    file: query.file,
    folder: query.folder,
    priority: query.priority,
    since: query.since,
    limit: query.limit,
    cursor: query.cursor,
  };
}

export async function getOrchestrationBoardForKey(input: {
  keyString: string;
  query: GetOrchestrationReadOnlyQuery;
  requiredPermission?: Permission;
  includeAdminFields: boolean;
}): Promise<GetOrchestrationBoardResult> {
  const keyResult = await validateOrchestrationKey(input.keyString, input.requiredPermission);
  if (!keyResult.ok) {
    return { ok: false, status: keyResult.status, error: keyResult.error };
  }

  const data = queryOrchestrationBoard(
    keyResult.key.workspaceId,
    buildFilters(input.query),
    input.includeAdminFields
  );
  return { ok: true, data, webUrl: `${APP_URL}/control` };
}
