/**
 * Server-side capability key validation.
 *
 * This module provides server-side validation for capability keys (r/a/w).
 * Used in RSC layouts to validate keys before rendering, enabling immediate
 * 404 responses for invalid keys instead of client-side spinner → 404 flow.
 */

import { SYSTEM_ROUTES } from '@mdplane/shared'
import { getApiBaseUrl } from '@/lib/api-url'

export type KeyType = 'r' | 'a' | 'w'

export interface KeyValidationResult {
  valid: boolean
  workspaceId?: string
  permission?: 'read' | 'append' | 'write'
  scope?: 'workspace' | 'folder' | 'file'
  scopePath?: string
  error?: string
}

interface CapabilityCheckResponse {
  ok: boolean
  data?: {
    results: Array<{
      key: string
      valid: boolean
      permission?: 'read' | 'append' | 'write'
      scope?: 'workspace' | 'folder' | 'file'
      scopeId?: string
      error?: string
    }>
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * Validate a capability key server-side.
 *
 * This function is designed for use in Server Components (RSC).
 * It calls the backend /capabilities/check endpoint to validate the key.
 *
 * @param key - The capability key to validate (without prefix)
 * @param expectedKeyType - The expected key type ('r', 'a', or 'w')
 * @returns Validation result with workspace info if valid
 */
export async function validateCapabilityKey(
  key: string,
  expectedKeyType: KeyType
): Promise<KeyValidationResult> {
  const apiBaseUrl = getApiBaseUrl()

  try {
    const response = await fetch(`${apiBaseUrl}${SYSTEM_ROUTES.capabilitiesCheck}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys: [key] }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return { valid: false, error: `API error: ${response.status}` }
    }

    const data: CapabilityCheckResponse = await response.json()

    if (!data.ok || !data.data?.results?.length) {
      return { valid: false, error: 'Invalid response from server' }
    }

    const result = data.data.results[0]

    if (!result.valid) {
      return { valid: false, error: result.error || 'Invalid key' }
    }

    // Verify the key type matches what we expect
    const expectedPermission = keyTypeToPermission(expectedKeyType)
    if (result.permission !== expectedPermission) {
      return {
        valid: false,
        error: `Key has ${result.permission} permission, expected ${expectedPermission}`,
      }
    }

    return {
      valid: true,
      workspaceId: result.scopeId,
      permission: result.permission,
      scope: result.scope,
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Convert key type prefix to permission name.
 */
function keyTypeToPermission(keyType: KeyType): 'read' | 'append' | 'write' {
  switch (keyType) {
    case 'r':
      return 'read'
    case 'a':
      return 'append'
    case 'w':
      return 'write'
  }
}

