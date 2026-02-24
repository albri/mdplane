import { hashKey, validateKey } from '../core/capability-keys'
import type { ErrorCode } from '../core/errors'
import type { CapabilityKeyRecord, KeyValidationResult, Permission, ScopeType } from './types'

export type CapabilityKeyState = {
  permission: string
  scopeType?: ScopeType
  scopePath?: string | null
  revokedAt?: string | null
  expiresAt?: string | null
}

type ValidationErrorConfig = {
  status: number
  code: ErrorCode
  message: string
}

type ValidationConfig = {
  invalidKey?: ValidationErrorConfig
  revoked?: ValidationErrorConfig
  expired?: ValidationErrorConfig
  permissionDenied?: ValidationErrorConfig
}

type EvaluateCapabilityKeyRecordInput = {
  keyRecord: CapabilityKeyState | null
  requiredPermission?: Permission
  config?: ValidationConfig
}

type ValidateCapabilityKeyWithLookupInput<T extends CapabilityKeyRecord> = {
  keyString: string
  lookupByHash: (keyHash: string) => T | null
  requiredPermission?: Permission
  config?: ValidationConfig
}

type ValidateCapabilityKeyWithAsyncLookupInput<T extends CapabilityKeyRecord> = {
  keyString: string
  lookupByHash: (keyHash: string) => Promise<T | null>
  requiredPermission?: Permission
  config?: ValidationConfig
}

const DEFAULT_CONFIG: Required<ValidationConfig> = {
  invalidKey: { status: 404, code: 'INVALID_KEY', message: 'Invalid or missing capability key' },
  revoked: { status: 404, code: 'KEY_REVOKED', message: 'Capability key has been revoked' },
  expired: { status: 404, code: 'KEY_EXPIRED', message: 'Capability key has expired' },
  permissionDenied: { status: 404, code: 'PERMISSION_DENIED', message: 'Insufficient permissions for this operation' },
}

const PERMISSION_LEVELS: Record<Permission, number> = {
  read: 1,
  append: 2,
  write: 3,
}

function hasValidScopeBinding(keyRecord: CapabilityKeyState): boolean {
  if (keyRecord.scopeType === 'workspace') {
    return true
  }

  if (keyRecord.scopeType === 'file' || keyRecord.scopeType === 'folder') {
    if (typeof keyRecord.scopePath !== 'string') {
      return false
    }
    return keyRecord.scopePath.trim().length > 0
  }

  return false
}

export function detectPathTraversalFromKeyAndPathHint(
  keyInput: unknown,
  pathHint?: string
): KeyValidationResult | null {
  if (!pathHint) {
    return null
  }

  if (typeof keyInput !== 'string') {
    return null
  }

  const keyString = keyInput
  const keyLooksLikeSystemPath = keyString.length < 10 && /^[a-z]+$/.test(keyString)
  const pathHasFileExtension = /\.[a-zA-Z0-9]+$/.test(pathHint)
  const firstPathSegment = pathHint.split('/')[0] || ''
  const pathLooksLikeSystemPath = !pathHasFileExtension && /^[a-z]+$/.test(firstPathSegment)

  if (!keyLooksLikeSystemPath || !pathLooksLikeSystemPath) {
    return null
  }

  return {
    ok: false,
    status: 400,
    error: { code: 'INVALID_PATH' as ErrorCode, message: 'Path traversal not allowed' },
  }
}

export function isCapabilityKeyFormatValid(keyString: string): boolean {
  if (!keyString || keyString.length < 22) {
    return false
  }

  return validateKey(keyString, 'root') || validateKey(keyString, 'scoped')
}

export function hasRequiredPermission(actualPermission: Permission, requiredPermission: Permission): boolean {
  if (requiredPermission === 'read') {
    return true
  }

  if (requiredPermission === 'write') {
    return actualPermission === 'write'
  }

  return PERMISSION_LEVELS[actualPermission] >= PERMISSION_LEVELS.append
}

export function evaluateCapabilityKeyRecord(
  { keyRecord, requiredPermission, config }: EvaluateCapabilityKeyRecordInput
): KeyValidationResult | null {
  const effective = {
    invalidKey: config?.invalidKey ?? DEFAULT_CONFIG.invalidKey,
    revoked: config?.revoked ?? DEFAULT_CONFIG.revoked,
    expired: config?.expired ?? DEFAULT_CONFIG.expired,
    permissionDenied: config?.permissionDenied ?? DEFAULT_CONFIG.permissionDenied,
  }

  if (!keyRecord) {
    return {
      ok: false,
      status: effective.invalidKey.status,
      error: { code: effective.invalidKey.code, message: effective.invalidKey.message },
    }
  }

  if (!hasValidScopeBinding(keyRecord)) {
    return {
      ok: false,
      status: effective.invalidKey.status,
      error: { code: effective.invalidKey.code, message: effective.invalidKey.message },
    }
  }

  if (keyRecord.revokedAt != null) {
    return {
      ok: false,
      status: effective.revoked.status,
      error: { code: effective.revoked.code, message: effective.revoked.message },
    }
  }

  if (keyRecord.expiresAt != null && new Date(keyRecord.expiresAt) < new Date()) {
    return {
      ok: false,
      status: effective.expired.status,
      error: { code: effective.expired.code, message: effective.expired.message },
    }
  }

  if (requiredPermission) {
    const actualPermission = keyRecord.permission as Permission
    if (!hasRequiredPermission(actualPermission, requiredPermission)) {
      return {
        ok: false,
        status: effective.permissionDenied.status,
        error: {
          code: effective.permissionDenied.code,
          message: effective.permissionDenied.message,
        },
      }
    }
  }

  return null
}

export function validateCapabilityKeyWithLookup<T extends CapabilityKeyRecord>(
  { keyString, lookupByHash, requiredPermission, config }: ValidateCapabilityKeyWithLookupInput<T>
): { ok: true; key: T } | KeyValidationResult {
  const effectiveInvalid = config?.invalidKey ?? DEFAULT_CONFIG.invalidKey

  if (!isCapabilityKeyFormatValid(keyString)) {
    return {
      ok: false,
      status: effectiveInvalid.status,
      error: { code: effectiveInvalid.code, message: effectiveInvalid.message },
    }
  }

  const keyHash = hashKey(keyString)
  const keyRecord = lookupByHash(keyHash)

  const validationError = evaluateCapabilityKeyRecord({ keyRecord, requiredPermission, config })
  if (validationError) {
    return validationError
  }

  return { ok: true, key: keyRecord as T }
}

export async function validateCapabilityKeyWithAsyncLookup<T extends CapabilityKeyRecord>(
  {
    keyString,
    lookupByHash,
    requiredPermission,
    config,
  }: ValidateCapabilityKeyWithAsyncLookupInput<T>
): Promise<{ ok: true; key: T } | KeyValidationResult> {
  const effectiveInvalid = config?.invalidKey ?? DEFAULT_CONFIG.invalidKey

  if (!isCapabilityKeyFormatValid(keyString)) {
    return {
      ok: false,
      status: effectiveInvalid.status,
      error: { code: effectiveInvalid.code, message: effectiveInvalid.message },
    }
  }

  const keyHash = hashKey(keyString)
  const keyRecord = await lookupByHash(keyHash)

  const validationError = evaluateCapabilityKeyRecord({ keyRecord, requiredPermission, config })
  if (validationError) {
    return validationError
  }

  return { ok: true, key: keyRecord as T }
}

type ValidateCapabilityKeyForCapabilityRouteInput<T extends CapabilityKeyRecord> = {
  keyString: string
  lookupByHash: (keyHash: string) => Promise<T | null>
  requiredPermission?: Permission
  pathHint?: string
  config?: ValidationConfig
}

export async function validateCapabilityKeyForCapabilityRoute<T extends CapabilityKeyRecord>(
  { keyString, lookupByHash, requiredPermission, pathHint, config }: ValidateCapabilityKeyForCapabilityRouteInput<T>
): Promise<{ ok: true; key: T } | KeyValidationResult> {
  if (!isCapabilityKeyFormatValid(keyString)) {
    const pathTraversalError = detectPathTraversalFromKeyAndPathHint(keyString, pathHint)
    if (pathTraversalError) {
      return pathTraversalError
    }

    const invalidKey = config?.invalidKey ?? DEFAULT_CONFIG.invalidKey
    return {
      ok: false,
      status: invalidKey.status,
      error: { code: invalidKey.code, message: invalidKey.message },
    }
  }

  return validateCapabilityKeyWithAsyncLookup({
    keyString,
    lookupByHash,
    requiredPermission,
    config,
  })
}
