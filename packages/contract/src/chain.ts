// The hash chain described on the Entry schema in openapi.yaml. Readers check it here with Web
// Crypto, which runs in Workers and browsers. The Worker seals entries by hashing the same
// `chainInput` synchronously, because an await between authorisation and the sealed entry would
// let another request in.
import type { Entry, LogItem } from './generated/types.gen.ts'

export const GENESIS = '0'.repeat(64)

export type EntryContent = Omit<Entry, 'prev' | 'hash'>

const encoder = new TextEncoder()

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function canonical(entry: EntryContent): string {
  const { seq, at, path, type, author, ref, body, version, contentHash } = entry
  return JSON.stringify({ seq, at, path, type, author, ref, body, version, contentHash })
}

// What an entry's hash is taken over: the hash before it, then its canonical form.
export function chainInput(prev: string, entry: EntryContent): string {
  return `${prev}\n${canonical(entry)}`
}

export function hashEntry(prev: string, entry: EntryContent): Promise<string> {
  return sha256(chainInput(prev, entry))
}

export type ChainCheck = { ok: true; head: string } | { ok: false; brokenAt: number }

// Checks a contiguous run of the log. Pass the hash before the first item to check a run that
// doesn't start at the beginning. Every stored hash is recomputed independently, then the links
// are walked in order. A redacted item can't be recomputed, so only its link is checked.
export async function verifyChain(items: LogItem[], prev = GENESIS): Promise<ChainCheck> {
  const recomputed = await Promise.all(
    items.map(async (item) => ('redacted' in item ? item.hash : hashEntry(item.prev, item))),
  )
  for (const [i, item] of items.entries()) {
    if (item.prev !== prev || recomputed[i] !== item.hash) return { ok: false, brokenAt: item.seq }
    prev = item.hash
  }
  return { ok: true, head: prev }
}
