'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rotateAllUrls, deleteWorkspace, renameWorkspace } from '@/lib/api'
import { AUTH_ME_QUERY_KEY } from '@/lib/auth-me-query-key'

export function useRotateAllUrls(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await rotateAllUrls(workspaceId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to rotate URLs')
      }
      if (!response.data) {
        throw new Error('Rotate response did not include key data')
      }
      return response.data
    },
    onSuccess: () => {
      // Invalidate queries that depend on capability URLs
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
      }
    },
  })
}

export function useDeleteWorkspace(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await deleteWorkspace(workspaceId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to delete workspace')
      }
      return response.data
    },
    onSuccess: () => {
      // Invalidate all workspace-related queries
      queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
    },
  })
}

export function useRenameWorkspace(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Workspace name is required')

      const response = await renameWorkspace(workspaceId, trimmedName)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to rename workspace')
      }
      if (!response.data) {
        throw new Error('Rename response missing workspace payload')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
      }
    },
  })
}

