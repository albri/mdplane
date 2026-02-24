import type { ElysiaContextSet } from './types'

export function createFileDeletedResponse(deletedAt: string, set: ElysiaContextSet) {
  const deletedDate = new Date(deletedAt)
  const expiresAt = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const recoverable = Date.now() - deletedDate.getTime() < 7 * 24 * 60 * 60 * 1000

  set.status = 410
  set.headers['X-Deleted-At'] = deletedAt

  return {
    ok: false as const,
    error: {
      code: 'FILE_DELETED' as const,
      message: 'File is soft-deleted',
      details: {
        recoverable,
        expiresAt,
      },
    },
  }
}

export function parseFrontmatterFromMarkdown(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    return {}
  }

  const frontmatter: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex <= 0) continue
    const key = line.substring(0, colonIndex).trim()
    const value = line.substring(colonIndex + 1).trim()
    frontmatter[key] = value
  }

  return frontmatter
}

export function generateVersionedETag(content: string, updatedAt: string): string {
  const hash = Bun.hash(content + updatedAt)
  return `"${hash.toString(16)}"`
}

