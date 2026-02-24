'use client'

import { useWorkspaces } from '@/contexts/workspace-context'

/**
 * Returns the selected workspace ID, or null if loading/not selected.
 * Components must handle null (show loading state or error).
 */
export function useWorkspaceId(): string | null {
  const { selectedWorkspace, isLoading } = useWorkspaces()
  
  if (isLoading || !selectedWorkspace) {
    return null
  }
  
  return selectedWorkspace.id
}
