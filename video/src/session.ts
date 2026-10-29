// The landing page's sample session, with real hashes from the contract. The sample is sealed on
// the day it runs, so the film reseals it on a fixed day to show the same hashes in every render.
import { type Entry, GENESIS, hashEntry } from '@mdplane/contract/core'
import { sampleSession } from '../../apps/site/src/sample.ts'

const DAY = '2026-10-28'

// The entry the film edits, and the edit.
export const EDITED = 15
const EDIT = ['Node 22', 'Node 20'] as const

export type FilmSession = {
  workspaceId: string
  entries: Entry[]
  // The first version of the file's body: the brief.
  brief: string
  // Every version of the body by its content hash, as the reader looks them up.
  bodies: Record<string, string>
  // What the hashes from the edited entry onward would have to be after the edit.
  rehashed: Record<number, string>
}

async function seal(entries: Entry[]): Promise<Entry[]> {
  const out: Entry[] = []
  let prev = GENESIS
  for (const entry of entries) {
    // oxlint-disable-next-line no-await-in-loop -- each hash needs the previous one
    const hash = await hashEntry(prev, entry)
    out.push({ ...entry, prev, hash })
    prev = hash
  }
  return out
}

export async function filmSession(): Promise<FilmSession> {
  const sample = await sampleSession()
  const entries = await seal(sample.entries.map((e) => ({ ...e, at: DAY + e.at.slice(10) })))
  const edited = await seal(
    entries.map((e) =>
      e.seq === EDITED ? { ...e, body: (e.body ?? '').replace(EDIT[0], EDIT[1]) } : e,
    ),
  )
  const rehashed: Record<number, string> = {}
  for (const e of edited) if (e.seq >= EDITED) rehashed[e.seq] = e.hash
  const brief = sample.bodies.get(entries[0]?.contentHash ?? '') ?? ''
  return {
    workspaceId: sample.workspaceId,
    entries,
    brief,
    bodies: Object.fromEntries(sample.bodies),
    rehashed,
  }
}

export const editOf = (body: string) => {
  const [before = '', after = ''] = body.split(EDIT[0])
  return { before: `${before}Node `, was: '22', now: '20', after }
}
