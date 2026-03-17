import type {
  ExtractData,
  KeyRevokeResponse,
  ScopedKeyCreateResponse,
  ScopedKeyListResponse,
} from '@mdplane/shared';

export type Permission = 'read' | 'append' | 'write';

export type KeyRecord = {
  id: string;
  workspaceId: string;
  prefix: string;
  keyHash: string;
  permission: Permission;
  scopeType: string;
  scopePath: string | null;
  boundAuthor: string | null;
  wipLimit: number | null;
  allowedTypes: string | null;
  displayName: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type ScopeType = 'workspace' | 'folder' | 'file';

export type CapabilitiesCheckResult = {
  key: string;
  valid: boolean;
  error?: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED';
  permission?: Permission;
  scope?: ScopeType;
  scopeId?: string;
  path?: string;
  status?: 'active' | 'expired' | 'revoked';
};

export type CreateKeyInput = {
  workspaceId: string;
  parentPermission: Permission;
  requestedPermission: string;
  paths?: string[];
  boundAuthor?: string;
  allowedTypes?: string[];
  wipLimit?: number;
  displayName?: string;
  expiresAt?: string;
};

export type CreateKeyResult =
  | { ok: true; data: CreateKeyData }
  | { ok: false; status: number; error: { code: string; message: string } };

export type CreateKeyData = ExtractData<ScopedKeyCreateResponse>;

export type ListKeysInput = {
  workspaceId: string;
  includeRevoked: boolean;
};

export type ListKeysResult = { ok: true; data: ListKeyItem[] };

export type ListKeyItem = ExtractData<ScopedKeyListResponse>[number];

export type RevokeKeyInput = {
  workspaceId: string;
  keyId: string;
};

export type RevokeKeyResult =
  | { ok: true; data: ExtractData<KeyRevokeResponse> }
  | { ok: false; status: number; error: { code: 'KEY_NOT_FOUND'; message: string } };

