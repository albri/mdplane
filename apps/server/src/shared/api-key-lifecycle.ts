import type { ErrorCode } from '../core/errors'

type ApiKeyLifecycleRecord = {
  revokedAt: string | null
  expiresAt: string | null
}

type ApiKeyLifecycleError = {
  status: number
  error: {
    code: ErrorCode
    message: string
  }
}

const DEFAULT_LIFECYCLE_ERROR: ApiKeyLifecycleError = {
  status: 401,
  error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
}

export function evaluateApiKeyLifecycle(record: ApiKeyLifecycleRecord): ApiKeyLifecycleError | null {
  if (record.revokedAt) {
    return DEFAULT_LIFECYCLE_ERROR
  }

  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return DEFAULT_LIFECYCLE_ERROR
  }

  return null
}
