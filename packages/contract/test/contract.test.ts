import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import type { ZodType } from 'zod'
import type { Entry } from '../src/generated/types.gen.ts'
import * as schemas from '../src/generated/zod.gen.ts'
import { type EntryContent, GENESIS, hashEntry, instructions, verifyChain } from '../src/index.ts'

const spec = parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'))

type Example = { at: string; schema: string; value: unknown }

// Every `example` sitting next to a `$ref` schema, wherever it is in the spec.
function examples(node: unknown, at = '#'): Example[] {
  if (!node || typeof node !== 'object') return []
  const found: Example[] = []
  const { schema, example } = node as { schema?: { $ref?: string }; example?: unknown }
  if (example !== undefined && schema?.$ref) {
    found.push({ at, schema: schema.$ref.replace('#/components/schemas/', ''), value: example })
  }
  for (const [key, child] of Object.entries(node)) found.push(...examples(child, `${at}/${key}`))
  return found
}

describe('spec examples', () => {
  const all = examples(spec)

  test('there are examples to check', () => {
    expect(all.length).toBeGreaterThan(8)
  })

  test.each(all)('$at matches $schema', ({ schema, value }) => {
    const zod = (schemas as Record<string, ZodType | undefined>)[`z${schema}`]
    if (!zod) throw new Error(`No generated schema z${schema}`)
    expect(zod.safeParse(value).error?.issues ?? []).toEqual([])
  })
})

describe('agent instructions', () => {
  test('a read link is only told about reads', () => {
    expect(instructions.r).not.toMatch(/^- `(POST|PUT|DELETE) /m)
    expect(instructions.r).not.toContain('## How to work here')
  })

  test('an append link can append but not write bodies or manage links', () => {
    expect(instructions.a).toContain('- `POST $URL/appends`')
    expect(instructions.a).not.toMatch(/^- `(PUT|DELETE) /m)
    expect(instructions.a).not.toContain('$URL/links')
  })

  test('a write link is told about every keyed request', () => {
    const keyed = Object.keys(spec.paths).filter((path) => path.startsWith('/{tier}/{key}'))
    for (const path of keyed) {
      expect(instructions.w).toContain(`$URL${path.slice('/{tier}/{key}'.length)}`)
    }
  })
})

describe('hash chain', () => {
  const entry = (seq: number, body: string): EntryContent => ({
    seq,
    at: `2026-11-01T09:0${seq}:00.000Z`,
    path: 'queue.md',
    type: 'comment',
    author: 'codex@ci',
    ref: null,
    body,
    version: null,
    contentHash: null,
  })

  async function chain(bodies: string[]): Promise<Entry[]> {
    const sealed: Entry[] = []
    let prev = GENESIS
    for (const [i, body] of bodies.entries()) {
      const content = entry(i + 1, body)
      const hash = await hashEntry(prev, content)
      sealed.push({ ...content, prev, hash })
      prev = hash
    }
    return sealed
  }

  // Computed independently from the canonical form in the spec. Other implementations rely on it.
  test('hashes match the canonical form in the spec', async () => {
    const [first] = await chain(['CI is green on Node 22.'])
    expect(first?.hash).toBe('7441643eedee7ede24fec9ee4520e341ec771f751ce9e6ff1b21dce8a4c2eda9')
  })

  test('an intact chain verifies to its head', async () => {
    const log = await chain(['one', 'two', 'three'])
    expect(await verifyChain(log)).toEqual({ ok: true, head: log[2]?.hash })
  })

  test('an edited body breaks the chain at that entry', async () => {
    const log = await chain(['one', 'two', 'three'])
    const tampered = log.map((e) => (e.seq === 2 ? { ...e, body: 'TWO' } : e))
    expect(await verifyChain(tampered)).toEqual({ ok: false, brokenAt: 2 })
  })

  test('a removed entry breaks the chain at the next one', async () => {
    const log = await chain(['one', 'two', 'three'])
    expect(await verifyChain([log[0], log[2]] as Entry[])).toEqual({ ok: false, brokenAt: 3 })
  })

  test('a redacted entry keeps the chain checkable', async () => {
    const log = await chain(['one', 'two', 'three'])
    const middle = log[1] as Entry
    const redacted = {
      seq: middle.seq,
      prev: middle.prev,
      hash: middle.hash,
      redacted: true as const,
    }
    expect(await verifyChain([log[0] as Entry, redacted, log[2] as Entry])).toMatchObject({
      ok: true,
    })
  })
})
