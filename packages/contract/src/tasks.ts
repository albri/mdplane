// How a task's status follows from the entries that refer to it. The server uses this to accept
// or refuse appends, and the reader uses it to replay a file, so both agree on every state.
import type { Entry, TaskView } from './generated/types.gen.ts'

export const LEASE_MS = 10 * 60 * 1000

// Pass a file's entries oldest first. A delete starts the file over. A lease is the claim's time
// plus the lease length, and lapses on its own once `asOf` passes it.
export function deriveTasks(
  entries: Iterable<Entry>,
  asOf: number,
  leaseMs = LEASE_MS,
): TaskView[] {
  const tasks = new Map<number, TaskView>()
  for (const entry of entries) {
    if (entry.type === 'delete') {
      tasks.clear()
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
      task.leaseExpiresAt = new Date(Date.parse(entry.at) + leaseMs).toISOString()
    } else if (entry.type === 'response' || entry.type === 'cancel') {
      task.status = entry.type === 'response' ? 'done' : 'cancelled'
      task.holder = null
      task.leaseExpiresAt = null
    }
  }
  for (const task of tasks.values()) {
    if (task.leaseExpiresAt && Date.parse(task.leaseExpiresAt) <= asOf) {
      task.status = 'open'
      task.holder = null
      task.leaseExpiresAt = null
    }
  }
  return [...tasks.values()]
}

// A file view holds at most this many tasks and entries, so it stays small enough to send however
// busy the file gets.
export const FILE_VIEW_LIMITS = { tasks: 100, entries: 100 }

const active = (task: TaskView) => task.status === 'open' || task.status === 'claimed'

// The tasks a file view shows when they don't all fit: the open and claimed ones first, oldest
// first, since they are the ones to work on, then the newest done and cancelled ones. The server
// and the reader both use this, so the reader shows what an agent gets.
export function pickTasks(tasks: TaskView[], limit = FILE_VIEW_LIMITS.tasks): TaskView[] {
  if (tasks.length <= limit) return tasks
  const open = tasks.filter(active).slice(0, limit)
  const closed = tasks.filter((task) => !active(task))
  const room = limit - open.length
  return [...open, ...closed.slice(closed.length - room)].toSorted((a, b) => a.seq - b.seq)
}
