import { WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'

export const MIN_CAPABILITY_KEY_LENGTH = 22

export interface ParsedCapabilityUrl {
  keyType: 'r'
  key: string
  suffix: string
}

type ParseCapabilityUrlSuccess = { ok: true; value: ParsedCapabilityUrl }
type ParseCapabilityUrlFailure = { ok: false; error: string }
export type ParseCapabilityUrlResult = ParseCapabilityUrlSuccess | ParseCapabilityUrlFailure

const CAPABILITY_URL_PATTERN = /^\/(r)\/([a-zA-Z0-9_-]+)(\/[^?#]*)?([?#].*)?$/
const CAPABILITY_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/
const RAW_TRAVERSAL_PATTERN = /(?:^|\/)\.\.(?:\/|$)|%2e%2e/i
const RAW_CONTROL_CHARACTER_PATTERN = /%0d|%0a|%00/i

function hasControlCharacters(value: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(value)
}

function validateSuffixPath(pathSuffix: string): string | null {
  if (!pathSuffix) return null
  if (hasControlCharacters(pathSuffix)) {
    return 'Capability URL contains invalid control characters'
  }

  const rawSegments = pathSuffix.split('/').filter(Boolean)
  for (const rawSegment of rawSegments) {
    let decodedSegment = rawSegment
    try {
      decodedSegment = decodeURIComponent(rawSegment)
    } catch {
      return 'Capability URL path contains malformed encoding'
    }

    if (decodedSegment === '..') {
      return 'Path traversal is not allowed in capability URL'
    }
    if (hasControlCharacters(decodedSegment)) {
      return 'Capability URL contains invalid control characters'
    }
  }

  return null
}

export function parseCapabilityUrl(input: string): ParseCapabilityUrlResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Capability URL or key is required' }
  }
  if (RAW_TRAVERSAL_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Path traversal is not allowed in capability URL' }
  }
  if (RAW_CONTROL_CHARACTER_PATTERN.test(trimmed) || hasControlCharacters(trimmed)) {
    return { ok: false, error: 'Capability URL contains invalid control characters' }
  }

  if (
    !trimmed.includes('/') &&
    !trimmed.includes(':') &&
    !trimmed.includes('?') &&
    !trimmed.includes('#') &&
    CAPABILITY_KEY_PATTERN.test(trimmed)
  ) {
    if (trimmed.length < MIN_CAPABILITY_KEY_LENGTH) {
      return {
        ok: false,
        error: `Capability key must be at least ${MIN_CAPABILITY_KEY_LENGTH} characters`,
      }
    }
    return {
      ok: true,
      value: {
        keyType: 'r',
        key: trimmed,
        suffix: '',
      },
    }
  }

  let pathWithTail = trimmed
  if (!trimmed.startsWith('/')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost')
      pathWithTail = `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return {
        ok: false,
        error: 'Invalid capability URL. Expected format: /r/KEY',
      }
    }
  }

  const match = pathWithTail.match(CAPABILITY_URL_PATTERN)
  if (!match) {
    return {
      ok: false,
      error: 'Invalid capability URL. Expected format: /r/KEY',
    }
  }

  const keyType = match[1] as 'r'
  const key = match[2]
  const pathSuffix = match[3] ?? ''
  const trailingSuffix = match[4] ?? ''

  if (key.length < MIN_CAPABILITY_KEY_LENGTH) {
    return {
      ok: false,
      error: `Capability key must be at least ${MIN_CAPABILITY_KEY_LENGTH} characters`,
    }
  }

  const suffixError = validateSuffixPath(pathSuffix)
  if (suffixError) {
    return { ok: false, error: suffixError }
  }

  return {
    ok: true,
    value: {
      keyType,
      key,
      suffix: `${pathSuffix}${trailingSuffix}`,
    },
  }
}

export function buildCapabilityPath(key: string, suffix = ''): string {
  return `${WORKSPACE_FRONTEND_ROUTES.read(key)}${suffix}`
}
