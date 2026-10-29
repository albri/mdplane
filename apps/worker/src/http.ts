import type { Problem } from '@mdplane/contract'
import type { ZodError } from 'zod'
import type { Failure } from './workspace.ts'

const TITLES: Record<Problem['code'], string> = {
  invalid_request: 'The request is invalid',
  not_found: 'Not found',
  task_claimed: 'The task is claimed',
  task_closed: 'The task is closed',
  invalid_ref: 'No such task',
  idempotency_key_reused: 'The idempotency key was already used',
  precondition_failed: 'The precondition failed',
  precondition_required: 'A precondition is required',
  payload_too_large: 'The body is too large',
  workspace_full: 'The workspace is full',
  rate_limited: 'Too many requests',
  creation_paused: 'Creating workspaces is paused',
  upgrade_required: 'A WebSocket upgrade is required',
  internal_error: 'Something went wrong',
}

export function problem(failure: Failure, headers: Record<string, string> = {}): Response {
  const { status, code, ...rest } = failure
  const body: Problem = {
    type: `https://mdplane.dev/problems/${code}`,
    title: TITLES[code],
    status,
    code,
    ...rest,
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })
}

// One response for every way a key can fail, so a caller can't tell a wrong key from a missing
// workspace, a revoked link, the wrong tier or an expired workspace.
export const notFound = () => problem({ status: 404, code: 'not_found' })

export const invalid = (detail: string) => problem({ status: 400, code: 'invalid_request', detail })

export function invalidFrom(error: ZodError): Response {
  const [issue] = error.issues
  if (!issue) return invalid('The request is invalid.')
  const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return invalid(`${where}${issue.message}`)
}

export const tooLarge = (limit: number) =>
  problem({ status: 413, code: 'payload_too_large', detail: `The limit is ${limit} bytes.` })

export const rateLimited = () =>
  problem(
    { status: 429, code: 'rate_limited', detail: 'Wait a minute, then try again.' },
    { 'Retry-After': '60' },
  )

export const paused = (detail: string, retryAfterSeconds?: number) =>
  problem(
    { status: 503, code: 'creation_paused', detail },
    retryAfterSeconds === undefined ? {} : { 'Retry-After': String(retryAfterSeconds) },
  )

// What a per-address limit counts against. An IPv6 client is usually given a whole /64, so the
// /64 counts as one address; otherwise one machine could hand every request a new address.
export function clientAddress(ip: string | undefined): string {
  if (!ip) return 'unknown'
  if (!ip.includes(':')) return ip
  const [head = '', tail] = ip.toLowerCase().split('::')
  const left = head === '' ? [] : head.split(':')
  const right = tail === undefined || tail === '' ? [] : tail.split(':')
  const zeros =
    tail === undefined ? [] : Array.from({ length: 8 - left.length - right.length }, () => '0')
  const groups = [...left, ...zeros, ...right].slice(0, 4).map((g) => g.padStart(4, '0'))
  return `${groups.join(':')}::/64`
}

// Picks the offer the Accept header ranks highest. Ties go to the earliest offer, so `*/*` and
// a missing header get the first.
export function negotiate<T extends string>(accept: string | undefined, offers: readonly T[]): T {
  const [fallback] = offers
  if (fallback === undefined) throw new Error('No offers')
  if (!accept) return fallback
  const ranges = accept.split(',').map((part) => {
    const [range = '', ...params] = part.split(';').map((s) => s.trim().toLowerCase())
    const q = params.find((p) => p.startsWith('q='))
    return { range, q: q ? Number(q.slice(2)) : 1 }
  })
  let best = fallback
  let bestQ = 0
  for (const offer of offers) {
    const family = `${offer.split('/')[0]}/*`
    let specificity = -1
    let q = 0
    for (const range of ranges) {
      const s =
        range.range === offer ? 2 : range.range === family ? 1 : range.range === '*/*' ? 0 : -1
      if (s > specificity) {
        specificity = s
        q = range.q
      }
    }
    if (q > bestQ) {
      best = offer
      bestQ = q
    }
  }
  return best
}

// Reads a body without trusting Content-Length, which a client can leave out or get wrong.
export async function readBody(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > limit) return null
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > limit) return null
  return new TextDecoder().decode(bytes)
}
