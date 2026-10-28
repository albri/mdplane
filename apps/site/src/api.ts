import type {
  CreateWorkspaceResponse,
  Entry,
  FileView,
  LogItem,
  LogPage,
  Problem,
  Tier,
  Workspace,
} from '@mdplane/contract/core'
import type { Session } from './model.ts'

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
  constructor(status: number, problem: Problem | null) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`)
    this.status = status
    this.problem = problem
  }
}

async function send<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const problem: Problem | null = await response.json().catch(() => null)
    throw new ApiError(response.status, problem)
  }
  return response.json()
}

const JSON_ACCEPT = { Accept: 'application/json' }

export const isEntry = (item: LogItem): item is Entry => !('redacted' in item)

export const getWorkspace = (base: string) => send<Workspace>(base, { headers: JSON_ACCEPT })

export async function readLog(base: string, after = 0): Promise<LogItem[]> {
  const items: LogItem[] = []
  let cursor = after
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each page starts where the last one ended
    const page = await send<LogPage>(`${base}/log?after=${cursor}&limit=500`)
    items.push(...page.entries)
    if (page.entries.length < 500) return items
    cursor = page.cursor
  }
}

export const readFile = (base: string, path: string, at?: number) =>
  send<FileView>(`${base}/files/${path}${at === undefined ? '' : `?at=${at}`}`, {
    headers: JSON_ACCEPT,
  })

// Fetches the body for a write entry, by reading the file as it was at that entry.
export async function loadBody(session: Session, base: string, write: Entry): Promise<void> {
  if (!write.contentHash || session.bodies.has(write.contentHash)) return
  const view = await readFile(base, write.path, write.seq)
  session.bodies.set(view.contentHash, view.body)
}

export async function loadSession(
  link: LinkInfo,
  workspace: Workspace,
  log: LogItem[],
  path: string,
): Promise<Session> {
  const session: Session = {
    workspaceId: workspace.id,
    name: workspace.name,
    path,
    tier: link.tier,
    host: location.host,
    entries: log.filter(isEntry).filter((e) => e.path === path),
    log,
    bodies: new Map(),
    mode: 'live',
    expiresAt: workspace.expiresAt,
  }
  const writes = session.entries.filter((e) => e.type === 'write')
  await Promise.all(writes.map((w) => loadBody(session, link.base, w)))
  return session
}

// Streams new log items, reconnecting from the last one seen so nothing is missed or repeated.
export function follow(base: string, after: number, onItem: (item: LogItem) => void): () => void {
  let last = after
  let socket: WebSocket | null = null
  let stopped = false
  let delay = 1000
  const connect = () => {
    socket = new WebSocket(`${base.replace(/^http/, 'ws')}/live?after=${last}`)
    socket.addEventListener('open', () => {
      delay = 1000
    })
    socket.addEventListener('message', (event) => {
      const item: LogItem = JSON.parse(String(event.data))
      if (item.seq <= last) return
      last = item.seq
      onItem(item)
    })
    // 1008 means the link was revoked or the workspace expired, so there is nothing to come back to.
    socket.addEventListener('close', (event) => {
      if (stopped || event.code === 1008) return
      window.setTimeout(connect, delay)
      delay = Math.min(delay * 2, 30_000)
    })
  }
  connect()
  return () => {
    stopped = true
    socket?.close()
  }
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

export function append(link: string, entry: Record<string, unknown>) {
  return send(`${link}/appends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(entry),
  })
}
