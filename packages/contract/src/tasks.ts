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
