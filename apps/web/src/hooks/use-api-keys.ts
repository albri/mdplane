'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiKeys, createApiKey, deleteApiKey, type ApiKey } from '@/lib/api'

export function useApiKeys(workspaceId: string | null) {
  return useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await getApiKeys(workspaceId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to fetch API keys')
      }
      return response.data?.keys ?? []
    },
    enabled: !!workspaceId,
  })
}

export function useCreateApiKey(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      permissions: Array<'read' | 'append' | 'write' | 'export'>
      expiresInSeconds?: number
    }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await createApiKey(workspaceId, data)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to create API key')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] })
      }
    },
  })
}

export function useDeleteApiKey(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (keyId: string) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await deleteApiKey(workspaceId, keyId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to delete API key')
      }
      return response.data
    },
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] })
      }
    },
  })
}

export type { ApiKey }


