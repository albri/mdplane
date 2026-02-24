'use client'

import { createContext, useContext, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import type { MeResponse } from '@mdplane/shared'
import { getCurrentUser } from '@/lib/api'
import { AUTH_ME_QUERY_KEY } from '@/lib/auth-me-query-key'
import { buildControlWorkspacePath } from '@/lib/control-workspace-routing'

type Workspace = MeResponse['data']['workspaces'][number]

interface WorkspaceContextValue {
  workspaces: Workspace[]
  selectedWorkspace: Workspace | null
  selectWorkspace: (workspaceId: string) => void
  isLoading: boolean
  error: Error | null
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspaces() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspaces must be used within WorkspaceProvider')
  }
  return context
}

export function WorkspaceProvider({
  workspaceId,
  initialWorkspaces,
  children,
}: {
  workspaceId: string
  initialWorkspaces?: Workspace[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const { data, isLoading, error } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: async () => {
      const response = await getCurrentUser()
      if (!response.ok) {
        throw new Error(response.error?.message || 'Failed to fetch user')
      }
      return response.data?.workspaces ?? []
    },
    staleTime: 5 * 60 * 1000,
    initialData: initialWorkspaces,
  })

  const workspaces = data ?? []

  const selectWorkspace = useCallback((workspaceId: string) => {
    const nextPath = buildControlWorkspacePath(pathname, workspaceId)
    router.push(nextPath)
  }, [pathname, router])

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        selectedWorkspace,
        selectWorkspace,
        isLoading,
        error: error || null,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
