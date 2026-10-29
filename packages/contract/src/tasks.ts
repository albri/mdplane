// How a task's status follows from the entries that refer to it. The server uses this to accept
// or refuse appends, and the reader uses it to replay a file, so both agree on every state.
import type { Entry, TaskView } from './generated/types.gen.ts'

export const LEASE_MS = 10 * 60 * 1000

// The parts of an entry that statuses follow from.
export type TaskSource = Pick<Entry, 'seq' | 'at' | 'type' | 'author' | 'ref' | 'body'>

// Pass a file's entries oldest first. A delete starts the file over. A lease is the claim's time
// plus the lease length, and lapses on its own once `asOf` passes it.
export function deriveTasks(
  entries: Iterable<TaskSource>,
  asOf: number,
  leaseMs = LEASE_MS,
): TaskView[] {
  const tasks = new Map<number, TaskView>()
  // Lease ends as times, formatted only for the leases still running at the end. The reader runs
  // this for every step through a long file, where most claims are long finished.
  const leases = new Map<TaskView, number>()
  for (const entry of entries) {
    if (entry.type === 'delete') {
      tasks.clear()
      leases.clear()
      continue
    }
    if (entry.type === 'task') {
      tasks.set(entry.seq, {
        seq: entry.seq,
        author: entry.author,
        body: entry.body ?? '',
        createdAt: entry.at,
        status: 'open',
        holder: null,
        leaseExpiresAt: null,
      })
      continue
    }
    const task = entry.ref === null ? undefined : tasks.get(entry.ref)
    if (!task) continue
    if (entry.type === 'claim') {
      task.status = 'claimed'
      task.holder = entry.author
      leases.set(task, Date.parse(entry.at) + leaseMs)
    } else if (entry.type === 'response' || entry.type === 'cancel') {
      task.status = entry.type === 'response' ? 'done' : 'cancelled'
      task.holder = null
      leases.delete(task)
    }
  }
  for (const [task, until] of leases) {
    if (until <= asOf) {
      task.status = 'open'
      task.holder = null
    } else {
      task.leaseExpiresAt = new Date(until).toISOString()
    }
  }
  return [...tasks.values()]
}

// A file view's tasks and its entries each stop at this many items or this many bytes of their
// bodies, so a view stays small enough to send however busy the file gets.
export const FILE_VIEW_LIMITS = { tasks: 100, entries: 100, bytes: 131_072 }

// A string's length in UTF-8, as SQLite stores it, so the reader cuts a view where the server
// does.
export function utf8Length(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code < 0xdc00 && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

// How many items, taken in order, fit within `count` and `bytes`. The first always fits, so a
// page of the log always moves on.
export function fitting(sizes: Iterable<number>, count: number, bytes: number): number {
  let taken = 0
  let spent = 0
  for (const size of sizes) {
    spent += size
    if (taken === count || (taken > 0 && spent > bytes)) break
    taken += 1
  }
  return taken
}

const active = (task: TaskView) => task.status === 'open' || task.status === 'claimed'

// The tasks a file view shows when they don't all fit: the open and claimed ones first, oldest
// first, since they are the ones to work on, then the newest done and cancelled ones. The server
// and the reader both use this, so the reader shows what an agent gets. The server passes the
// sizes of bodies it hasn't read.
export function pickTasks(
  tasks: TaskView[],
  size: (task: TaskView) => number = (task) => utf8Length(task.body),
): TaskView[] {
  const ranked = [...tasks.filter(active), ...tasks.filter((task) => !active(task)).toReversed()]
  const shown = fitting(ranked.map(size), FILE_VIEW_LIMITS.tasks, FILE_VIEW_LIMITS.bytes)
  return ranked.slice(0, shown).toSorted((a, b) => a.seq - b.seq)
}

// The newest of a file's entries, given oldest first, that a file view shows.
export function pickEntries(entries: Entry[]): Entry[] {
  const sizes = entries.toReversed().map((entry) => utf8Length(entry.body ?? ''))
  return entries.slice(
    entries.length - fitting(sizes, FILE_VIEW_LIMITS.entries, FILE_VIEW_LIMITS.bytes),
  )
}
