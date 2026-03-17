import type { NextRequest } from 'next/server'
import { getBackendBaseUrl } from '@/lib/server/get-backend-base-url'

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params
  const apiUrl = getBackendBaseUrl()

  if (!key) {
    return jsonError(400, 'INVALID_KEY', 'Missing capability key')
  }

  const url = new URL(apiUrl)
  url.pathname = `/r/${encodeURIComponent(key)}/orchestration`
  url.search = request.nextUrl.search

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  })

  const body = await upstream.arrayBuffer()

  const headers = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  return new Response(body, { status: upstream.status, headers })
}

