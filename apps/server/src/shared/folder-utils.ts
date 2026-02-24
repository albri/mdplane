import type {
  ListFolderContentsQuery,
  ListFolderContentsViaAppendKeyQuery,
  ListFolderContentsViaWriteKeyQuery,
} from '@mdplane/shared'
import type { ErrorCode } from '../core/errors'

export type FolderListQuery =
  | ListFolderContentsQuery
  | ListFolderContentsViaAppendKeyQuery
  | ListFolderContentsViaWriteKeyQuery

export type SortField = 'name' | 'modified' | 'size'
export type SortOrder = 'asc' | 'desc'

export function validateFilename(filename: string): { code: string; message: string } | null {
  if (!filename || filename.trim().length === 0) {
    return { code: 'INVALID_REQUEST', message: 'filename is required' }
  }

  if (filename.includes('\0')) {
    return { code: 'INVALID_PATH', message: 'Filename contains null bytes' }
  }

  if (filename.includes('/') || filename.includes('\\')) {
    return { code: 'INVALID_PATH', message: 'Filename cannot contain path separators' }
  }

  if (filename === '.' || filename === '..') {
    return { code: 'INVALID_PATH', message: 'Invalid filename' }
  }

  return null
}

export function validateFolderName(name: string): { code: ErrorCode; message: string } | null {
  if (!name || name.trim().length === 0) {
    return { code: 'INVALID_REQUEST' as const, message: 'name is required' }
  }

  if (name.includes('\0')) {
    return { code: 'INVALID_PATH' as const, message: 'Folder name contains null bytes' }
  }

  if (name.includes('/') || name.includes('\\')) {
    return { code: 'INVALID_PATH' as const, message: 'Folder name cannot contain path separators' }
  }

  if (name === '.' || name === '..') {
    return { code: 'INVALID_PATH' as const, message: 'Invalid folder name' }
  }

  return null
}

type DetectPossibleTraversalInput = {
  rawUrl: string
  key: string
  pathParam: string
}

export function detectPossibleTraversal({ rawUrl, key, pathParam }: DetectPossibleTraversalInput): boolean {
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('%2E%2E')) {
    return true
  }

  try {
    const url = new URL(rawUrl)
    const pathname = url.pathname
    const suspiciousPaths = ['etc', 'passwd', 'shadow', 'hosts', 'root', 'var', 'usr', 'bin']

    if (suspiciousPaths.includes(key.toLowerCase())) {
      return true
    }

    const normalizedPath = pathParam.toLowerCase()
    for (const suspicious of suspiciousPaths) {
      if (normalizedPath === suspicious || normalizedPath.startsWith(suspicious + '/')) {
        return true
      }
    }

    if (!pathname.includes('/folders')) {
      return true
    }
  } catch {
    return true
  }

  return false
}

export function parsePaginationParams(query?: FolderListQuery): {
  limit: number
  offset: number
  sort: SortField
  order: SortOrder
} {
  const limit = query?.limit ?? 50

  let offset = 0
  if (query?.cursor) {
    try {
      const decoded = Buffer.from(query.cursor, 'base64').toString('utf8')
      offset = Math.max(0, parseInt(decoded, 10) || 0)
    } catch {
      offset = 0
    }
  }

  const sort: SortField = (query?.sort as SortField) ?? 'name'
  const order: SortOrder = query?.order ?? 'asc'

  return { limit, offset, sort, order }
}

export function buildCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64')
}
