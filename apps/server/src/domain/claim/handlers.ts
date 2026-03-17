import { sqlite } from '../../db';
import { auth } from '../../core/auth';
import { generateKey, hashKey } from '../../core/capability-keys';
import { clearAllRateLimits, checkRateLimit as checkRateLimitService } from '../../services/rate-limit';
import { logAction } from '../../services/audit';
import { triggerWebhooks } from '../../services/webhook-trigger';
import { serverEnv } from '../../config/env';
import { getClientIp } from '../../core/client-ip';

const APP_URL = serverEnv.appUrl;

function generateId(prefix: string): string {
  return `${prefix}_${generateKey(16)}`;
}

export function resetClaimState(): void {
  clearAllRateLimits();
}

export type ClaimWorkspaceResult = {
  status: number;
  body: {
    ok: boolean;
    error?: {
      code: string;
      message: string;
      details?: {
        retryAfterSeconds: number;
      };
    };
    data?: {
      workspaceId: string;
      claimed: true;
      message: 'claimed';
      webUrl: string;
    };
  };
};

export async function handleClaimWorkspace(key: string, request: Request): Promise<ClaimWorkspaceResult> {
  const clientIp = getClientIp(request);
  if (clientIp !== 'unknown') {
    const rateLimit = checkRateLimitService(clientIp, 'bootstrap');
    if (!rateLimit.allowed) {
      return {
        status: 429,
        body: {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many claim requests. Please try again later.',
            details: {
              retryAfterSeconds: rateLimit.retryAfter,
            },
          },
        },
      };
    }
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      status: 401,
      body: {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'OAuth session required. Login via GitHub or Google first.',
        },
      },
    };
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  const keyHash = hashKey(key);

  const workspace = sqlite
    .query(
      `
        SELECT w.id, w.claimed_at, w.claimed_by_email
        FROM workspaces w
        JOIN capability_keys ck ON ck.workspace_id = w.id
        WHERE ck.key_hash = ? AND ck.permission = 'write' AND w.deleted_at IS NULL
      `
    )
    .get(keyHash) as {
    id: string;
    claimed_at: string | null;
    claimed_by_email: string | null;
  } | null;

  if (!workspace) {
    return {
      status: 404,
      body: {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace not found',
        },
      },
    };
  }

  if (workspace.claimed_at) {
    return {
      status: 400,
      body: {
        ok: false,
        error: {
          code: 'ALREADY_CLAIMED',
          message: 'Workspace is already claimed by another user',
        },
      },
    };
  }

  const now = new Date().toISOString();

  const updateWorkspaceStmt = sqlite.prepare(
    'UPDATE workspaces SET claimed_at = ?, claimed_by_email = ? WHERE id = ?'
  );
  updateWorkspaceStmt.run(now, userEmail, workspace.id);

  const uwId = generateId('uw');
  const insertUserWorkspaceStmt = sqlite.prepare(
    'INSERT OR IGNORE INTO user_workspaces (id, user_id, workspace_id, created_at) VALUES (?, ?, ?, ?)'
  );
  insertUserWorkspaceStmt.run(uwId, userId, workspace.id, now);

  logAction({
    workspaceId: workspace.id,
    action: 'workspace.claim',
    resourceType: 'workspace',
    resourceId: workspace.id,
    actor: userId,
    actorType: 'session',
    metadata: {
      claimMethod: 'oauth',
      userEmail,
    },
  });

  triggerWebhooks(
    workspace.id,
    'workspace.claimed',
    { workspace: { id: workspace.id } }
  ).catch((err) => console.error('Webhook trigger failed:', err));

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        workspaceId: workspace.id,
        claimed: true,
        message: 'claimed',
        webUrl: `${APP_URL}/control`,
      },
    },
  };
}
