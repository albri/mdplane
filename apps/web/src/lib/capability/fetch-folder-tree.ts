/**
 * Server-side folder tree fetching.
 *
 * This module provides server-side folder tree fetching for capability URLs.
 * Used in RSC layouts to prefetch folder data for TanStack Query hydration.
 */

import { FOLDER_ROUTES, type KeyType, type components } from '@mdplane/shared'
import { getApiBaseUrl } from '@/lib/api-url'

const QUIET_HTTP_STATUSES = new Set([400, 404])
const QUIET_ERROR_CODES = new Set([
  'INVALID_KEY',
  'FILE_NOT_FOUND',
  'FOLDER_NOT_FOUND',
  'INVALID_PATH',
  'PERMISSION_DENIED',
])

function shouldLogHttpStatus(status: number): boolean {
  return !QUIET_HTTP_STATUSES.has(status)
}

function shouldLogErrorCode(code?: string): boolean {
  if (!code) return false
  return !QUIET_ERROR_CODES.has(code)
}

function logCapabilityFetchError(...args: unknown[]) {
  if (process.env.NODE_ENV === 'production') return
  console.error(...args)
}

export interface FolderTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  updatedAt: string
  size?: number
  childCount?: number
}

interface FolderItem {
  type: 'file' | 'folder'
  name: string
  path?: string
  size?: number
  updatedAt: string
  childCount?: number
  urls?: {
    read: string | null
    append: string | null
    write: string | null
  }
}

/** Workspace context from capability API responses */
export interface WorkspaceContext {
  id: string
  name?: string
  claimed: boolean
}

interface FolderListApiResponse {
  ok: boolean
  data?: {
    path: string
    items: FolderItem[]
    webUrl?: string
    workspace?: WorkspaceContext
  }
  error?: {
    code: string
    message: string
  }
  pagination?: {
    cursor?: string
    hasMore: boolean
    total: number
  }
}

/**
 * Fetch folder contents from the API.
 *
 * This function is designed for use in Server Components (RSC).
 * It fetches the folder listing for a given capability key and path.
 *
 * @param key - The capability key
 * @param keyType - The key type ('r', 'a', or 'w')
 * @param path - Optional folder path (defaults to root)
 * @returns Array of folder tree nodes
 */
export async function fetchFolderContents(
  key: string,
  keyType: KeyType = 'r',
  path: string = ''
): Promise<FolderTreeNode[]> {
  const apiBaseUrl = getApiBaseUrl()
  const folderPath = path.trim().replace(/^\/+|\/+$/g, '')
  const url = `${apiBaseUrl}${FOLDER_ROUTES.byKeyType(keyType, key, folderPath || undefined)}`

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      if (shouldLogHttpStatus(response.status)) {
        logCapabilityFetchError(`[fetchFolderContents] API error: ${response.status}`)
      }
      return []
    }

    const data: FolderListApiResponse = await response.json()

    if (!data.ok || !data.data?.items) {
      if (shouldLogErrorCode(data.error?.code)) {
        logCapabilityFetchError('[fetchFolderContents] Invalid response:', data.error)
      }
      return []
    }

    return data.data.items.map((item) => ({
      name: item.name,
      path: item.path || `${folderPath ? folderPath + '/' : ''}${item.name}`,
      type: item.type,
      updatedAt: item.updatedAt,
      size: item.size,
      childCount: item.childCount,
    }))
  } catch (error) {
    logCapabilityFetchError('[fetchFolderContents] Fetch error:', error)
    return []
  }
}

/**
 * Query key factory for folder contents.
 * Ensures consistent query keys between server prefetch and client queries.
 */
export const folderContentsQueryKey = (
  keyType: KeyType,
  capabilityKey: string,
  path: string = ''
) => ['folder-contents', keyType, capabilityKey, path.trim().replace(/^\/+|\/+$/g, '')] as const

// PageTree types for Fumadocs compatibility
export interface PageTreePage {
  type: 'page'
  name: string
  url: string
}

export interface PageTreeFolder {
  type: 'folder'
  name: string
  defaultOpen: boolean
  children: PageTreeNode[]
}

export type PageTreeNode = PageTreePage | PageTreeFolder

export interface PageTreeRoot {
  name: string
  children: PageTreeNode[]
}

/**
 * Recursively build a PageTree with all folder contents pre-fetched.
 * This runs on the server for optimal performance.
 */
async function buildRecursiveTree(
  items: FolderTreeNode[],
  capabilityKey: string,
  keyType: KeyType,
  parentPath: string = '',
  maxDepth: number = 5
): Promise<PageTreeNode[]> {
  if (maxDepth <= 0) return []

  const nodes: PageTreeNode[] = []

  // Sort: folders first, then files, alphabetically
  const sorted = [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  for (const item of sorted) {
    const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name
    const url = `/${keyType}/${capabilityKey}/${itemPath}`

    if (item.type === 'file') {
      // Remove .md extension from display name if present
      const displayName = item.name.replace(/\.md$/, '')
      nodes.push({
        type: 'page',
        name: displayName,
        url,
      })
    } else {
      // Folder - fetch children recursively with error handling
      try {
        const children = await fetchFolderContents(capabilityKey, keyType, itemPath)
        const childNodes = await buildRecursiveTree(
          children,
          capabilityKey,
          keyType,
          itemPath,
          maxDepth - 1
        )

        nodes.push({
          type: 'folder',
          name: item.name,
          defaultOpen: false,
          children: childNodes,
        })
      } catch (error) {
        logCapabilityFetchError(`[buildRecursiveTree] Failed to fetch folder ${itemPath}:`, error)
        // Add folder with empty children on error - allows graceful degradation
        nodes.push({
          type: 'folder',
          name: item.name,
          defaultOpen: false,
          children: [],
        })
      }
    }
  }

  return nodes
}

/** Result of fetching complete page tree with workspace context */
export interface PageTreeWithWorkspace {
  pageTree: PageTreeRoot
  workspace: WorkspaceContext | null
}

/**
 * Fetch the complete folder tree for a capability key.
 * This is designed for use in Server Components to pre-fetch the entire tree.
 *
 * @param key - The capability key
 * @param keyType - The key type ('r', 'a', or 'w')
 * @param maxDepth - Maximum folder depth to fetch (default: 5)
 * @returns Complete PageTree for Fumadocs DocsLayout
 */
export async function fetchCompletePageTree(
  key: string,
  keyType: KeyType,
  maxDepth: number = 5
): Promise<PageTreeRoot> {
  const result = await fetchCompletePageTreeWithWorkspace(key, keyType, maxDepth)
  return result.pageTree
}

/**
 * Fetch the complete folder tree AND workspace context for a capability key.
 * This is designed for use in Server Components to pre-fetch everything needed for the layout.
 *
 * @param key - The capability key
 * @param keyType - The key type ('r', 'a', or 'w')
 * @param maxDepth - Maximum folder depth to fetch (default: 5)
 * @returns Complete PageTree and WorkspaceContext
 */
export async function fetchCompletePageTreeWithWorkspace(
  key: string,
  keyType: KeyType,
  maxDepth: number = 5
): Promise<PageTreeWithWorkspace> {
  try {
    const { items: rootItems, workspace } = await fetchFolderContentsWithWorkspace(key, keyType, '')
    const children = await buildRecursiveTree(rootItems, key, keyType, '', maxDepth)
    return {
      pageTree: {
        name: workspace?.name || 'Workspace',
        children,
      },
      workspace: workspace || null,
    }
  } catch (error) {
    logCapabilityFetchError('[fetchCompletePageTreeWithWorkspace] Failed to fetch tree:', error)
    return {
      pageTree: {
        name: 'Workspace',
        children: [],
      },
      workspace: null,
    }
  }
}

/**
 * Fetch folder contents with workspace context.
 * Returns both the items and the workspace metadata.
 */
async function fetchFolderContentsWithWorkspace(
  key: string,
  keyType: KeyType = 'r',
  path: string = ''
): Promise<{ items: FolderTreeNode[]; workspace?: WorkspaceContext }> {
  const apiBaseUrl = getApiBaseUrl()
  const folderPath = path.trim().replace(/^\/+|\/+$/g, '')
  const url = `${apiBaseUrl}${FOLDER_ROUTES.byKeyType(keyType, key, folderPath || undefined)}`

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      if (shouldLogHttpStatus(response.status)) {
        logCapabilityFetchError(`[fetchFolderContentsWithWorkspace] API error: ${response.status}`)
      }
      return { items: [] }
    }

    const data: FolderListApiResponse = await response.json()

    if (!data.ok || !data.data?.items) {
      if (shouldLogErrorCode(data.error?.code)) {
        logCapabilityFetchError('[fetchFolderContentsWithWorkspace] Invalid response:', data.error)
      }
      return { items: [] }
    }

    const items = data.data.items.map((item) => ({
      name: item.name,
      path: item.path || `${folderPath ? folderPath + '/' : ''}${item.name}`,
      type: item.type,
      updatedAt: item.updatedAt,
      size: item.size,
      childCount: item.childCount,
    }))

    return { items, workspace: data.data.workspace }
  } catch (error) {
    logCapabilityFetchError('[fetchFolderContentsWithWorkspace] Fetch error:', error)
    return { items: [] }
  }
}

export type FileContentData = components['schemas']['FileReadResponse']['data']

interface FileReadApiResponse {
  ok: boolean
  data?: FileContentData
  error?: {
    code: string
    message: string
  }
}

/**
 * Fetch file content on the server for SSR.
 * Returns null if the file cannot be fetched (404, error, etc.)
 *
 * @param key - The capability key
 * @param keyType - The key type ('r', 'a', or 'w')
 * @param filePath - Path to the file
 * @param options.appends - Number of appends to fetch (default: 50)
 * @param options.format - Response format: 'parsed' or 'raw' (default: 'parsed')
 */
export async function fetchFileContent(
  key: string,
  keyType: KeyType,
  filePath: string,
  options: { appends?: number; format?: 'parsed' | 'raw' } = {}
): Promise<FileContentData | null> {
  const baseUrl = getApiBaseUrl()
  const { appends = 50, format = 'parsed' } = options
  const url = `${baseUrl}/${keyType}/${key}/${filePath}?format=${format}&appends=${appends}`

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store', // Always fetch fresh for SSR
    })

    if (!response.ok) {
      if (shouldLogHttpStatus(response.status)) {
        logCapabilityFetchError(`[fetchFileContent] HTTP error: ${response.status}`)
      }
      return null
    }

    const json: FileReadApiResponse = await response.json()
    if (!json.ok || !json.data) {
      if (shouldLogErrorCode(json.error?.code)) {
        logCapabilityFetchError('[fetchFileContent] API error:', json.error?.message)
      }
      return null
    }

    return json.data
  } catch (error) {
    logCapabilityFetchError('[fetchFileContent] Failed to fetch:', error)
    return null
  }
}

