// The reader's view of one file at any point in its history, built from the same log entries and
// task rules the server uses.
import {
  deriveTasks,
  type Entry,
  type FileView,
  LEASE_MS,
  type LogItem,
  renderFile,
  type TaskView,
  type Tier,
} from '@mdplane/contract/core'

export type Session = {
  workspaceId: string
  name: string | null
  path: string
  tier: Tier
  host: string
  // This file's entries, oldest first.
  entries: Entry[]
  // Everything the link can see, so the whole chain can be checked.
  log: LogItem[]
  // File bodies by content hash. A write entry carries only the hash.
  bodies: Map<string, string>
  mode: 'replay' | 'live'
  expiresAt: string | null
  timeZone?: string
}

export type Thread = {
  task: TaskView
  entry: Entry
  kids: Entry[]
  // The claim whose lease ran out, when nobody has claimed or finished the task since.
  lapsed: Entry | null
}

export type State = {
  pos: number
  list: Entry[]
  now: number
  write: Entry | null
  body: string | null
  threads: Thread[]
}

export function stateAt(session: Session, pos: number, live = false): State {
  const list = session.entries.slice(0, pos)
  const last = list.at(-1)
  // Replaying, time stands at the entry being shown; at the head of a live file it is now.
  const now = live || !last ? Date.now() : Date.parse(last.at)
  const deleted = list.findLastIndex((e) => e.type === 'delete')
  const life = list.slice(deleted + 1)
  const write = life.findLast((e) => e.type === 'write') ?? null
  const byTask = new Map<number, Thread>()
  const tasks = deriveTasks(life, now, LEASE_MS)
  const entries = new Map(life.map((e) => [e.seq, e]))
  for (const task of tasks) {
    const entry = entries.get(task.seq)
    if (entry) byTask.set(task.seq, { task, entry, kids: [], lapsed: null })
  }
  for (const e of life) {
    if (e.ref !== null && e.type !== 'task') byTask.get(e.ref)?.kids.push(e)
  }
  for (const thread of byTask.values()) {
    if (thread.task.status !== 'open') continue
    const lastClaim = thread.kids.findLast((k) => k.type === 'claim')
    thread.lapsed = lastClaim ?? null
  }
  return {
    pos,
    list,
    now,
    write,
    body: write?.contentHash ? (session.bodies.get(write.contentHash) ?? null) : null,
    threads: [...byTask.values()],
  }
}

export type Counts = Record<TaskView['status'], number>

export function countTasks(threads: Thread[]): Counts {
  const counts: Counts = { done: 0, claimed: 0, open: 0, cancelled: 0 }
  for (const { task } of threads) counts[task.status] += 1
  return counts
}

export function summary(threads: Thread[]): string {
  if (threads.length === 0) return 'Nothing yet'
  const c = countTasks(threads)
  const parts = [`${threads.length} ${threads.length === 1 ? 'task' : 'tasks'}`]
  if (c.done) parts.push(`${c.done} done`)
  if (c.claimed) parts.push(`${c.claimed} in progress`)
  if (c.open) parts.push(`${c.open} open`)
  if (c.cancelled) parts.push(`${c.cancelled} cancelled`)
  return parts.join(' · ')
}

export function minutesLeft(until: number, now: number): string {
  const m = Math.ceil((until - now) / 60_000)
  return m <= 1 ? 'under a minute left' : `${m} min left`
}

const headOf = (log: LogItem[]) => {
  const last = log.at(-1)
  return { seq: last?.seq ?? 0, hash: last?.hash ?? '0'.repeat(64) }
}

// What an agent gets from `GET $URL/files/{path}` at this point, rendered by the server's code.
export function agentView(session: Session, state: State): string {
  const life = state.list.slice(state.list.findLastIndex((e) => e.type === 'delete') + 1)
  const view: FileView = {
    path: session.path,
    at: state.list.at(-1)?.seq ?? 0,
    head: headOf(session.log),
    version: state.write?.version ?? 1,
    contentHash: state.write?.contentHash ?? '',
    body: state.body ?? '',
    tasks: state.threads.map((t) => t.task),
    entries: life,
  }
  return renderFile(view)
}

export const leaseEnd = (claim: Entry) => Date.parse(claim.at) + LEASE_MS
