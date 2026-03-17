import { sqlite, db } from '../../db';
import { appends } from '../../db/schema';
import { generateKey } from '../../core/capability-keys';
import type {
  RenewClaimInput,
  CompleteClaimInput,
  CancelClaimInput,
  BlockClaimInput,
  ClaimMutationResponse,
  MutationClaimResponse,
} from './types';

interface ClaimData {
  dbId: string;
  appendId: string;
  taskId: string;
  fileId: string;
  path: string;
  author: string;
  status: string | null;
  expiresAt: string | null;
  createdAt: string;
  hasResponse: boolean;
  hasCancel: boolean;
  hasBlocked: boolean;
  blockedReason: string | null;
}

type ClaimStatus = 'active' | 'expired' | 'completed' | 'cancelled' | 'blocked';

function findClaimInWorkspace(workspaceId: string, claimId: string): ClaimData | null {
  const row = sqlite.prepare(`
    SELECT
      a.id as db_id, a.append_id, a.ref as task_id, a.author, a.status,
      a.expires_at, a.created_at, f.id as file_id, f.path as file_path,
      (SELECT 1 FROM appends r WHERE r.type = 'response' AND r.ref = a.append_id AND r.file_id = a.file_id LIMIT 1) as has_response,
      (SELECT 1 FROM appends c WHERE c.type = 'cancel' AND c.ref = a.append_id AND c.file_id = a.file_id LIMIT 1) as has_cancel,
      (SELECT b.content_preview FROM appends b WHERE b.type = 'blocked' AND b.ref = a.ref AND b.file_id = a.file_id LIMIT 1) as blocked_reason
    FROM appends a
    JOIN files f ON a.file_id = f.id
    WHERE f.workspace_id = ? AND a.append_id = ? AND a.type = 'claim' AND f.deleted_at IS NULL
    LIMIT 1
  `).get(workspaceId, claimId) as {
    db_id: string; append_id: string; task_id: string; author: string; status: string | null;
    expires_at: string | null; created_at: string; file_id: string; file_path: string;
    has_response: number | null; has_cancel: number | null; blocked_reason: string | null;
  } | undefined;
  if (!row) return null;
  return {
    dbId: row.db_id, appendId: row.append_id, taskId: row.task_id, fileId: row.file_id, path: row.file_path,
    author: row.author, status: row.status, expiresAt: row.expires_at, createdAt: row.created_at,
    hasResponse: !!row.has_response, hasCancel: !!row.has_cancel, hasBlocked: !!row.blocked_reason, blockedReason: row.blocked_reason,
  };
}

function getClaimStatus(claim: ClaimData): ClaimStatus {
  if (claim.hasResponse) return 'completed';
  if (claim.hasCancel) return 'cancelled';
  if (claim.hasBlocked) return 'blocked';
  if (claim.expiresAt && new Date(claim.expiresAt) < new Date()) return 'expired';
  return 'active';
}

async function createAppend(params: { fileId: string; type: string; ref: string; author: string; expiresAt?: string; contentPreview?: string }): Promise<string> {
  const appendId = `ap_${generateKey().substring(0, 12)}`;
  const now = new Date().toISOString();
  await db.insert(appends).values({
    id: `${params.fileId}_${appendId}`, fileId: params.fileId, appendId, author: params.author,
    type: params.type, ref: params.ref, expiresAt: params.expiresAt, contentPreview: params.contentPreview, createdAt: now,
  });
  return appendId;
}

type ClaimOverrides = {
  expiresAt?: string;
  status?: ClaimStatus;
  blocked?: boolean;
  blockReason?: string;
};

function buildClaimResponse(claim: ClaimData, overrides: ClaimOverrides = {}): MutationClaimResponse {
  const now = new Date();
  const expiresAtDate = overrides.expiresAt ? new Date(overrides.expiresAt) : claim.expiresAt ? new Date(claim.expiresAt) : null;
  const status = overrides.status || getClaimStatus(claim);
  const expiresInSeconds = expiresAtDate && status === 'active' ? Math.max(0, Math.floor((expiresAtDate.getTime() - now.getTime()) / 1000)) : undefined;
  return {
    id: claim.appendId,
    taskId: claim.taskId,
    path: claim.path,
    file: { id: claim.fileId, path: claim.path },
    author: claim.author,
    expiresAt: expiresAtDate?.toISOString() ?? new Date(Date.now() + 300000).toISOString(),
    expiresInSeconds,
    status,
    blocked: overrides.blocked,
    blockReason: overrides.blockReason,
  };
}

export async function renewClaim(input: RenewClaimInput): Promise<ClaimMutationResponse> {
  const { workspaceId, claimId, expiresInSeconds = 300 } = input;
  const claim = findClaimInWorkspace(workspaceId, claimId);
  if (!claim) return { ok: false, code: 'APPEND_NOT_FOUND', message: 'Claim not found' };
  const status = getClaimStatus(claim);
  if (status !== 'active' && status !== 'expired') return { ok: false, code: 'INVALID_REQUEST', message: `Cannot renew ${status} claim` };
  const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  sqlite.prepare('UPDATE appends SET expires_at = ? WHERE id = ?').run(newExpiresAt, claim.dbId);
  const renewAppendId = await createAppend({ fileId: claim.fileId, type: 'renew', ref: claim.appendId, author: claim.author });
  return { ok: true, claim: buildClaimResponse(claim, { expiresAt: newExpiresAt, status: 'active' }), appendId: renewAppendId };
}

export async function completeClaim(input: CompleteClaimInput): Promise<ClaimMutationResponse> {
  const { workspaceId, claimId, content } = input;
  const claim = findClaimInWorkspace(workspaceId, claimId);
  if (!claim) return { ok: false, code: 'APPEND_NOT_FOUND', message: 'Claim not found' };
  const status = getClaimStatus(claim);
  if (status !== 'active') return { ok: false, code: 'INVALID_REQUEST', message: `Cannot complete ${status} claim` };
  const responseAppendId = await createAppend({ fileId: claim.fileId, type: 'response', ref: claim.appendId, author: claim.author, contentPreview: content });
  return { ok: true, claim: buildClaimResponse(claim, { status: 'completed' }), appendId: responseAppendId };
}

export async function cancelClaim(input: CancelClaimInput): Promise<ClaimMutationResponse> {
  const { workspaceId, claimId, reason } = input;
  const claim = findClaimInWorkspace(workspaceId, claimId);
  if (!claim) return { ok: false, code: 'APPEND_NOT_FOUND', message: 'Claim not found' };
  const status = getClaimStatus(claim);
  if (status !== 'active' && status !== 'expired') return { ok: false, code: 'INVALID_REQUEST', message: `Cannot cancel ${status} claim` };
  const cancelAppendId = await createAppend({ fileId: claim.fileId, type: 'cancel', ref: claim.appendId, author: claim.author, contentPreview: reason });
  return { ok: true, claim: buildClaimResponse(claim, { status: 'cancelled' }), appendId: cancelAppendId };
}

export async function blockClaim(input: BlockClaimInput): Promise<ClaimMutationResponse> {
  const { workspaceId, claimId, reason } = input;
  const claim = findClaimInWorkspace(workspaceId, claimId);
  if (!claim) return { ok: false, code: 'APPEND_NOT_FOUND', message: 'Claim not found' };
  const status = getClaimStatus(claim);
  if (status !== 'active') return { ok: false, code: 'INVALID_REQUEST', message: `Cannot block ${status} claim` };
  const blockedAppendId = await createAppend({ fileId: claim.fileId, type: 'blocked', ref: claim.taskId, author: claim.author, contentPreview: reason });
  return { ok: true, claim: buildClaimResponse(claim, { status: 'blocked', blocked: true, blockReason: reason }), appendId: blockedAppendId };
}

