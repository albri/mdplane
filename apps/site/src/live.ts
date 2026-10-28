// Keeps a reader in step with a real workspace: loads its log and bodies, then applies each new
// entry from the live stream in order.
import type { LogItem, Workspace } from '@mdplane/contract/core'
import {
  follow,
  getWorkspace,
  isEntry,
  type LinkInfo,
  loadBody,
  loadSession,
  readLog,
} from './api.ts'
import type { Session } from './model.ts'
import type { Reader } from './reader.ts'

export type Watch = {
  workspace: Workspace
  files: () => string[]
  show: (path: string) => Promise<void>
  stop: () => void
}

export async function watch(
  link: LinkInfo,
  reader: Reader,
  { path, onFiles }: { path?: string | undefined; onFiles?: (files: string[]) => void } = {},
): Promise<Watch> {
  const workspace = await getWorkspace(link.base)
  const log: LogItem[] = await readLog(link.base)
  const files = new Set(workspace.files.map((f) => f.path))
  let session: Session | null = null

  const show = async (next: string) => {
    const loaded = await loadSession(link, workspace, log, next)
    // `log` is shared, so the stream keeps every session's chain current.
    loaded.log = log
    session = loaded
    reader.load(loaded)
  }

  // Entries are applied one at a time, so a write whose body is still loading can't be overtaken.
  let queue = Promise.resolve()
  const apply = async (item: LogItem) => {
    log.push(item)
    if (!isEntry(item)) return
    const created = item.type === 'write' && !files.has(item.path)
    if (created) files.add(item.path)
    if (item.type === 'delete') files.delete(item.path)
    if (!session) {
      if (item.type === 'write') await show(item.path)
    } else if (item.path !== session.path) {
      reader.logChanged()
    } else {
      if (item.type === 'write') await loadBody(session, link.base, item)
      session.entries.push(item)
      reader.appended()
    }
    if (created || item.type === 'delete') onFiles?.([...files])
  }

  const first = path && files.has(path) ? path : [...files][0]
  if (first) await show(first)
  const stop = follow(link.base, log.at(-1)?.seq ?? 0, (item) => {
    queue = queue.then(() => apply(item)).catch(() => undefined)
  })
  const timer = window.setInterval(() => reader.refresh(), 15_000)

  return {
    workspace,
    files: () => [...files],
    show,
    stop: () => {
      stop()
      window.clearInterval(timer)
    },
  }
}
