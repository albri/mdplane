// The hash chain described on the Entry schema in openapi.yaml. The Worker uses it to seal
// entries; readers use it to check them. Web Crypto only, so it runs in Workers and browsers.
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

export function hashEntry(prev: string, entry: EntryContent): Promise<string> {
  return sha256(`${prev}\n${canonical(entry)}`)
}

export type ChainCheck = { ok: true; head: string } | { ok: false; brokenAt: number }

// Checks a contiguous run of the log. Pass the hash before the first item to check a run that
// doesn't start at the beginning. A redacted item can't be recomputed, so only its link is checked.
export async function verifyChain(items: LogItem[], prev = GENESIS): Promise<ChainCheck> {
  for (const item of items) {
    if (item.prev !== prev) return { ok: false, brokenAt: item.seq }
    if (!('redacted' in item) && (await hashEntry(item.prev, item)) !== item.hash) {
      return { ok: false, brokenAt: item.seq }
    }
    prev = item.hash
  }
  return { ok: true, head: prev }
}
