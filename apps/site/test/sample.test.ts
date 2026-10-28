import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { verifyChain } from '@mdplane/contract/core'
import { leaseEnd, stateAt } from '../src/model.ts'
import { sampleSession } from '../src/sample.ts'

const page = readFileSync(new URL('../src/pages/index.html', import.meta.url), 'utf8')

// A task's route on the landing page: each stop's time and its words.
function route(task: number) {
  const list = new RegExp(`<ol class="route" data-task="${task}">([\\s\\S]*?)</ol>`).exec(page)
  return [...(list?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, stop = '']) => ({
    time: /<time datetime="([^"]+)"/.exec(stop)?.[1],
    text: stop
      .replaceAll(/<[^>]+>/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim(),
  }))
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`The sample has no ${what}`)
  return value
}

const hm = (time: number | string) => new Date(time).toISOString().slice(11, 16)

// The landing page describes the sample in words and figures, so they have to stay true of it.
describe('the sample session', async () => {
  const sample = await sampleSession()
  const head = stateAt(sample, sample.entries.length)
  const thread = (seq: number) =>
    need(
      head.threads.find((t) => t.entry.seq === seq),
      `task #${seq}`,
    )

  test('is a valid chain', async () => {
    expect(await verifyChain(sample.log)).toMatchObject({ ok: true })
  })

  test('matches the route of task #2', () => {
    const { entry, kids, task } = thread(2)
    expect(kids.map((k) => `${k.type} ${k.author}`)).toEqual([
      'claim codex@ci',
      'comment codex@ci',
      'claim codex@ci',
      'response codex@ci',
    ])
    const [claim, progress, renewal, response] = kids
    // The rejected claim never reaches the log; the claim the agent made instead says why.
    const instead = need(
      sample.entries.find((e) => e.author === 'opencode@vps' && e.body?.includes('holds #2')),
      'claim that mentions #2 being held',
    )
    const stops = route(2)
    expect(stops.map((s) => s.time)).toEqual(
      [entry, claim, instead, progress, renewal, response].map((e) => hm(need(e, 'entry').at)),
    )
    const held = leaseEnd(need(claim, 'claim'))
    expect(stops[1]?.text).toContain(`until ${hm(held)}`)
    expect(stops[2]?.text).toContain(`wait ${(held - Date.parse(instead.at)) / 60_000} minutes`)
    expect(stops[2]?.text).toContain(`task #${instead.ref}`)
    expect(stops[4]?.text).toContain(`until ${hm(leaseEnd(need(renewal, 'renewal')))}`)
    expect(task.status).toBe('done')
    expect(stops.at(-1)?.text).toContain('Done')
  })

  test('matches the route of task #5', () => {
    const { entry, kids, task } = thread(5)
    expect(kids.map((k) => `${k.type} ${k.author}`)).toEqual([
      'claim gemini@desktop',
      'claim claude@laptop',
      'comment claude@laptop',
    ])
    const [quiet, taken, progress] = kids
    const lapse = leaseEnd(need(quiet, 'claim'))
    expect(Date.parse(need(taken, 'second claim').at)).toBeGreaterThan(lapse)
    const stops = route(5)
    expect(stops.map((s) => s.time)).toEqual([
      hm(entry.at),
      hm(need(quiet, 'claim').at),
      hm(lapse),
      hm(need(taken, 'second claim').at),
      hm(need(progress, 'comment').at),
    ])
    expect(stops[1]?.text).toContain(`until ${hm(lapse)}`)
    expect(task.status).toBe('claimed')
    expect(stops.at(-1)?.text).toContain('In progress')
  })

  test('has the entry the chain demo edits', () => {
    expect(sample.entries[14]?.body).toContain('Node 22')
  })
})
