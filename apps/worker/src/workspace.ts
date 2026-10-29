import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { DurableObject } from 'cloudflare:workers'
import type { output } from 'zod'
import {
  type AppendResult,
  canonical,
  deriveTasks,
  type Entry,
  type EntryContent,
  FILE_VIEW_LIMITS,
  type FileSummary,
  type FileView,
  GENESIS,
  type Head,
  type Lease,
  type Link,
  type LogItem,
  type LogPage,
  type Problem,
  type SearchResults,
  type TaskCounts,
  type TaskView,
  type Tier,
  pickTasks,
  tallyTasks,
  type Workspace as WorkspaceView,
  type WriteResult,
  type zAppendRequest,
} from '@mdplane/contract'
import { randomString } from './keys.ts'

// What the Worker's validation produces, which allows `undefined` where the spec omits a field.
export type AppendInput = output<typeof zAppendRequest>
export type Auth = { tier: Tier; secretHash: string }
export type Failure = Pick<Problem, 'code' | 'status' | 'detail' | 'holder' | 'retryAfterMs'>
export type Result<T> =
  | { ok: true; value: T; created?: boolean; replayed?: boolean }
  | { ok: false; problem: Failure }

export type NewLink = { id: string; tier: Tier; folder: string | null; secretHash: string }
// Each file's open and claimed tasks, with only as much of each body as the summary shows.
// `tasks` holds each file's open and claimed tasks, and `counts` tallies all of them.
export type Overview = {
  workspace: WorkspaceView
  tasks: Record<string, TaskView[]>
  counts: Record<string, TaskCounts>
}

// `polls` is how many long polls may wait at once, and `sockets` how many live connections.
export const LIMITS = { files: 100, entries: 10_000, links: 50, polls: 20, sockets: 100 }
const IDEMPOTENCY_MS = 24 * 60 * 60 * 1000
const MAX_WAIT_SECONDS = 25
const ALL: readonly Tier[] = ['r', 'a', 'w']

const NOT_FOUND: Failure = { code: 'not_found', status: 404 }
const fail = <T>(status: number, code: Failure['code'], detail?: string): Result<T> => ({
  ok: false,
  problem: detail ? { status, code, detail } : { status, code },
})
const ok = <T>(value: T, extra: { created?: boolean } = {}): Result<T> => ({
  ok: true,
  value,
  ...extra,
})

const ENTRY = `seq, at, path, type, author, ref, body, version, content_hash AS contentHash, prev, hash`
// More of a task's body than the overview's one-line summary of it needs.
const SUMMARY_CHARS = 240
const LINK = `id, tier, folder, created_at AS createdAt`

const SCHEMA = `
  CREATE TABLE meta (id TEXT NOT NULL, name TEXT, expires_at TEXT);
  CREATE TABLE links (
    id TEXT PRIMARY KEY, tier TEXT NOT NULL, folder TEXT, secret_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL, revoked_at TEXT
  );
  CREATE TABLE entries (
    seq INTEGER PRIMARY KEY, at TEXT NOT NULL, path TEXT NOT NULL, type TEXT NOT NULL,
    author TEXT NOT NULL, ref INTEGER, body TEXT, version INTEGER, content_hash TEXT,
    prev TEXT NOT NULL, hash TEXT NOT NULL
  );
  CREATE INDEX entries_by_path ON entries (path, seq);
  CREATE TABLE bodies (content_hash TEXT PRIMARY KEY, body TEXT NOT NULL);
  CREATE TABLE idempotency (
    key TEXT PRIMARY KEY, request_hash TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX idempotency_by_age ON idempotency (created_at);
  CREATE VIRTUAL TABLE search USING fts5 (text, path UNINDEXED, seq UNINDEXED);
`

// Each one takes the schema a version further. A new workspace runs them all after SCHEMA; one
// made before a deploy runs the ones it hasn't had the first time it's used after it. Durable
// Objects refuse PRAGMA user_version, so the version is kept in a table.
const MIGRATIONS = [
  // 1: how many bytes of text the workspace holds, for its budget.
  `ALTER TABLE meta ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;
   UPDATE meta SET bytes =
     (SELECT COALESCE(SUM(length(CAST(body AS BLOB))), 0) FROM entries) +
     (SELECT COALESCE(SUM(length(CAST(body AS BLOB))), 0) FROM bodies);`,
  // 2: the token of the newest claim on each task. A token isn't a credential, since an append
  // link can cancel any task anyway; it stops two agents from both holding one task, so it is
  // kept as it is.
  `CREATE TABLE leases (task INTEGER PRIMARY KEY, token TEXT NOT NULL);`,
  // 3: revoking a link now deletes it, so only live links count toward the limit and making and
  // revoking links can't grow the table.
  `DELETE FROM links WHERE revoked_at IS NOT NULL;`,
]

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const newClaimToken = () => randomString(20)
const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8')

// A folder-limited link sees paths under its folder; a link without one sees everything.
const inScope = (folder: string | null, path: string) =>
  folder === null || path.startsWith(`${folder}/`)
const within = (outer: string | null, inner: string | null) =>
  outer === null || (inner !== null && (inner === outer || inner.startsWith(`${outer}/`)))

const visible = (entry: Entry, folder: string | null): LogItem =>
  inScope(folder, entry.path)
    ? entry
    : { seq: entry.seq, prev: entry.prev, hash: entry.hash, redacted: true }

function etagMatches(header: string, hash: string): boolean {
  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, '').replaceAll('"', ''))
    .some((tag) => tag === '*' || tag === hash)
}

type SocketState = { linkId: string; folder: string | null }

// One workspace. Every method that changes state runs synchronously from authorisation to the
// sealed entry, so requests never interleave and the log needs no locks.
export class Workspace extends DurableObject<Env> {
  private readonly sql = this.ctx.storage.sql
  private readonly waiters = new Set<() => void>()
  private polls = 0
  private exists = false

  private get leaseMs(): number {
    return Number(this.env.LEASE_SECONDS) * 1000
  }

  // Reading sqlite_master doesn't write, so a request for a workspace that was never created
  // leaves nothing behind.
  private created(): boolean {
    if (
      !this.exists &&
      this.sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'`).toArray()
        .length > 0
    ) {
      this.migrate()
      this.exists = true
    }
    return this.exists
  }

  private migrate(): void {
    const versioned =
      this.sql
        .exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'`)
        .toArray().length > 0
    const version = versioned
      ? this.sql.exec<{ version: number }>(`SELECT version FROM schema_version`).one().version
      : 0
    if (version >= MIGRATIONS.length) return
    this.ctx.storage.transactionSync(() => {
      for (const step of MIGRATIONS.slice(version)) this.sql.exec(step)
      if (!versioned) this.sql.exec(`CREATE TABLE schema_version (version INTEGER NOT NULL)`)
      this.sql.exec(`DELETE FROM schema_version`)
      this.sql.exec(`INSERT INTO schema_version VALUES (?)`, MIGRATIONS.length)
    })
  }

  async create(input: {
    id: string
    name: string | null
    expiresAt: string | null
    links: NewLink[]
  }): Promise<void> {
    if (this.created()) throw new Error('Workspace ID collision')
    const now = new Date().toISOString()
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(SCHEMA)
      this.sql.exec(`INSERT INTO meta VALUES (?, ?, ?)`, input.id, input.name, input.expiresAt)
      for (const link of input.links) this.insertLink(link, now)
      this.migrate()
    })
    this.exists = true
    if (input.expiresAt) await this.ctx.storage.setAlarm(Date.parse(input.expiresAt))
  }

  override async alarm(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) socket.close(1008, 'Workspace expired')
    await this.ctx.storage.deleteAll()
    this.exists = false
    this.wake()
  }

  private meta() {
    return this.sql
      .exec<{ id: string; name: string | null; expiresAt: string | null }>(
        `SELECT id, name, expires_at AS expiresAt FROM meta`,
      )
      .one()
  }

  // Every way a link can fail to authorise ends in the same NOT_FOUND.
  private authorize(auth: Auth, tiers: readonly Tier[] = ALL): Link | null {
    if (!this.created()) return null
    const { expiresAt } = this.meta()
    if (expiresAt && Date.now() >= Date.parse(expiresAt)) return null
    const [link] = this.sql
      .exec<Link>(
        `SELECT ${LINK} FROM links WHERE secret_hash = ? AND revoked_at IS NULL`,
        auth.secretHash,
      )
      .toArray()
    if (!link || link.tier !== auth.tier || !tiers.includes(link.tier)) return null
    return link
  }

  private head(): Head {
    const [row] = this.sql
      .exec<Head>(`SELECT seq, hash FROM entries ORDER BY seq DESC LIMIT 1`)
      .toArray()
    return row ?? { seq: 0, hash: GENESIS }
  }

  private seal(content: Omit<EntryContent, 'seq' | 'at'>, text: string | null): Entry {
    const head = this.head()
    const entry: EntryContent = { seq: head.seq + 1, at: new Date().toISOString(), ...content }
    const sealed: Entry = {
      ...entry,
      prev: head.hash,
      hash: sha256(`${head.hash}\n${canonical(entry)}`),
    }
    this.sql.exec(
      `INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sealed.seq,
      sealed.at,
      sealed.path,
      sealed.type,
      sealed.author,
      sealed.ref,
      sealed.body,
      sealed.version,
      sealed.contentHash,
      sealed.prev,
      sealed.hash,
    )
    this.index(sealed, text)
    this.broadcast(sealed)
    return sealed
  }

  // Search covers each file's current body and the log of files that still exist.
  private index(entry: Entry, text: string | null): void {
    if (entry.type === 'delete') {
      this.sql.exec(`DELETE FROM search WHERE path = ?`, entry.path)
    } else if (entry.type === 'write') {
      this.sql.exec(`DELETE FROM search WHERE path = ? AND seq IS NULL`, entry.path)
      if (text) this.sql.exec(`INSERT INTO search VALUES (?, ?, NULL)`, text, entry.path)
    } else if (entry.body) {
      this.sql.exec(`INSERT INTO search VALUES (?, ?, ?)`, entry.body, entry.path, entry.seq)
    }
  }

  // Sockets with the same folder get the same message, so each folder's is serialised once.
  private broadcast(entry: Entry): void {
    this.wake()
    const messages = new Map<string | null, string>()
    for (const socket of this.ctx.getWebSockets()) {
      // A socket closed here, after its backlog or a revoke, stays listed until the client
      // answers, and sending to it would throw after the entry is sealed.
      if (socket.readyState !== WebSocket.OPEN) continue
      const { folder }: SocketState = socket.deserializeAttachment()
      const message = messages.get(folder) ?? JSON.stringify(visible(entry, folder))
      messages.set(folder, message)
      socket.send(message)
    }
  }

  // Each waiter deletes itself, which a Set allows while it is being iterated.
  private wake(): void {
    for (const wake of this.waiters) wake()
  }

  // A waiter removes itself whether an entry or the timeout comes first.
  private nextEntry(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        this.waiters.delete(done)
        resolve()
      }
      const timer = setTimeout(done, timeoutMs)
      this.waiters.add(done)
    })
  }

  private logFull(): boolean {
    return this.head().seq >= LIMITS.entries
  }

  // Refuses text that would take the workspace over its budget. The budget counts each entry's
  // body and each distinct version of a file body, which is what its storage grows with.
  private overBudget<T>(bytes: number): Result<T> | null {
    const max = Number(this.env.WORKSPACE_MAX_BYTES)
    if (!(max > 0) || bytes === 0) return null
    const used = this.sql.exec<{ bytes: number }>(`SELECT bytes FROM meta`).one().bytes
    if (used + bytes <= max) return null
    return fail(
      409,
      'workspace_full',
      `A workspace holds at most ${max} bytes of text. It holds ${used}, and this needs ${bytes} more.`,
    )
  }

  private spend(bytes: number): void {
    if (bytes > 0) this.sql.exec(`UPDATE meta SET bytes = bytes + ?`, bytes)
  }

  // The file's newest write, unless it has been deleted since, and where its current life began.
  private fileState(path: string, upto: number): { write: Entry; since: number } | null {
    const [last] = this.sql
      .exec<Entry>(
        `SELECT ${ENTRY} FROM entries WHERE path = ? AND type IN ('write', 'delete') AND seq <= ?
         ORDER BY seq DESC LIMIT 1`,
        path,
        upto,
      )
      .toArray()
    if (!last || last.type === 'delete') return null
    const { since } = this.sql
      .exec<{ since: number }>(
        `SELECT COALESCE(MAX(seq), 0) AS since FROM entries WHERE path = ? AND type = 'delete' AND seq < ?`,
        path,
        last.seq,
      )
      .one()
    return { write: last, since }
  }

  private liveFiles(): FileSummary[] {
    return this.sql
      .exec<FileSummary>(
        `SELECT e.path, e.version, e.content_hash AS contentHash, e.at AS updatedAt,
                (SELECT MAX(seq) FROM entries x WHERE x.path = e.path) AS lastSeq
         FROM entries e
         WHERE e.type = 'write' AND e.seq = (
           SELECT MAX(seq) FROM entries y WHERE y.path = e.path AND y.type IN ('write', 'delete')
         )
         ORDER BY e.path`,
      )
      .toArray()
  }

  // Every task's status, with at most `bodyChars` of each body, so a file with thousands of long
  // tasks can't fill the object's memory or a response.
  private tasks(
    path: string,
    since: number,
    upto: number,
    asOf: number,
    bodyChars: number,
  ): TaskView[] {
    const rows = this.sql.exec<Entry>(
      `SELECT seq, at, path, type, author, ref, substr(body, 1, ?) AS body, version,
              content_hash AS contentHash, prev, hash
       FROM entries
       WHERE path = ? AND seq > ? AND seq <= ? AND type IN ('task', 'claim', 'response', 'cancel')
       ORDER BY seq`,
      bodyChars,
      path,
      since,
      upto,
    )
    return deriveTasks(rows, asOf, this.leaseMs)
  }

  overview(auth: Auth): Result<Overview> {
    const link = this.authorize(auth)
    if (!link) return { ok: false, problem: NOT_FOUND }
    const meta = this.meta()
    const head = this.head()
    const files = this.liveFiles().filter((file) => inScope(link.folder, file.path))
    const tasks: Record<string, TaskView[]> = {}
    const counts: Record<string, TaskCounts> = {}
    for (const file of files) {
      const state = this.fileState(file.path, head.seq)
      if (!state) continue
      const all = this.tasks(file.path, state.since, head.seq, Date.now(), SUMMARY_CHARS)
      counts[file.path] = tallyTasks(all)
      tasks[file.path] = all.filter((task) => task.status === 'open' || task.status === 'claimed')
    }
    return ok({ workspace: { ...meta, link, head, files }, tasks, counts })
  }

  readFile(auth: Auth, path: string, at?: number): Result<FileView> {
    const link = this.authorize(auth)
    if (!link || !inScope(link.folder, path)) return { ok: false, problem: NOT_FOUND }
    const head = this.head()
    const upto = Math.min(at ?? head.seq, head.seq)
    const state = this.fileState(path, upto)
    if (!state) return { ok: false, problem: NOT_FOUND }
    const { write, since } = state
    const contentHash = write.contentHash ?? ''
    const { body } = this.sql
      .exec<{ body: string }>(`SELECT body FROM bodies WHERE content_hash = ?`, contentHash)
      .one()
    const asOf =
      at === undefined
        ? Date.now()
        : Date.parse(
            this.sql.exec<{ at: string }>(`SELECT at FROM entries WHERE seq = ?`, upto).one().at,
          )
    // Statuses first, then the bodies of only the tasks the view shows.
    const all = this.tasks(path, since, upto, asOf, 0)
    const shown = pickTasks(all)
    const bodies = new Map(
      this.sql
        .exec<{ seq: number; body: string }>(
          `SELECT seq, body FROM entries WHERE seq IN (SELECT value FROM json_each(?))`,
          JSON.stringify(shown.map((task) => task.seq)),
        )
        .toArray()
        .map((row) => [row.seq, row.body]),
    )
    const tasks = shown.map((task) => ({ ...task, body: bodies.get(task.seq) ?? '' }))
    const { count } = this.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) AS count FROM entries WHERE path = ? AND seq > ? AND seq <= ?`,
        path,
        since,
        upto,
      )
      .one()
    const entries = this.sql
      .exec<Entry>(
        `SELECT ${ENTRY} FROM entries WHERE path = ? AND seq > ? AND seq <= ?
         ORDER BY seq DESC LIMIT ?`,
        path,
        since,
        upto,
        FILE_VIEW_LIMITS.entries,
      )
      .toArray()
      .toReversed()
    return ok({
      path,
      at: upto,
      head,
      version: write.version ?? 1,
      contentHash,
      body,
      since,
      tasks,
      entries,
      omitted: { tasks: all.length - tasks.length, entries: count - entries.length },
    })
  }

  writeFile(
    auth: Auth,
    path: string,
    body: string,
    conditions: { ifMatch?: string | undefined; ifNoneMatch?: string | undefined },
  ): Result<WriteResult> {
    const link = this.authorize(auth, ['w'])
    if (!link || !inScope(link.folder, path)) return { ok: false, problem: NOT_FOUND }
    const { ifMatch, ifNoneMatch } = conditions
    if (ifMatch === undefined && ifNoneMatch === undefined) {
      return fail(
        428,
        'precondition_required',
        'Send If-Match with the ETag to update, or If-None-Match: * to create.',
      )
    }
    const current = this.fileState(path, this.head().seq)
    if (ifNoneMatch !== undefined && current) {
      return fail(412, 'precondition_failed', 'The file already exists.')
    }
    if (
      ifMatch !== undefined &&
      !(current && etagMatches(ifMatch, current.write.contentHash ?? ''))
    ) {
      return fail(412, 'precondition_failed', 'The file has changed. Read it again for its ETag.')
    }
    if (!current && this.liveFiles().length >= LIMITS.files) {
      return fail(409, 'workspace_full', `A workspace holds at most ${LIMITS.files} files.`)
    }
    if (this.logFull()) return this.full()
    const contentHash = sha256(body)
    // A body the workspace already holds, under any path, costs nothing more.
    const known =
      this.sql.exec(`SELECT 1 FROM bodies WHERE content_hash = ?`, contentHash).toArray().length > 0
    const bytes = known ? 0 : utf8Bytes(body)
    const refused = this.overBudget<WriteResult>(bytes)
    if (refused) return refused
    const { version } = this.sql
      .exec<{ version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS version FROM entries WHERE path = ? AND type = 'write'`,
        path,
      )
      .one()
    if (!known) this.sql.exec(`INSERT INTO bodies VALUES (?, ?)`, contentHash, body)
    this.spend(bytes)
    const entry = this.seal(
      { path, type: 'write', author: link.id, ref: null, body: null, version, contentHash },
      body,
    )
    return ok({ entry }, { created: !current })
  }

  deleteFile(auth: Auth, path: string, ifMatch: string | undefined): Result<WriteResult> {
    const link = this.authorize(auth, ['w'])
    if (!link || !inScope(link.folder, path)) return { ok: false, problem: NOT_FOUND }
    const current = this.fileState(path, this.head().seq)
    if (!current) return { ok: false, problem: NOT_FOUND }
    if (ifMatch === undefined) {
      return fail(428, 'precondition_required', 'Send If-Match with the file’s ETag.')
    }
    if (!etagMatches(ifMatch, current.write.contentHash ?? '')) {
      return fail(412, 'precondition_failed', 'The file has changed. Read it again for its ETag.')
    }
    if (this.logFull()) return this.full()
    const entry = this.seal(
      {
        path,
        type: 'delete',
        author: link.id,
        ref: null,
        body: null,
        version: null,
        contentHash: null,
      },
      null,
    )
    return ok({ entry })
  }

  append(auth: Auth, request: AppendInput, idempotencyKey: string | null): Result<AppendResult> {
    const link = this.authorize(auth, ['a', 'w'])
    if (!link || !inScope(link.folder, request.path)) return { ok: false, problem: NOT_FOUND }

    const now = Date.now()
    const key = idempotencyKey === null ? null : `${link.id}:${idempotencyKey}`
    const requestHash = sha256(JSON.stringify(request))
    if (key) {
      this.sql.exec(`DELETE FROM idempotency WHERE created_at < ?`, now - IDEMPOTENCY_MS)
      const [prior] = this.sql
        .exec<{ requestHash: string; response: string }>(
          `SELECT request_hash AS requestHash, response FROM idempotency WHERE key = ?`,
          key,
        )
        .toArray()
      if (prior) {
        if (prior.requestHash !== requestHash) {
          return fail(
            422,
            'idempotency_key_reused',
            'This Idempotency-Key was used for a different request.',
          )
        }
        const value: AppendResult = JSON.parse(prior.response)
        return { ok: true, value, created: true, replayed: true }
      }
    }

    const file = this.fileState(request.path, this.head().seq)
    if (!file) return { ok: false, problem: NOT_FOUND }
    const ref = request.type === 'task' ? null : (request.ref ?? null)
    // The token of the lease that a claim with it renews.
    let renewing: string | null = null
    if (ref !== null) {
      const task = this.tasks(request.path, file.since, Number.MAX_SAFE_INTEGER, now, 0).find(
        (t) => t.seq === ref,
      )
      if (!task) {
        return fail(422, 'invalid_ref', `Entry ${ref} is not a task in ${request.path}.`)
      }
      const closed = task.status === 'done' || task.status === 'cancelled'
      if (closed && request.type !== 'comment') {
        return fail(409, 'task_closed', `Task ${ref} is ${task.status}.`)
      }
      // Only the token proves who holds a lease. Authors are labels, and two agents can share one.
      const guarded = request.type === 'claim' || request.type === 'response'
      if (task.status === 'claimed' && guarded) {
        const held = this.leaseToken(ref)
        const offered = 'token' in request ? request.token : undefined
        if (held === null || offered !== held) {
          const until = Date.parse(task.leaseExpiresAt ?? '')
          return {
            ok: false,
            problem: {
              status: 409,
              code: 'task_claimed',
              detail: `${task.holder} holds task ${ref} until ${task.leaseExpiresAt?.slice(11, 16)} UTC. Its holder renews or finishes it with the token from its claim.`,
              holder: task.holder ?? '',
              retryAfterMs: Math.max(0, until - now),
            },
          }
        }
        renewing = held
      }
    }
    if (this.logFull()) return this.full()
    const bytes = utf8Bytes(request.body ?? '')
    const refused = this.overBudget<AppendResult>(bytes)
    if (refused) return refused
    this.spend(bytes)

    const entry = this.seal(
      {
        path: request.path,
        type: request.type,
        author: request.author,
        ref,
        body: request.body ?? null,
        version: null,
        contentHash: null,
      },
      null,
    )
    let lease: Lease | null = null
    if (request.type === 'claim' && ref !== null) {
      // A renewal keeps its token, so the holder never has to swap one for another.
      const token = renewing ?? newClaimToken()
      if (renewing === null) {
        this.sql.exec(`INSERT OR REPLACE INTO leases VALUES (?, ?)`, ref, token)
      }
      lease = {
        holder: request.author,
        expiresAt: new Date(Date.parse(entry.at) + this.leaseMs).toISOString(),
        token,
      }
    }
    const value: AppendResult = { entry, lease }
    if (key) {
      this.sql.exec(
        `INSERT INTO idempotency VALUES (?, ?, ?, ?)`,
        key,
        requestHash,
        JSON.stringify(value),
        now,
      )
    }
    return ok(value, { created: true })
  }

  private leaseToken(task: number): string | null {
    const [row] = this.sql
      .exec<{ token: string }>(`SELECT token FROM leases WHERE task = ?`, task)
      .toArray()
    return row?.token ?? null
  }

  private page(folder: string | null, path: string | undefined, after: number, limit: number) {
    const rows = this.sql
      .exec<Entry>(
        `SELECT ${ENTRY} FROM entries WHERE seq > ? ${path ? 'AND path = ?' : ''} ORDER BY seq LIMIT ?`,
        ...(path ? [after, path, limit] : [after, limit]),
      )
      .toArray()
    const head = this.head()
    // A short page means everything up to the head has been seen, even entries the filter skipped.
    const cursor = rows.length === limit ? (rows.at(-1)?.seq ?? after) : Math.max(after, head.seq)
    return { entries: rows.map((row) => visible(row, folder)), cursor, head }
  }

  async readLog(
    auth: Auth,
    query: { path?: string | undefined; after: number; limit: number },
    waitSeconds: number,
  ): Promise<Result<{ page: LogPage; waited: number | null }>> {
    let link = this.authorize(auth)
    if (!link || (query.path && !inScope(link.folder, query.path))) {
      return { ok: false, problem: NOT_FOUND }
    }
    let page = this.page(link.folder, query.path, query.after, query.limit)
    const wait = Math.min(waitSeconds, MAX_WAIT_SECONDS)
    if (page.entries.length > 0 || wait <= 0) return ok({ page, waited: null })
    // Each waiting request holds memory in the object, and a socket to /live serves any number of
    // readers for less.
    if (this.polls >= LIMITS.polls) {
      return {
        ok: false,
        problem: {
          status: 429,
          code: 'rate_limited',
          detail: `At most ${LIMITS.polls} requests can wait on a workspace at once. Try again shortly, or follow it over /live.`,
          retryAfterMs: 5000,
        },
      }
    }

    this.polls += 1
    try {
      const deadline = Date.now() + wait * 1000
      while (page.entries.length === 0 && Date.now() < deadline) {
        // oxlint-disable-next-line no-await-in-loop -- each wait depends on what the last one found
        await this.nextEntry(deadline - Date.now())
        // The link may have been revoked, or the workspace expired, while this request waited.
        link = this.authorize(auth)
        if (!link) return { ok: false, problem: NOT_FOUND }
        page = this.page(link.folder, query.path, query.after, query.limit)
      }
    } finally {
      this.polls -= 1
    }
    return ok({ page, waited: wait })
  }

  search(
    auth: Auth,
    query: { q: string; path?: string | undefined; limit: number },
  ): Result<SearchResults> {
    const link = this.authorize(auth)
    if (!link || (query.path && !inScope(link.folder, query.path))) {
      return { ok: false, problem: NOT_FOUND }
    }
    // Each word is quoted so FTS5 treats the query as plain text, not its query syntax.
    const match = query.q
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `"${word.replaceAll('"', '""')}"`)
      .join(' ')
    if (!match) return ok({ results: [] })
    const scope = link.folder === null ? '' : `${link.folder}/`
    const results = this.sql
      .exec<{ path: string; seq: number | null; snippet: string }>(
        `SELECT path, seq, snippet(search, 0, '**', '**', '…', 16) AS snippet FROM search
         WHERE search MATCH ? AND substr(path, 1, ?) = ? ${query.path ? 'AND path = ?' : ''}
         ORDER BY rank LIMIT ?`,
        ...(query.path
          ? [match, scope.length, scope, query.path, query.limit]
          : [match, scope.length, scope, query.limit]),
      )
      .toArray()
    return ok({ results })
  }

  listLinks(auth: Auth): Result<{ links: Link[] }> {
    const link = this.authorize(auth, ['w'])
    if (!link) return { ok: false, problem: NOT_FOUND }
    const links = this.sql
      .exec<Link>(`SELECT ${LINK} FROM links WHERE revoked_at IS NULL ORDER BY created_at, id`)
      .toArray()
      .filter((other) => within(link.folder, other.folder))
    return ok({ links })
  }

  createLink(auth: Auth, request: NewLink): Result<Link> {
    const link = this.authorize(auth, ['w'])
    if (!link) return { ok: false, problem: NOT_FOUND }
    const folder = request.folder ?? link.folder
    if (!within(link.folder, folder)) {
      return fail(422, 'invalid_request', `The folder must be inside ${link.folder}.`)
    }
    const { count } = this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM links`).one()
    if (count >= LIMITS.links) {
      return fail(409, 'workspace_full', `A workspace has at most ${LIMITS.links} links.`)
    }
    const createdAt = new Date().toISOString()
    this.insertLink({ ...request, folder }, createdAt)
    return ok({ id: request.id, tier: request.tier, folder, createdAt }, { created: true })
  }

  revokeLink(auth: Auth, linkId: string): Result<null> {
    const link = this.authorize(auth, ['w'])
    if (!link) return { ok: false, problem: NOT_FOUND }
    if (linkId === link.id) return fail(422, 'invalid_request', 'A link can’t revoke itself.')
    const [target] = this.sql
      .exec<Link>(`SELECT ${LINK} FROM links WHERE id = ? AND revoked_at IS NULL`, linkId)
      .toArray()
    if (!target || !within(link.folder, target.folder)) return { ok: false, problem: NOT_FOUND }
    this.sql.exec(`DELETE FROM links WHERE id = ?`, linkId)
    for (const socket of this.ctx.getWebSockets()) {
      const state: SocketState = socket.deserializeAttachment()
      if (state.linkId === linkId) socket.close(1008, 'Link revoked')
    }
    return ok(null)
  }

  // The Worker forwards WebSocket upgrades here with the link already parsed into headers.
  override fetch(request: Request): Response {
    const tier = ALL.find((t) => t === request.headers.get('x-mdplane-tier'))
    const secretHash = request.headers.get('x-mdplane-secret-hash')
    const link = tier && secretHash ? this.authorize({ tier, secretHash }) : null
    if (!link) return new Response(null, { status: 404 })
    if (this.ctx.getWebSockets().length >= LIMITS.sockets)
      return new Response(null, { status: 429 })
    const after = Number(new URL(request.url).searchParams.get('after') ?? 0)

    const [client, server] = Object.values(new WebSocketPair())
    if (!client || !server) throw new Error('WebSocketPair is empty')
    this.ctx.acceptWebSocket(server)
    const state: SocketState = { linkId: link.id, folder: link.folder }
    server.serializeAttachment(state)
    // Sent before any new entry can be sealed, so the backlog and the live stream don't overlap.
    for (const entry of this.sql.exec<Entry>(
      `SELECT ${ENTRY} FROM entries WHERE seq > ? ORDER BY seq`,
      after,
    )) {
      server.send(JSON.stringify(visible(entry, link.folder)))
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketMessage(): void {
    // The stream is one-way; anything a client sends is ignored.
  }

  private full<T>(): Result<T> {
    return fail(409, 'workspace_full', `A workspace's log holds at most ${LIMITS.entries} entries.`)
  }

  private insertLink(link: NewLink, createdAt: string): void {
    this.sql.exec(
      `INSERT INTO links (id, tier, folder, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
      link.id,
      link.tier,
      link.folder,
      link.secretHash,
      createdAt,
    )
  }
}
