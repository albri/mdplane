import type { BootstrapRequest } from '@mdplane/shared';
import { db } from '../../db';
import { capabilityKeys, workspaces } from '../../db/schema';
import { generateKey, hashKey } from '../../core/capability-keys';
import { serverEnv } from '../../config/env';

const BASE_URL = serverEnv.baseUrl;
const APP_URL = serverEnv.appUrl;

function generateWorkspaceId(): string {
  const suffix = generateKey(12);
  return `ws_${suffix}`;
}

function generateId(): string {
  return generateKey(16);
}

function generateRequestId(): string {
  return generateKey(24);
}

export async function handleBootstrap(body: BootstrapRequest): Promise<{
  requestId: string;
  response: {
    ok: true;
    data: {
      workspaceId: string;
      keys: {
        read: string;
        append: string;
        write: string;
      };
      urls: {
        api: {
          read: string;
          append: string;
          write: string;
        };
        web: {
          read: string;
          claim: string;
        };
      };
      createdAt: string;
    };
  };
}> {
  const requestId = generateRequestId();
  const workspaceId = generateWorkspaceId();
  const now = new Date().toISOString();

  const readKey = generateKey();
  const appendKey = generateKey();
  const writeKey = generateKey();

  const readKeyHash = hashKey(readKey);
  const appendKeyHash = hashKey(appendKey);
  const writeKeyHash = hashKey(writeKey);

  await db.insert(workspaces).values({
    id: workspaceId,
    name: body.workspaceName.trim(),
    createdAt: now,
    lastActivityAt: now,
    storageUsedBytes: 0,
  });

  const keyRecords = [
    {
      id: generateId(),
      workspaceId,
      prefix: readKey.substring(0, 4),
      keyHash: readKeyHash,
      permission: 'read' as const,
      scopeType: 'workspace' as const,
      scopePath: '/',
      createdAt: now,
    },
    {
      id: generateId(),
      workspaceId,
      prefix: appendKey.substring(0, 4),
      keyHash: appendKeyHash,
      permission: 'append' as const,
      scopeType: 'workspace' as const,
      scopePath: '/',
      createdAt: now,
    },
    {
      id: generateId(),
      workspaceId,
      prefix: writeKey.substring(0, 4),
      keyHash: writeKeyHash,
      permission: 'write' as const,
      scopeType: 'workspace' as const,
      scopePath: '/',
      createdAt: now,
    },
  ];

  for (const record of keyRecords) {
    await db.insert(capabilityKeys).values(record);
  }

  return {
    requestId,
    response: {
      ok: true,
      data: {
        workspaceId,
        keys: {
          read: readKey,
          append: appendKey,
          write: writeKey,
        },
        urls: {
          api: {
            read: `${BASE_URL}/r/${readKey}`,
            append: `${BASE_URL}/a/${appendKey}`,
            write: `${BASE_URL}/w/${writeKey}`,
          },
          web: {
            read: `${APP_URL}/r/${readKey}`,
            claim: `${APP_URL}/claim/${writeKey}`,
          },
        },
        createdAt: now,
      },
    },
  };
}
