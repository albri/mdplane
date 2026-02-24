// API client for MarkdownPlane backend
import type {
  Webhook,
  ApiKey,
  ApiKeyCreateResponse,
  WebhookCreateRequest,
  WebhookCreateResponse,
  Error as ApiError,
  PaginatedResponse,
  MeResponse,
  ControlClaim,
  RotateAllResponse,
  OrchestrationReadOnlyResponse,
  WorkspaceRenameResponse,
} from '@mdplane/shared'
import {
  AUTH_ROUTES,
  WORKSPACE_ROUTES,
  SYSTEM_ROUTES,
} from '@mdplane/shared'
import { getApiBaseUrl } from './api-url'

const API_BASE_URL = getApiBaseUrl()

/**
 * Generic API response wrapper for the frontend client.
 * Note: This is NOT a generated type - it's a local wrapper that combines
 * success responses (ok: true, data: T) with error responses (ok: false, error: {...}).
 * Uses generated Error['error'] and PaginatedResponse types from @mdplane/shared.
 */
interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: ApiError['error']
  pagination?: PaginatedResponse
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // Handle empty or non-JSON responses gracefully
  const text = await response.text()
  if (!text || !text.trim()) {
    return {
      ok: false,
      error: {
        code: 'SERVER_ERROR',
        message: `Server returned empty response (${response.status})`,
      },
    }
  }

  try {
    const data = JSON.parse(text) as ApiResponse<T>
    return data
  } catch {
    // Response wasn't JSON - return error with raw text
    return {
      ok: false,
      error: {
        code: 'SERVER_ERROR',
        message: `Server returned non-JSON response: ${text.slice(0, 200)}`,
      },
    }
  }
}

export async function getCurrentUser() {
  return fetchApi<MeResponse['data']>(AUTH_ROUTES.me)
}

export type { ControlClaim, OrchestrationReadOnlyResponse } from '@mdplane/shared'

export interface OrchestrationFilters {
  status?: string
  priority?: string
  agent?: string
  file?: string
  folder?: string
}

export interface OrchestrationQueryOptions {
  limit?: number
  cursor?: string
}

export async function getOrchestration(
  workspaceId: string,
  filters?: OrchestrationFilters,
  options?: OrchestrationQueryOptions
) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.priority) params.set('priority', filters.priority)
  if (filters?.agent) params.set('agent', filters.agent)
  if (filters?.file) params.set('file', filters.file)
  if (filters?.folder) params.set('folder', filters.folder)
  if (typeof options?.limit === 'number') params.set('limit', String(options.limit))
  if (options?.cursor) params.set('cursor', options.cursor)
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchApi<OrchestrationReadOnlyResponse['data']>(
    `${WORKSPACE_ROUTES.orchestration(workspaceId)}${query}`
  )
}

export async function renewClaim(workspaceId: string, claimId: string, expiresInSeconds?: number) {
  return fetchApi<{ claim: ControlClaim; appendId?: string }>(
    WORKSPACE_ROUTES.orchestrationClaimRenew(workspaceId, claimId),
    {
      method: 'POST',
      body: JSON.stringify({ expiresInSeconds }),
    }
  )
}

export async function completeClaim(workspaceId: string, claimId: string, content?: string) {
  return fetchApi<{ claim: ControlClaim; appendId?: string }>(
    WORKSPACE_ROUTES.orchestrationClaimComplete(workspaceId, claimId),
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  )
}

export async function cancelClaim(workspaceId: string, claimId: string, reason?: string) {
  return fetchApi<{ claim: ControlClaim; appendId?: string }>(
    WORKSPACE_ROUTES.orchestrationClaimCancel(workspaceId, claimId),
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  )
}

export async function markClaimBlocked(workspaceId: string, claimId: string, reason: string) {
  return fetchApi<{ claim: ControlClaim; appendId?: string }>(
    WORKSPACE_ROUTES.orchestrationClaimBlock(workspaceId, claimId),
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  )
}

// API Keys
export type { ApiKey, ApiKeyCreateResponse } from '@mdplane/shared'

export async function getApiKeys(workspaceId: string) {
  return fetchApi<{ keys: ApiKey[] }>(WORKSPACE_ROUTES.apiKeys(workspaceId))
}

export async function createApiKey(workspaceId: string, data: {
  name: string
  permissions: Array<'read' | 'append' | 'write' | 'export'>
  expiresInSeconds?: number
}) {
  return fetchApi<ApiKeyCreateResponse['data']>(WORKSPACE_ROUTES.apiKeys(workspaceId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteApiKey(workspaceId: string, keyId: string) {
  return fetchApi<{ id: string; revoked: true }>(
    WORKSPACE_ROUTES.apiKey(workspaceId, keyId),
    { method: 'DELETE' }
  )
}

// Webhooks
export type { Webhook } from '@mdplane/shared'

export async function getWebhooks(workspaceId: string) {
  return fetchApi<Webhook[]>(WORKSPACE_ROUTES.webhooks(workspaceId))
}

export async function createWebhook(workspaceId: string, data: WebhookCreateRequest) {
  return fetchApi<WebhookCreateResponse['data']>(WORKSPACE_ROUTES.webhooks(workspaceId), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export type { RotateAllResponse } from '@mdplane/shared'

export async function rotateAllUrls(workspaceId: string) {
  return fetchApi<RotateAllResponse['data']>(WORKSPACE_ROUTES.rotateAll(workspaceId), {
    method: 'POST',
  })
}

export async function renameWorkspace(workspaceId: string, name: string) {
  return fetchApi<WorkspaceRenameResponse['data']>(WORKSPACE_ROUTES.rename(workspaceId), {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteWorkspace(workspaceId: string) {
  return fetchApi<{ message: string }>(WORKSPACE_ROUTES.workspace(workspaceId), {
    method: 'DELETE',
  })
}

// Capability Check
// Check if capability keys are valid and get their info (scopeId/workspaceId)
export interface CapabilityCheckResult {
  key: string
  valid: boolean
  permission?: 'read' | 'append' | 'write'
  scope?: 'workspace' | 'folder' | 'file'
  scopeId?: string
  error?: string
}

export async function checkCapabilities(keys: string[]) {
  return fetchApi<{ results: CapabilityCheckResult[] }>(SYSTEM_ROUTES.capabilitiesCheck, {
    method: 'POST',
    body: JSON.stringify({ keys }),
  })
}

