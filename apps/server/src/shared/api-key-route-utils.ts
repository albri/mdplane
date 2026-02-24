import { generateKey } from '../core/capability-keys'

type RateLimitResult = { allowed: boolean; retryAfter: number }

type ApiKeyRateLimiterOptions = {
  windowMs?: number
  maxKeys?: number
  getTimeUs?: () => number
}

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX_KEYS = 10

export function createApiKeyRateLimiter(options: ApiKeyRateLimiterOptions = {}) {
  const windowUs = (options.windowMs ?? DEFAULT_WINDOW_MS) * 1000
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS
  const getTimeUs = options.getTimeUs ?? (() => performance.now() * 1000)
  const timestampsByWorkspace = new Map<string, number[]>()

  function check(workspaceId: string): RateLimitResult {
    const now = getTimeUs()
    const existing = timestampsByWorkspace.get(workspaceId) ?? []
    const active = existing.filter((t) => t > now - windowUs)

    if (active.length >= maxKeys) {
      const oldest = Math.min(...active)
      const retryAfter = Math.max(1, Math.ceil((oldest + windowUs - now) / 1000000))
      return { allowed: false, retryAfter }
    }

    return { allowed: true, retryAfter: 0 }
  }

  function increment(workspaceId: string): void {
    const now = getTimeUs()
    const existing = timestampsByWorkspace.get(workspaceId) ?? []
    const active = existing.filter((t) => t > now - windowUs)
    active.push(now)
    timestampsByWorkspace.set(workspaceId, active)
  }

  function reset(): void {
    timestampsByWorkspace.clear()
  }

  return { check, increment, reset }
}

export function generateApiKeyId(): string {
  return `key_${generateKey(16)}`
}

export function sanitizeApiKeyName(name: string): string {
  return name.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

export function insufficientScopeResponse() {
  return {
    ok: false as const,
    error: { code: 'FORBIDDEN' as const, message: 'Insufficient scope' },
  }
}
