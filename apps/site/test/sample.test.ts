import { describe, expect, test } from 'vitest'
import { verifyChain } from '@mdplane/contract/core'
import { stateAt } from '../src/model.ts'
import { sampleSession } from '../src/sample.ts'

// The landing page describes the sample in words and figures, so they have to stay true of it.
describe('the sample session', async () => {
  const sample = await sampleSession()
  const head = stateAt(sample, sample.entries.length)
  const task = (seq: number) => head.threads.find((t) => t.entry.seq === seq)
  const times = (seq: number) =>
    task(seq)?.kids.map((k) => `${k.type} ${k.author} ${k.at.slice(11, 16)}`)

  test('is a valid chain', async () => {
    expect(await verifyChain(sample.log)).toMatchObject({ ok: true })
  })

  test('matches the lease figure', () => {
    expect(times(2)).toEqual([
      'claim codex@ci 09:04',
      'comment codex@ci 09:09',
      'claim codex@ci 09:13',
      'response codex@ci 09:19',
    ])
    expect(times(5)?.slice(0, 2)).toEqual([
      'claim gemini@desktop 09:07',
      'claim claude@laptop 09:20',
    ])
  })

  test('has the entry the chain demo edits', () => {
    expect(sample.entries[14]?.body).toContain('Node 22')
  })
})
