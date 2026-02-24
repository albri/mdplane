import type { ErrorCode } from '../core/errors';

export type Permission = 'read' | 'append' | 'write';
export type ScopeType = 'workspace' | 'folder' | 'file';
export type KeyTier = Permission;

export interface CapabilityKeyRecord {
  id: string;
  workspaceId: string;
  permission: Permission;
  scopeType?: ScopeType;
  scopePath?: string | null;
  boundAuthor?: string | null;
  wipLimit?: number | null;
  allowedTypes?: string | null;
  displayName?: string | null;
  prefix?: string;
  keyHash?: string;
  createdAt?: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface ExtendedCapabilityKeyRecord extends CapabilityKeyRecord {
  prefix: string;
  keyHash: string;
  scopeType: ScopeType;
  createdAt: string;
}

export interface ElysiaContextSet {
  headers: Record<string, string | number | undefined>;
  status?: number | string;
  redirect?: string;
}

export interface HandlerResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export interface WorkspaceKeys {
  readKey: string | null;
  appendKey: string | null;
  writeKey: string | null;
}

export interface SubfolderData {
  childCount: number;
  latestModified: string;
}

export interface ValidationError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type KeyValidationResult =
  | {
      ok: true;
      key: CapabilityKeyRecord;
    }
  | {
      ok: false;
      error: ValidationError;
      status: number;
    };

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  scopes?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

