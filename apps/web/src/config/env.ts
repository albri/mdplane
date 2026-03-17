import { DEV_URLS, URLS } from '@mdplane/shared'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return fallback
}

function normalizeUrl(
  value: string,
  key: string,
  isProduction: boolean,
  fallback: string
): string {
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    if (isProduction) {
      throw new Error(`Environment variable ${key} must be a valid absolute URL`)
    }
    return fallback
  }
}

function isLocalUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return LOCAL_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

interface RuntimeResolvedEnv {
  nodeEnv: string | undefined
  publicApiUrl: string | undefined
  internalApiUrl: string | undefined
  publicAppUrl: string | undefined
  publicWsUrl: string | undefined
  publicGovernedMode: string | undefined
  publicAllowLocalhostPublicUrls: string | undefined
  allowLocalhostPublicUrls: string | undefined
}

// Keep direct process.env.NEXT_PUBLIC_* references so Next can inline client envs.
function resolveRuntimeEnv(source: NodeJS.ProcessEnv): RuntimeResolvedEnv {
  return {
    nodeEnv: source.NODE_ENV ?? process.env.NODE_ENV,
    publicApiUrl: source.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL,
    internalApiUrl: source.API_INTERNAL_URL ?? process.env.API_INTERNAL_URL,
    publicAppUrl: source.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    publicWsUrl: source.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_WS_URL,
    publicGovernedMode: source.NEXT_PUBLIC_GOVERNED_MODE ?? process.env.NEXT_PUBLIC_GOVERNED_MODE,
    publicAllowLocalhostPublicUrls:
      source.NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS ??
      process.env.NEXT_PUBLIC_MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS,
    allowLocalhostPublicUrls:
      source.MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS ?? process.env.MDPLANE_ALLOW_LOCALHOST_PUBLIC_URLS,
  }
}

function resolveApiUrl(
  value: string | undefined,
  isProduction: boolean,
  allowLocalhostPublicUrls: boolean
): string {
  if (value && value.trim() !== '') {
    const normalized = normalizeUrl(value.trim(), 'NEXT_PUBLIC_API_URL', isProduction, URLS.API)
    if (isProduction && !allowLocalhostPublicUrls && isLocalUrl(normalized)) {
      throw new Error('NEXT_PUBLIC_API_URL cannot point to localhost in production')
    }
    return normalized
  }

  return normalizeUrl(DEV_URLS.API, 'NEXT_PUBLIC_API_URL', false, DEV_URLS.API)
}

function resolveApiInternalUrl(
  value: string | undefined,
  isProduction: boolean,
  fallbackApiUrl: string
): string {
  if (value && value.trim() !== '') {
    return normalizeUrl(value.trim(), 'API_INTERNAL_URL', isProduction, fallbackApiUrl)
  }

  return normalizeUrl(fallbackApiUrl, 'API_INTERNAL_URL', false, fallbackApiUrl)
}

function resolveAppUrl(value: string | undefined, isProduction: boolean): string {
  const fallback = isProduction ? URLS.APP : DEV_URLS.APP

  if (value && value.trim() !== '') {
    return normalizeUrl(value.trim(), 'NEXT_PUBLIC_APP_URL', isProduction, fallback)
  }

  return normalizeUrl(fallback, 'NEXT_PUBLIC_APP_URL', false, fallback)
}

function resolveWsUrl(
  value: string | undefined,
  isProduction: boolean,
  allowLocalhostPublicUrls: boolean,
  apiUrl: string
): string {
  if (value && value.trim() !== '') {
    const normalized = normalizeUrl(value.trim(), 'NEXT_PUBLIC_WS_URL', isProduction, URLS.WS)
    if (isProduction && !allowLocalhostPublicUrls && isLocalUrl(normalized)) {
      throw new Error('NEXT_PUBLIC_WS_URL cannot point to localhost in production')
    }
    return normalized
  }

  if (isProduction) {
    const parsedApiUrl = new URL(apiUrl)
    const wsProtocol = parsedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    parsedApiUrl.protocol = wsProtocol
    parsedApiUrl.pathname = '/ws'
    parsedApiUrl.search = ''
    parsedApiUrl.hash = ''
    return parsedApiUrl.toString().replace(/\/$/, '')
  }

  return normalizeUrl('ws://127.0.0.1:3001/ws', 'NEXT_PUBLIC_WS_URL', false, 'ws://127.0.0.1:3001/ws')
}

export interface WebEnv {
  nodeEnv: string
  isProduction: boolean
  apiUrl: string
  apiInternalUrl: string
  appUrl: string
  wsUrl: string
  governedModeEnabled: boolean
}

export function readWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const runtime = resolveRuntimeEnv(source)
  const nodeEnv = runtime.nodeEnv || 'development'
  const isProduction = nodeEnv === 'production'
  const localhostOverride = isProduction
    ? runtime.publicAllowLocalhostPublicUrls
    : runtime.publicAllowLocalhostPublicUrls ?? runtime.allowLocalhostPublicUrls
  const allowLocalhostPublicUrls = parseBoolean(localhostOverride, false)
  const apiUrl = resolveApiUrl(runtime.publicApiUrl, isProduction, allowLocalhostPublicUrls)

  return {
    nodeEnv,
    isProduction,
    apiUrl,
    apiInternalUrl: resolveApiInternalUrl(runtime.internalApiUrl, isProduction, apiUrl),
    appUrl: resolveAppUrl(runtime.publicAppUrl, isProduction),
    wsUrl: resolveWsUrl(runtime.publicWsUrl, isProduction, allowLocalhostPublicUrls, apiUrl),
    governedModeEnabled: parseBoolean(runtime.publicGovernedMode, true),
  }
}

export const webEnv = readWebEnv()
