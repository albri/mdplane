import { sqlite } from '../db'

export function updateApiKeyLastUsed(keyId: string): void {
  const now = new Date().toISOString()
  sqlite.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, keyId)
}
