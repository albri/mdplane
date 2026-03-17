import type { ElysiaContextSet, HandlerResponse } from './types'

type IdempotencyRecord = {
  responseStatus: number
  responseBody: string
}

export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key')
}

export function applyIdempotencyReplay(
  record: IdempotencyRecord | null | undefined,
  set: ElysiaContextSet
): boolean {
  if (!record) {
    return false
  }

  set.status = record.responseStatus
  set.headers['Content-Type'] = 'application/json'
  set.headers['Idempotency-Replayed'] = 'true'
  return true
}

export function getRequestAuditContext(request: Request): {
  ipAddress: string | undefined
  userAgent: string | undefined
} {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  }
}

export function applyHandlerResponse<T>(
  result: HandlerResponse<T>,
  set: ElysiaContextSet
): T {
  set.status = result.status
  set.headers['Content-Type'] = 'application/json'
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      set.headers[key] = value
    }
  }
  return result.body
}
