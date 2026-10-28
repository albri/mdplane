// Keeps a reader in step with a real workspace: loads its log, then applies each new entry from
// the live stream in order. Bodies load as the reader comes to them.
import type { LogItem, Workspace } from '@mdplane/contract/core'
import { Bodies, follow, getWorkspace, isEntry, type LinkInfo, readLog } from './api.ts'
import type { LiveStatus, Session } from './model.ts'
import type { Reader } from './reader.ts'

export type Watch = {
  workspace: Workspace
  files: () => string[]
  show: (path: string) => Promise<void>
  stop: () => void
}

type Options = {
  path?: string | undefined
  onFiles?: (files: string[]) => void
  onStatus?: (status: LiveStatus) => void
}

// How long a write waits for its body before it's shown anyway, still loading. Long enough to
// cover a normal fetch, so a new version doesn't flash "Loading"; short enough that a stalled one
// doesn't hold up the entries behind it.
const BODY_WAIT = 2000

const atMost = (ms: number, work: Promise<void>) =>
  Promise.race([work, new Promise<void>((resolve) => window.setTimeout(resolve, ms))])

// A file exists from its first write until a delete, so the log alone says which files there are.
function filesIn(log: LogItem[]): Set<string> {
  const files = new Set<string>()
  for (const item of log) {
    if (!isEntry(item)) continue
    if (item.type === 'write') files.add(item.path)
    if (item.type === 'delete') files.delete(item.path)
  }
  return files
}

const sorted = (files: Set<string>) => [...files].toSorted()

export async function watch(
  link: LinkInfo,
  reader: Reader,
  { path, onFiles, onStatus }: Options = {},
): Promise<Watch> {
  const workspace = await getWorkspace(link.base)
  const log: LogItem[] = await readLog(link.base)
  // From the log rather than `workspace.files`, so a file made between the two requests is here.
  const files = filesIn(log)
  const bodies = new Bodies(link.base, () => reader.bodiesChanged())
  let session: Session | null = null
  let stopped = false

  // Opening a file and applying an entry share one queue, so each entry lands in exactly one
  // session: the file's entries are read from the log either before the entry is pushed to it or
  // after it has been applied.
  let queue = Promise.resolve()
  let queued = 0
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const open = async (next: string) => {
    const entries = log.filter(isEntry).filter((e) => e.path === next)
    const write = entries.findLast((e) => e.type === 'write')
    if (write) await atMost(BODY_WAIT, bodies.load(write))
    const loaded: Session = {
      workspaceId: workspace.id,
      name: workspace.name,
      path: next,
      tier: link.tier,
      host: location.host,
      entries,
      // `log` is shared, so the stream keeps every session's chain current.
      log,
      bodies: bodies.cache,
      source: bodies,
      mode: 'live',
      expiresAt: workspace.expiresAt,
    }
    session = loaded
    reader.load(loaded)
  }

  // Each show takes a number, and one overtaken by a later show does nothing, so a slow load
  // can't replace the file asked for after it.
  let shows = 0
  const show = (next: string) => {
    const mine = ++shows
    return enqueue(async () => {
      if (!stopped && mine === shows && session?.path !== next) await open(next)
    })
  }

  const apply = async (item: LogItem) => {
    if (stopped) return
    log.push(item)
    if (!isEntry(item)) {
      reader.logChanged()
      return
    }
    const created = item.type === 'write' && !files.has(item.path)
    if (created) files.add(item.path)
    if (item.type === 'delete') files.delete(item.path)
    // Taken before anything is awaited, so the entry goes to the file it belongs to.
    const current = session
    if (!current) {
      if (item.type === 'write') await open(item.path)
    } else if (item.path !== current.path) {
      reader.logChanged()
    } else {
      if (item.type === 'write') await atMost(BODY_WAIT, bodies.load(item))
      if (stopped) return
      current.entries.push(item)
      // Entries arriving faster than they can be animated are shown without moving the cards.
      reader.appended({ animate: queued <= 1 })
    }
    if (created || item.type === 'delete') onFiles?.(sorted(files))
  }

  reader.connection('connecting')
  const first = path && files.has(path) ? path : sorted(files)[0]
  if (first) await show(first)
  const stopFollowing = follow(link.base, log.at(-1)?.seq ?? 0, {
    onItem: (item) => {
      queued++
      void enqueue(() => apply(item))
        .catch(reportError)
        .finally(() => queued--)
    },
    onStatus: (status) => {
      if (stopped) return
      reader.connection(status)
      onStatus?.(status)
    },
  })
  const timer = window.setInterval(() => reader.refresh(), 15_000)

  return {
    workspace,
    files: () => sorted(files),
    show,
    stop: () => {
      stopped = true
      stopFollowing()
      bodies.stop()
      window.clearInterval(timer)
    },
  }
}
