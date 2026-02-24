import { hashKey, validateKey } from '../core/capability-keys'
import { evaluateApiKeyLifecycle } from './api-key-lifecycle'
import { getBearerToken } from './auth-header'

type UnauthorizedError = {
  code: 'UNAUTHORIZED'
  message: string
}

type UnauthorizedResult = {
  ok: false
  status: 401
  error: UnauthorizedError
}

export type ApiKeyLookupRecord = {
  id: string
  workspaceId: string
  scopes?: string | null
  expiresAt?: string | null
  revokedAt?: string | null
}

type ValidateApiKeyOptions = {
  invalidKeyMessage?: string
  enforceFormat?: boolean
}

type ValidateApiKeyFromHeaderOptions = ValidateApiKeyOptions & {
  missingHeaderMessage?: string
}

type ValidateApiKeyTokenWithLookupInput<T extends ApiKeyLookupRecord> = {
  token: string
  lookupByHash: (keyHash: string) => T | null
  options?: ValidateApiKeyOptions
}

type ValidateApiKeyFromAuthorizationHeaderWithLookupInput<T extends ApiKeyLookupRecord> = {
  authorizationHeader: string | null
  lookupByHash: (keyHash: string) => T | null
  options?: ValidateApiKeyFromHeaderOptions
}

type ValidateApiKeyFromRequestWithLookupInput<T extends ApiKeyLookupRecord> = {
  request: Request
  lookupByHash: (keyHash: string) => T | null
  options?: ValidateApiKeyFromHeaderOptions
}

type ParseApiKeyScopesInput<T extends string> = {
  rawScopes: string | null | undefined
  allowedScopes: readonly T[]
  invalidKeyMessage?: string
}

const DEFAULT_INVALID_MESSAGE = 'Invalid API key'
const DEFAULT_MISSING_HEADER_MESSAGE = 'Authorization header required'

function unauthorized(message: string): UnauthorizedResult {
  return {
    ok: false,
    status: 401,
    error: { code: 'UNAUTHORIZED', message },
  }
}

export function validateApiKeyTokenWithLookup<T extends ApiKeyLookupRecord>({
  token,
  lookupByHash,
  options,
}: ValidateApiKeyTokenWithLookupInput<T>): { ok: true; key: T } | UnauthorizedResult {
  const invalidMessage = options?.invalidKeyMessage ?? DEFAULT_INVALID_MESSAGE
  const enforceFormat = options?.enforceFormat ?? true

  if (enforceFormat && !validateKey(token, 'api')) {
    return unauthorized(invalidMessage)
  }

  const keyHash = hashKey(token)
  const keyRecord = lookupByHash(keyHash)

  if (!keyRecord) {
    return unauthorized(invalidMessage)
  }

  const lifecycleError = evaluateApiKeyLifecycle({
    revokedAt: keyRecord.revokedAt ?? null,
    expiresAt: keyRecord.expiresAt ?? null,
  })

  if (lifecycleError) {
    return unauthorized(lifecycleError.error.message || invalidMessage)
  }

  return { ok: true, key: keyRecord }
}

export function validateApiKeyFromAuthorizationHeaderWithLookup<T extends ApiKeyLookupRecord>({
  authorizationHeader,
  lookupByHash,
  options,
}: ValidateApiKeyFromAuthorizationHeaderWithLookupInput<T>): { ok: true; key: T } | UnauthorizedResult {
  const missingHeaderMessage = options?.missingHeaderMessage ?? DEFAULT_MISSING_HEADER_MESSAGE
  const invalidKeyMessage = options?.invalidKeyMessage ?? DEFAULT_INVALID_MESSAGE

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return unauthorized(missingHeaderMessage)
  }

  const token = authorizationHeader.substring(7)
  if (!token) {
    return unauthorized(missingHeaderMessage)
  }

  return validateApiKeyTokenWithLookup({
    token,
    lookupByHash,
    options: {
      invalidKeyMessage,
      enforceFormat: options?.enforceFormat,
    },
  })
}

export function validateApiKeyFromRequestWithLookup<T extends ApiKeyLookupRecord>({
  request,
  lookupByHash,
  options,
}: ValidateApiKeyFromRequestWithLookupInput<T>): { ok: true; key: T } | UnauthorizedResult {
  const token = getBearerToken(request)
  if (!token) {
    return unauthorized(options?.missingHeaderMessage ?? DEFAULT_MISSING_HEADER_MESSAGE)
  }

  return validateApiKeyTokenWithLookup({ token, lookupByHash, options })
}

export function parseApiKeyScopes<T extends string>({
  rawScopes,
  allowedScopes,
  invalidKeyMessage = DEFAULT_INVALID_MESSAGE,
}: ParseApiKeyScopesInput<T>): { ok: true; scopes: T[] } | UnauthorizedResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawScopes || '[]')
  } catch {
    return unauthorized(invalidKeyMessage)
  }

  if (!Array.isArray(parsed)) {
    return unauthorized(invalidKeyMessage)
  }

  for (const scope of parsed) {
    if (typeof scope !== 'string' || !allowedScopes.includes(scope as T)) {
      return unauthorized(invalidKeyMessage)
    }
  }

  return { ok: true, scopes: parsed as T[] }
}
