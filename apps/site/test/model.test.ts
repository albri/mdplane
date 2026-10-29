import { describe, expect, test } from 'vitest'
import { GENESIS, LEASE_MS, type Entry } from '@mdplane/contract/core'
import { renews, type Session, stateAt } from '../src/model.ts'

const START = Date.parse('2026-10-28T09:00:00Z')

function session(rows: [minutes: number, type: Entry['type'], author: string, ref?: number][]) {
  const entries = rows.map(([minutes, type, author, ref], i): Entry => ({
    seq: i + 1,
    at: new Date(START + minutes * 60_000).toISOString(),
    path: 'queue.md',
    type,
    author,
    ref: ref ?? null,
    body: type === 'write' || type === 'delete' ? null : `${type} ${i + 1}`,
    version: type === 'write' ? 1 : null,
    contentHash: type === 'write' ? `hash${i + 1}` : null,
    prev: GENESIS,
    hash: GENESIS,
  }))
  const bodies = new Map(entries.flatMap((e) => (e.contentHash ? [[e.contentHash, 'Body']] : [])))
  return {
    workspaceId: 'wk_7Qm2x9Lp4Rt8',
    name: null,
    path: 'queue.md',
    tier: 'r',
    host: 'mdplane.dev',
    entries,
    log: entries,
    bodies,
    mode: 'replay',
    expiresAt: null,
  } satisfies Session
}

describe('a file at a point in its history', () => {
  test('replays a lease running out at the time of the entry shown', () => {
    const lease = LEASE_MS / 60_000
    const s = session([
      [0, 'write', 'ln_Ne4Jw9Qa2Xt7'],
      [1, 'task', 'lead@devbox'],
      [2, 'claim', 'gemini@desktop', 2],
      [2 + lease - 1, 'comment', 'lead@devbox'],
      [2 + lease, 'comment', 'lead@devbox'],
    ])
    const held = stateAt(s, 4).threads[0]
    expect(held?.task).toMatchObject({ status: 'claimed', holder: 'gemini@desktop' })
    expect(held?.lapsed).toBeNull()
    const lapsed = stateAt(s, 5).threads[0]
    expect(lapsed?.task).toMatchObject({ status: 'open', holder: null })
    expect(lapsed?.lapsed?.seq).toBe(3)
  })

  test('starts the file over after a delete', () => {
    const s = session([
      [0, 'write', 'ln_Ne4Jw9Qa2Xt7'],
      [1, 'task', 'lead@devbox'],
      [2, 'delete', 'ln_Ne4Jw9Qa2Xt7'],
      [3, 'write', 'ln_Ne4Jw9Qa2Xt7'],
    ])
    const deleted = stateAt(s, 3)
    expect(deleted).toMatchObject({ write: null, body: null, threads: [] })
    expect(deleted.deletion?.seq).toBe(3)
    const rewritten = stateAt(s, 4)
    expect(rewritten).toMatchObject({ deletion: null, body: 'Body', threads: [] })
    expect(rewritten.write?.seq).toBe(4)
  })

  test('threads entries under their task and keeps other comments apart', () => {
    const s = session([
      [0, 'write', 'ln_Ne4Jw9Qa2Xt7'],
      [1, 'task', 'lead@devbox'],
      [2, 'comment', 'lead@devbox'],
      [3, 'claim', 'codex@ci', 2],
      [4, 'response', 'codex@ci', 2],
    ])
    const state = stateAt(s, 5)
    expect(state.threads.map((t) => [t.task.status, t.kids.map((k) => k.seq)])).toEqual([
      ['done', [4, 5]],
    ])
    expect(state.notes.map((e) => e.seq)).toEqual([3])
  })
})

describe('a claim on a task', () => {
  test('renews the lease only when its holder claims again in time', () => {
    const lease = LEASE_MS / 60_000
    const { entries } = session([
      [0, 'task', 'lead@devbox'],
      [1, 'claim', 'codex@ci', 1],
      // The holder again, before the lease runs out.
      [2, 'claim', 'codex@ci', 1],
      // The same author once that lease has run out takes the task afresh.
      [3 + lease, 'claim', 'codex@ci', 1],
      [4 + 2 * lease, 'claim', 'claude@laptop', 1],
      // Back to the first author, after someone else held it.
      [5 + 3 * lease, 'claim', 'codex@ci', 1],
    ])
    const kids = entries.slice(1)
    expect(kids.map((_, i) => renews(kids, i))).toEqual([false, true, false, false, false])
  })
})
