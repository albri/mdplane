import type { NextRequest } from 'next/server'
import { CAPABILITY_ROUTES } from '@mdplane/shared'
import { getBackendBaseUrl } from '@/lib/server/get-backend-base-url'

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isSafePathSegment(seg: string): boolean {
  // Reject dot-segments to prevent URL normalization escaping `/r/:key/*`.
  if (seg === '.' || seg === '..') return false
  // Reject Windows-style separators as defense-in-depth.
  if (seg.includes('\\')) return false
  return true
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string; path: string[] }> }
) {
  const { key, path } = await context.params
  const apiUrl = getBackendBaseUrl()

  if (!key) {
    return jsonError(400, 'INVALID_KEY', 'Missing capability key')
  }

  const segments = (path || []).map((s) => String(s))
  if (!segments.every(isSafePathSegment)) {
    return jsonError(400, 'INVALID_PATH', 'Path traversal not allowed')
  }

  const url = new URL(apiUrl)
  const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/')
  const encodedKey = encodeURIComponent(key)
  url.pathname = encodedPath
    ? `${CAPABILITY_ROUTES.read(encodedKey)}/${encodedPath}`
    : CAPABILITY_ROUTES.read(encodedKey)
  url.search = request.nextUrl.search

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: request.headers.get('accept') || 'application/json',
    },
  })

  const body = await upstream.arrayBuffer()

  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const etag = upstream.headers.get('etag')
  if (etag) headers.set('etag', etag)

  return new Response(body, { status: upstream.status, headers })
}
