import { describe, expect, test } from 'vitest'
import { GENESIS, LEASE_MS, type Entry } from '@mdplane/contract/core'
import { type Session, stateAt } from '../src/model.ts'

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
      [1, 'task', 'alex'],
      [2, 'claim', 'gemini@desktop', 2],
      [2 + lease - 1, 'comment', 'alex'],
      [2 + lease, 'comment', 'alex'],
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
      [1, 'task', 'alex'],
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
      [1, 'task', 'alex'],
      [2, 'comment', 'alex'],
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
