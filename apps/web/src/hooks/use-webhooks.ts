'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWebhooks, createWebhook, type Webhook } from '@/lib/api'
import type { WebhookCreateRequest, WebhookUpdateRequest } from '@mdplane/shared'
import { WORKSPACE_ROUTES } from '@mdplane/shared'
import { getApiBaseUrl } from '@/lib/api-url'

const API_BASE_URL = getApiBaseUrl()

type ApiHookError = Error & { code?: string }

async function updateWebhook(workspaceId: string, webhookId: string, data: Partial<Webhook>) {
  const response = await fetch(`${API_BASE_URL}${WORKSPACE_ROUTES.webhook(workspaceId, webhookId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return response.json()
}

async function deleteWebhook(workspaceId: string, webhookId: string) {
  const response = await fetch(`${API_BASE_URL}${WORKSPACE_ROUTES.webhook(workspaceId, webhookId)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return response.json()
}

async function testWebhook(workspaceId: string, webhookId: string) {
  const response = await fetch(`${API_BASE_URL}${WORKSPACE_ROUTES.webhookTest(workspaceId, webhookId)}`, {
    method: 'POST',
    credentials: 'include',
  })
  return response.json()
}

export function useWebhooks(workspaceId: string | null) {
  return useQuery({
    queryKey: ['webhooks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await getWebhooks(workspaceId)
      if (!response.ok) {
        const error = new Error(response.error?.message || 'Failed to fetch webhooks') as ApiHookError
        error.code = response.error?.code
        throw error
      }
      return response.data ?? []
    },
    enabled: !!workspaceId,
  })
}

export function useCreateWebhook(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: WebhookCreateRequest) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await createWebhook(workspaceId, data)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to create webhook')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] })
    },
  })
}

export function useUpdateWebhook(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ webhookId, data }: { webhookId: string; data: WebhookUpdateRequest }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await updateWebhook(workspaceId, webhookId, data)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to update webhook')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] })
    },
  })
}

export function useDeleteWebhook(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (webhookId: string) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await deleteWebhook(workspaceId, webhookId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to delete webhook')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId] })
    },
  })
}

export function useTestWebhook(workspaceId: string | null) {
  return useMutation({
    mutationFn: async (webhookId: string) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const response = await testWebhook(workspaceId, webhookId)
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to test webhook')
      }
      return response.data
    },
  })
}

export type { Webhook }


