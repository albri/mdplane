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
  if (seg === '.' || seg === '..') return false
  if (seg.includes('\\')) return false
  return true
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string; path: string[] }> }
) {
  const { key, path } = await context.params
  const apiUrl = getBackendBaseUrl()

  if (!key) {
    return jsonError(400, 'INVALID_KEY', 'Missing capability key')
  }

  const segments = (path || []).map((s) => String(s))
  if (segments.length === 0) {
    return jsonError(400, 'INVALID_PATH', 'Missing file path')
  }
  if (!segments.every(isSafePathSegment)) {
    return jsonError(400, 'INVALID_PATH', 'Path traversal not allowed')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'INVALID_REQUEST', 'Body must be valid JSON')
  }

  const url = new URL(apiUrl)
  const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/')
  const encodedKey = encodeURIComponent(key)
  url.pathname = `${CAPABILITY_ROUTES.byKeyType('a', encodedKey)}/${encodedPath}`

  const upstream = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const upstreamBody = await upstream.arrayBuffer()

  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  return new Response(upstreamBody, { status: upstream.status, headers })
}
