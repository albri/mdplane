import { sha256, type Tier } from '@mdplane/contract'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// Rejection sampling keeps every character uniform: 248 is the largest multiple of 62 below 256.
export function randomString(length: number): string {
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < 248 && out.length < length) out += ALPHABET[byte % 62]
    }
  }
  return out
}

export const newWorkspaceId = () => `wk_${randomString(12)}`
export const newLinkId = () => `ln_${randomString(12)}`
export const newSecret = () => randomString(32)

const KEY = /^(wk_[A-Za-z0-9]{12})\.([A-Za-z0-9]{32})$/

export type ParsedLink = { workspaceId: string; tier: Tier; secret: string }

// Anything that isn't a well-formed key for an allowed tier is treated like a wrong key.
export function parseLink(tier: string, key: string, allowed: readonly Tier[]): ParsedLink | null {
  const match = KEY.exec(key)
  if (!match?.[1] || !match[2]) return null
  const allowedTier = allowed.find((t) => t === tier)
  if (!allowedTier) return null
  return { workspaceId: match[1], tier: allowedTier, secret: match[2] }
}

// Only the hash of a secret is stored, so a copy of the database can't be used to act on links.
export const hashSecret = sha256

export function linkUrl(origin: string, tier: Tier, workspaceId: string, secret: string): string {
  return `${origin}/${tier}/${workspaceId}.${secret}`
}
