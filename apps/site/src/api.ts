import type {
  AppendRequest,
  AppendResult,
  CreateWorkspaceResponse,
  Entry,
  FileView,
  LiveClose,
  LogItem,
  LogPage,
  Problem,
  Tier,
  Workspace,
} from '@mdplane/contract/core'
import type { BodySource, LiveStatus } from './model.ts'

export type LinkInfo = { base: string; tier: Tier; workspaceId: string }

const LINK = /^\/([raw])\/(wk_[A-Za-z0-9]{12})\.[A-Za-z0-9]{32}\/?$/

export function parseLink(url: string): LinkInfo | null {
  const { origin, pathname } = new URL(url)
  const match = LINK.exec(pathname)
  const tier = (['r', 'a', 'w'] as const).find((t) => t === match?.[1])
  if (!match?.[2] || !tier) return null
  return { base: `${origin}${pathname.replace(/\/$/, '')}`, tier, workspaceId: match[2] }
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null
  // From Retry-After, when the server says how long to wait.
  readonly retryAfterMs: number | null
  constructor(status: number, problem: Problem | null, retryAfterMs: number | null = null) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`)
    this.status = status
    this.problem = problem
    this.retryAfterMs = retryAfterMs
  }
}

async function send<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const problem: Problem | null = await response.json().catch(() => null)
    const seconds = Number(response.headers.get('Retry-After'))
    throw new ApiError(response.status, problem, seconds > 0 ? seconds * 1000 : null)
  }
  return response.json()
}

export const isGone = (error: unknown) => error instanceof ApiError && error.status === 404
export const isRateLimited = (error: unknown) => error instanceof ApiError && error.status === 429
export const isPaused = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.problem?.code === 'creation_paused'

const JSON_ACCEPT = { Accept: 'application/json' }

export const isEntry = (item: LogItem): item is Entry => !('redacted' in item)

const MORE_BACKLOG = 4000

export const getWorkspace = (base: string) => send<Workspace>(base, { headers: JSON_ACCEPT })

// A page can stop short of its limit to keep its size down, so the cursor reaching the head is
// what says the log has been read.
export async function readLog(base: string, after = 0): Promise<LogItem[]> {
  const items: LogItem[] = []
  let cursor = after
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each page starts where the last one ended
    const page = await send<LogPage>(`${base}/log?after=${cursor}&limit=500`)
    items.push(...page.entries)
    if (page.cursor >= page.head.seq || page.entries.length === 0) return items
    cursor = page.cursor
  }
}

export const readFile = (base: string, path: string, at?: number) =>
  send<FileView>(`${base}/files/${path}${at === undefined ? '' : `?at=${at}`}`, {
    headers: JSON_ACCEPT,
  })

// Bodies a reader fetches at once. Each link may make 300 requests a minute, and a reader
// scrubbing through hundreds of versions shouldn't spend them all on ones it has passed.
const BODY_CONCURRENCY = 4
// Bodies waiting their turn. The newest request goes first and the oldest is dropped, since a
// reader that has moved on will ask again if it comes back.
const BODY_QUEUE = 8
const BODY_ATTEMPTS = 3

type Pending = { write: Entry; attempts: number }

// Fetches a write's body when a reader needs it, by reading the file as it was at that entry,
// and keeps it for as long as the workspace is open. A write entry carries only its body's hash.
export class Bodies implements BodySource {
  readonly cache = new Map<string, string>()
  private readonly base: string
  private readonly changed: () => void
  private queue: Pending[] = []
  private readonly loading = new Set<string>()
  // Failed once or twice and waiting to try again, which asking again doesn't hurry.
  private readonly waiting = new Set<string>()
  private readonly attempts = new Map<string, number>()
  private readonly failed = new Map<string, string>()
  private readonly settled = new Map<string, Array<() => void>>()
  // While the link is rate limited, nothing is fetched until this time.
  private waitUntil = 0
  private timer: number | undefined
  private stopped = false

  constructor(base: string, changed: () => void) {
    this.base = base
    this.changed = changed
  }

  want(write: Entry): void {
    const hash = write.contentHash
    if (!hash || this.stopped || this.cache.has(hash) || this.loading.has(hash)) return
    if (this.waiting.has(hash) || this.failed.has(hash)) return
    this.queue = [
      { write, attempts: this.attempts.get(hash) ?? 0 },
      ...this.queue.filter((p) => p.write.contentHash !== hash),
    ].slice(0, BODY_QUEUE)
    this.pump()
  }

  // Resolves once the body is here or has failed, so a caller can wait for it without failing.
  load(write: Entry): Promise<void> {
    const hash = write.contentHash
    if (!hash || this.cache.has(hash) || this.failed.has(hash)) return Promise.resolve()
    const done = new Promise<void>((resolve) => {
      this.settled.set(hash, [...(this.settled.get(hash) ?? []), resolve])
    })
    this.want(write)
    return done
  }

  retry(write: Entry): void {
    if (!write.contentHash) return
    this.failed.delete(write.contentHash)
    this.attempts.delete(write.contentHash)
    this.want(write)
    this.changed()
  }

  problem(write: Entry): { message: string; retry: boolean } | null {
    const hash = write.contentHash
    if (!hash || this.cache.has(hash)) return null
    const failed = this.failed.get(hash)
    if (failed) return { message: failed, retry: true }
    if (Date.now() < this.waitUntil) {
      return {
        message: 'Too many requests on this link for now. This version loads in a minute.',
        retry: false,
      }
    }
    return null
  }

  stop(): void {
    this.stopped = true
    this.queue = []
    window.clearTimeout(this.timer)
  }

  private pump(): void {
    const wait = this.waitUntil - Date.now()
    if (wait > 0) {
      window.clearTimeout(this.timer)
      this.timer = window.setTimeout(() => this.pump(), wait)
      return
    }
    while (!this.stopped && this.loading.size < BODY_CONCURRENCY) {
      const next = this.queue.shift()
      if (!next) return
      void this.fetch(next)
    }
  }

  private async fetch({ write, attempts }: Pending): Promise<void> {
    const hash = write.contentHash ?? ''
    this.loading.add(hash)
    try {
      const view = await readFile(this.base, write.path, write.seq)
      this.cache.set(hash, view.body)
      this.settle(hash)
    } catch (error) {
      if (this.stopped) return
      if (isRateLimited(error)) {
        // Waiting out the limit costs nothing; retrying early only spends the next minute's share.
        const after = error instanceof ApiError ? error.retryAfterMs : null
        this.waitUntil = Date.now() + Math.min(after ?? 60_000, 60_000)
        this.queue.unshift({ write, attempts })
      } else if (attempts + 1 < BODY_ATTEMPTS) {
        this.attempts.set(hash, attempts + 1)
        this.waiting.add(hash)
        window.setTimeout(
          () => {
            this.waiting.delete(hash)
            this.want(write)
          },
          1000 * 2 ** attempts,
        )
      } else {
        this.failed.set(
          hash,
          isGone(error)
            ? "This link can't load this version any more."
            : "Couldn't load this version.",
        )
        this.settle(hash)
      }
    } finally {
      this.loading.delete(hash)
      if (!this.stopped) {
        this.changed()
        this.pump()
      }
    }
  }

  private settle(hash: string): void {
    for (const resolve of this.settled.get(hash) ?? []) resolve()
    this.settled.delete(hash)
  }
}

// Streams new log items, reconnecting from the last one seen so nothing is missed or repeated.
// It ends on its own only when the link stops working, because it was revoked or its workspace
// expired.
export function follow(
  base: string,
  after: number,
  { onItem, onStatus }: { onItem: (item: LogItem) => void; onStatus: (status: LiveStatus) => void },
): () => void {
  let last = after
  let socket: WebSocket | null = null
  let timer: number | undefined
  let stopped = false
  let delay = 1000
  // Handshakes that failed in a row. A refused upgrade, even a 404, reaches the browser only as
  // a close with code 1006, so whether the link still works has to be asked separately.
  let refused = 0
  let status: LiveStatus | null = null
  const set = (next: LiveStatus) => {
    if (next === status) return
    status = next
    onStatus(next)
  }

  const stop = () => {
    stopped = true
    window.clearTimeout(timer)
    window.removeEventListener('online', reconnect)
    window.removeEventListener('offline', lost)
    socket?.close()
    socket = null
  }

  const retry = () => {
    set('reconnecting')
    window.clearTimeout(timer)
    // Offline, nothing can connect; the online event tries again straight away.
    if (!navigator.onLine) return
    timer = window.setTimeout(connect, delay)
    delay = Math.min(delay * 2, 30_000)
  }

  // Only a 404 says the link is gone. Anything else, like being offline or rate limited, is
  // worth retrying.
  const check = async () => {
    set('reconnecting')
    const gone = await getWorkspace(base).then(() => false, isGone)
    if (stopped) return
    if (gone) {
      stop()
      set('ended')
    } else if (!socket) {
      // Unless coming back online has already reconnected.
      retry()
    }
  }

  function connect(): void {
    if (stopped) return
    window.clearTimeout(timer)
    let opened = false
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/live?after=${last}`)
    socket = ws
    ws.addEventListener('open', () => {
      opened = true
      refused = 0
      delay = 1000
      set('live')
    })
    const closed = (code: number) => {
      // A socket replaced by a reconnect, or already closed by its notice, has nothing more to say.
      if (stopped || socket !== ws) return
      socket = null
      // The server sends one page of backlog per connection, and says when there is more.
      if (code === MORE_BACKLOG) connect()
      // 1008 means the link was revoked or the workspace expired.
      else if (code === 1008 || (!opened && ++refused >= 2)) void check()
      else retry()
    }
    ws.addEventListener('message', (event) => {
      const message: LogItem | LiveClose = JSON.parse(String(event.data))
      // Some browsers report the close itself seconds late, so the notice before it is acted on.
      if ('close' in message) return closed(message.close.code)
      if (message.seq <= last) return
      last = message.seq
      onItem(message)
    })
    ws.addEventListener('close', (event) => closed(event.code))
  }

  // Back online, the old socket may be half dead, so start a new one now rather than wait it out.
  function reconnect(): void {
    if (stopped) return
    const old = socket
    socket = null
    old?.close()
    delay = 1000
    set('reconnecting')
    connect()
  }

  function lost(): void {
    if (!stopped) set('reconnecting')
  }

  window.addEventListener('online', reconnect)
  window.addEventListener('offline', lost)
  set('connecting')
  connect()
  return stop
}

export async function createWorkspace(name: string): Promise<CreateWorkspaceResponse> {
  return send(`${location.origin}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function createFile(link: string, path: string, body: string) {
  return send(`${link}/files/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/markdown', 'If-None-Match': '*' },
    body,
  })
}

// Retrying with the same key can't add the entry twice.
export function append(
  link: string,
  entry: AppendRequest,
  key: string = crypto.randomUUID(),
): Promise<AppendResult> {
  return send(`${link}/appends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(entry),
  })
}
