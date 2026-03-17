'use client'

import { useQuery } from '@tanstack/react-query'
import type { Error as ApiErrorResponse } from '@mdplane/shared'
import { FOLDER_ROUTES, type KeyType } from '@mdplane/shared'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'

// Re-export KeyType for convenience
export type { KeyType } from '@mdplane/shared'

export interface FolderItem {
  type: 'file' | 'folder'
  name: string
  size?: number
  updatedAt: string
  childCount?: number
  urls?: {
    read: string | null
    append: string | null
    write: string | null
  }
}

export interface FolderListResponse {
  path: string
  items: FolderItem[]
}

type FolderListApiResponse = {
  ok: boolean
  data?: FolderListResponse
  error?: ApiErrorResponse['error']
  pagination?: {
    cursor?: string
    hasMore: boolean
    total: number
  }
}

/**
 * Hook to fetch folder contents using a capability key.
 * Supports read, write, and append key types.
 */
export function useFolderContents(
  capabilityKey: string,
  path: string = '',
  keyType: KeyType = 'r',
  enabled: boolean = true
) {
  const folderPath = path.trim().replace(/^\/+|\/+$/g, '')
  const url = capabilityProxyRoute(
    FOLDER_ROUTES.byKeyType(keyType, capabilityKey, folderPath || undefined)
  )

  return useQuery({
    queryKey: ['folder-contents', keyType, capabilityKey, folderPath],
    queryFn: async () => {
      const response = await fetch(url)
      const data: FolderListApiResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || 'Failed to fetch folder contents')
      }

      return data.data
    },
    enabled: !!capabilityKey && enabled,
    retry: false,
  })
}
