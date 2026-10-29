// The latest head this browser has verified for each workspace. Checking a chain in the browser
// proves only that it matches itself: a server that rewrote an entry and recomputed every hash
// after it would pass. A head kept from an earlier visit is a fingerprint it can't recompute.
import type { Head, LogItem } from '@mdplane/contract/core'

const key = (workspaceId: string) => `mdplane-head:${workspaceId}`

export function recall(workspaceId: string): Head | null {
  try {
    const head: unknown = JSON.parse(localStorage.getItem(key(workspaceId)) ?? 'null')
    if (
      head !== null &&
      typeof head === 'object' &&
      'seq' in head &&
      'hash' in head &&
      typeof head.seq === 'number' &&
      typeof head.hash === 'string'
    ) {
      return { seq: head.seq, hash: head.hash }
    }
  } catch {
    // Storage can be unavailable or hold something else; then there's nothing to compare with.
  }
  return null
}

export function remember(workspaceId: string, head: Head): void {
  try {
    localStorage.setItem(key(workspaceId), JSON.stringify(head))
  } catch {
    // Not remembered, so the next visit checks the chain only against itself.
  }
}

// The entry where this log parts from a head checked before, or null if it still leads there.
export function departure(log: LogItem[], head: Head | null): number | null {
  if (!head) return null
  return log.find((item) => item.seq === head.seq)?.hash === head.hash ? null : head.seq
}
