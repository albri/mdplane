import {
  renderFile,
  renderInstructions,
  type Tier,
  zAppendRequest,
  zCreateLinkRequest,
  zCreateWorkspaceRequest,
  zFilePath,
  zIdempotencyKey,
  zIfNoneMatch,
  zLinkId,
  zLiveQuery,
  zReadFileQuery,
  zReadLogQuery,
  zSearchQuery,
} from '@mdplane/contract'
import { type Context, Hono } from 'hono'
import {
  clientAddress,
  invalid,
  invalidFrom,
  negotiate,
  notFound,
  paused,
  problem,
  rateLimited,
  readBody,
  tooLarge,
} from './http.ts'
import { hashSecret, linkUrl, newLinkId, newSecret, newWorkspaceId, parseLink } from './keys.ts'
import { type Auth, LIMITS, type Result } from './workspace.ts'

export { Quota } from './quota.ts'
export { Workspace } from './workspace.ts'

type App = { Bindings: Env }
type Keyed = {
  workspaceId: string
  auth: Auth
  stub: DurableObjectStub<import('./workspace.ts').Workspace>
}

const ALL: readonly Tier[] = ['r', 'a', 'w']
const APPEND: readonly Tier[] = ['a', 'w']
const WRITE: readonly Tier[] = ['w']

const FILE_LIMIT = 262_144
const JSON_LIMIT = 65_536
const ENTRY_BODY_LIMIT = 16_384

const app = new Hono<App>()

// Pages load nothing from other origins, so a capability URL can't leak to one, and only lit-html
// may turn strings into HTML. The static pages get the same headers from the site's _headers file.
const PAGE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types lit-html",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

async function htmlPage(c: Context<App>, path: string, status: number): Promise<Response> {
  const asset = await c.env.ASSETS.fetch(new URL(path, c.req.url))
  return new Response(asset.body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Capability URLs must not leak through caches, the Referer header or search engines.
app.use(async (c, next) => {
  await next()
  if (c.res.status === 101) return
  // Browsers get a page instead of problem JSON. It is the same page for every 404, so it says
  // no more than the JSON does.
  if (
    c.res.status === 404 &&
    negotiate(c.req.header('Accept'), ['application/problem+json', 'text/html']) === 'text/html'
  ) {
    c.res = await htmlPage(c, '/404', 404)
  }
  c.res.headers.set('Cache-Control', 'no-store')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Robots-Tag', 'noindex')
  if (c.res.headers.get('Content-Type')?.startsWith('text/html')) {
    for (const [name, value] of Object.entries(PAGE_HEADERS)) c.res.headers.set(name, value)
  }
})

app.notFound(() => notFound())

app.onError((error) => {
  // Never log the request URL: it holds the key.
  console.error(error)
  return problem({ status: 500, code: 'internal_error' })
})

// Query strings are text; the contract's schemas expect numbers for these.
const INTEGER_PARAMS = new Set(['after', 'limit', 'at'])
function query(c: Context<App>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(c.req.query())) {
    out[name] = INTEGER_PARAMS.has(name) && /^\d{1,15}$/.test(value) ? Number(value) : value
  }
  return out
}

async function readJson(c: Context<App>): Promise<{ value: unknown } | Response> {
  const text = await readBody(c.req.raw, JSON_LIMIT)
  if (text === null) return tooLarge(JSON_LIMIT)
  if (text.trim() === '') return { value: undefined }
  try {
    return { value: JSON.parse(text) }
  } catch {
    return invalid('The body is not valid JSON.')
  }
}

function respond<T>(
  result: Result<T>,
  send: (value: T) => Response | Promise<Response>,
): Response | Promise<Response> {
  if (!result.ok) {
    const failure = result.problem
    if (failure.status === 404) return notFound()
    const wait = failure.status === 429 ? failure.retryAfterMs : undefined
    return problem(failure, wait ? { 'Retry-After': String(Math.ceil(wait / 1000)) } : {})
  }
  return send(result.value)
}

const address = (c: Context<App>) => clientAddress(c.req.header('CF-Connecting-IP'))

// Resolves the link in the URL to its workspace. A malformed key, or a tier the route doesn't
// accept, gets the same 404 as a wrong key. Both limits come before the workspace is asked, so
// whether they refuse a request says nothing about its key.
function keyed(
  tiers: readonly Tier[],
  handler: (c: Context<App>, link: Keyed) => Promise<Response>,
) {
  return async (c: Context<App>) => {
    if (!(await c.env.ADDRESS_LIMITER.limit({ key: address(c) })).success) return rateLimited()
    const parsed = parseLink(c.req.param('tier') ?? '', c.req.param('key') ?? '', tiers)
    if (!parsed) return notFound()
    const secretHash = await hashSecret(parsed.secret)
    const { success } = await c.env.LINK_LIMITER.limit({ key: secretHash })
    if (!success) return rateLimited()
    return handler(c, {
      workspaceId: parsed.workspaceId,
      auth: { tier: parsed.tier, secretHash },
      stub: c.env.WORKSPACES.getByName(parsed.workspaceId),
    })
  }
}

const secondsUntilTomorrow = () => {
  const now = new Date()
  return Math.ceil(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) /
      1000,
  )
}

app.post('/workspaces', async (c) => {
  if (c.env.CREATE_ENABLED !== 'true') return paused('Creating workspaces is switched off for now.')
  if (!(await c.env.CREATE_LIMITER.limit({ key: address(c) })).success) return rateLimited()
  const body = await readJson(c)
  if (body instanceof Response) return body
  const parsed = zCreateWorkspaceRequest.safeParse(body.value ?? {})
  if (!parsed.success) return invalidFrom(parsed.error)
  // The daily count is the ceiling on what workspaces can cost, so only a create that is about
  // to happen takes from it.
  const daily = Number(c.env.CREATE_DAILY_LIMIT)
  if (daily > 0) {
    const today = new Date().toISOString().slice(0, 10)
    if (!(await c.env.QUOTA.getByName('creates').take(today, daily))) {
      return paused(
        'mdplane has made as many workspaces as it will today. Try again after midnight UTC.',
        secondsUntilTomorrow(),
      )
    }
  }

  const id = newWorkspaceId()
  const hours = Number(c.env.WORKSPACE_TTL_HOURS)
  const expiresAt = hours > 0 ? new Date(Date.now() + hours * 3_600_000).toISOString() : null
  const links = await Promise.all(
    ALL.map(async (tier) => {
      const secret = newSecret()
      return { id: newLinkId(), tier, folder: null, secret, secretHash: await hashSecret(secret) }
    }),
  )
  await c.env.WORKSPACES.getByName(id).create({
    id,
    name: parsed.data.name ?? null,
    expiresAt,
    links: links.map(({ id: linkId, tier, folder, secretHash }) => ({
      id: linkId,
      tier,
      folder,
      secretHash,
    })),
  })
  const { origin } = new URL(c.req.url)
  const [read, append, write] = links.map((link) => linkUrl(origin, link.tier, id, link.secret))
  return c.json(
    { id, name: parsed.data.name ?? null, expiresAt, links: { read, append, write } },
    201,
  )
})

app.get(
  '/:tier/:key',
  keyed(ALL, async (c, { stub, auth }) => {
    const result = await stub.overview(auth)
    return respond(result, ({ workspace, tasks }) => {
      const headers = { ETag: `"${workspace.head.hash}"`, Vary: 'Accept' }
      const type = negotiate(c.req.header('Accept'), [
        'text/markdown',
        'application/json',
        'text/html',
      ])
      if (type === 'application/json') return c.json(workspace, 200, headers)
      // The reader is the same page for every link; it reads the key from its own URL.
      if (type === 'text/html') return htmlPage(c, '/reader', 200)
      const text = renderInstructions(workspace, tasks)
      return c.body(text, 200, { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' })
    })
  }),
)

app.get(
  '/:tier/:key/files/:path{.+}',
  keyed(ALL, async (c, { stub, auth }) => {
    const path = zFilePath.safeParse(c.req.param('path'))
    if (!path.success) return invalidFrom(path.error)
    const q = zReadFileQuery.safeParse(query(c))
    if (!q.success) return invalidFrom(q.error)
    const result = await stub.readFile(auth, path.data, q.data.at)
    return respond(result, (view) => {
      const headers = { ETag: `"${view.contentHash}"`, Vary: 'Accept' }
      const type = negotiate(c.req.header('Accept'), ['text/markdown', 'application/json'])
      if (type === 'application/json') return c.json(view, 200, headers)
      return c.body(renderFile(view), 200, {
        ...headers,
        'Content-Type': 'text/markdown; charset=utf-8',
      })
    })
  }),
)

app.put(
  '/:tier/:key/files/:path{.+}',
  keyed(WRITE, async (c, { stub, auth }) => {
    const path = zFilePath.safeParse(c.req.param('path'))
    if (!path.success) return invalidFrom(path.error)
    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch !== undefined && !zIfNoneMatch.safeParse(ifNoneMatch).success) {
      return invalid('If-None-Match only accepts *.')
    }
    const body = await readBody(c.req.raw, FILE_LIMIT)
    if (body === null) return tooLarge(FILE_LIMIT)
    const result = await stub.writeFile(auth, path.data, body, {
      ifMatch: c.req.header('If-Match'),
      ifNoneMatch,
    })
    if (!result.ok) return respond(result, () => notFound())
    const { value, created } = result
    return c.json(value, created ? 201 : 200, { ETag: `"${value.entry.contentHash}"` })
  }),
)

app.delete(
  '/:tier/:key/files/:path{.+}',
  keyed(WRITE, async (c, { stub, auth }) => {
    const path = zFilePath.safeParse(c.req.param('path'))
    if (!path.success) return invalidFrom(path.error)
    const result = await stub.deleteFile(auth, path.data, c.req.header('If-Match'))
    return respond(result, (value) => c.json(value))
  }),
)

app.post(
  '/:tier/:key/appends',
  keyed(APPEND, async (c, { stub, auth }) => {
    const key = c.req.header('Idempotency-Key')
    if (key !== undefined && !zIdempotencyKey.safeParse(key).success) {
      return invalid('Idempotency-Key must be 1 to 128 characters.')
    }
    const body = await readJson(c)
    if (body instanceof Response) return body
    const parsed = zAppendRequest.safeParse(body.value)
    if (!parsed.success) {
      const tooBig = parsed.error.issues.some(
        (issue) => issue.code === 'too_big' && issue.path.join('.') === 'body',
      )
      return tooBig ? tooLarge(ENTRY_BODY_LIMIT) : invalidFrom(parsed.error)
    }
    const result = await stub.append(auth, parsed.data, key ?? null)
    if (!result.ok) return respond(result, () => notFound())
    const headers: Record<string, string> = result.replayed ? { 'Idempotent-Replayed': 'true' } : {}
    return c.json(result.value, 201, headers)
  }),
)

app.get(
  '/:tier/:key/log',
  keyed(ALL, async (c, { stub, auth }) => {
    const q = zReadLogQuery.safeParse(query(c))
    if (!q.success) return invalidFrom(q.error)
    // RFC 7240: a preference that can't be read is ignored, not rejected.
    const wait = Number(/(?:^|[;,]\s*)wait=(\d+)/i.exec(c.req.header('Prefer') ?? '')?.[1] ?? 0)
    const result = await stub.readLog(auth, q.data, wait)
    return respond(result, ({ page, waited }) => {
      const headers: Record<string, string> = { ETag: `"${page.head.hash}"` }
      if (waited !== null) headers['Preference-Applied'] = `wait=${waited}`
      return c.json(page, 200, headers)
    })
  }),
)

app.get(
  '/:tier/:key/search',
  keyed(ALL, async (c, { stub, auth }) => {
    const q = zSearchQuery.safeParse(query(c))
    if (!q.success) return invalidFrom(q.error)
    const result = await stub.search(auth, q.data)
    return respond(result, (value) => c.json(value))
  }),
)

app.get(
  '/:tier/:key/live',
  keyed(ALL, async (c, { stub, auth }) => {
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      return problem({
        status: 426,
        code: 'upgrade_required',
        detail: 'Connect with a WebSocket client, or read the log with Prefer: wait=25.',
      })
    }
    const q = zLiveQuery.safeParse(query(c))
    if (!q.success) return invalidFrom(q.error)
    const response = await stub.fetch(
      new Request(`https://workspace/live?after=${q.data.after}`, {
        headers: {
          Upgrade: 'websocket',
          'x-mdplane-tier': auth.tier,
          'x-mdplane-secret-hash': auth.secretHash,
        },
      }),
    )
    if (response.status === 101) return response
    if (response.status !== 429) return notFound()
    return problem(
      {
        status: 429,
        code: 'rate_limited',
        detail: `A workspace takes at most ${LIMITS.sockets} live connections at once.`,
      },
      { 'Retry-After': '60' },
    )
  }),
)

app.get(
  '/:tier/:key/links',
  keyed(WRITE, async (c, { stub, auth }) => {
    const result = await stub.listLinks(auth)
    return respond(result, (value) => c.json(value))
  }),
)

app.post(
  '/:tier/:key/links',
  keyed(WRITE, async (c, { stub, auth, workspaceId }) => {
    const body = await readJson(c)
    if (body instanceof Response) return body
    const parsed = zCreateLinkRequest.safeParse(body.value)
    if (!parsed.success) return invalidFrom(parsed.error)
    const secret = newSecret()
    const result = await stub.createLink(auth, {
      id: newLinkId(),
      tier: parsed.data.tier,
      folder: parsed.data.folder ?? null,
      secretHash: await hashSecret(secret),
    })
    const { origin } = new URL(c.req.url)
    return respond(result, (link) =>
      c.json({ link, url: linkUrl(origin, link.tier, workspaceId, secret) }, 201),
    )
  }),
)

app.delete(
  '/:tier/:key/links/:linkId',
  keyed(WRITE, async (c, { stub, auth }) => {
    const linkId = zLinkId.safeParse(c.req.param('linkId'))
    if (!linkId.success) return notFound()
    const result = await stub.revokeLink(auth, linkId.data)
    return respond(result, () => c.body(null, 204))
  }),
)

export default app
