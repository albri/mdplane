'use client'

import { AuthProvider, ProtectedRoute } from '@/components/auth'
import { ControlShell } from '@/components/control'
import type { MeResponse } from '@mdplane/shared'
import { WorkspaceProvider } from '@/contexts/workspace-context'

type Workspace = MeResponse['data']['workspaces'][number]

export function WorkspaceLayoutClient({
  workspaceId,
  workspaces,
  children,
}: {
  workspaceId: string
  workspaces: Workspace[]
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <WorkspaceProvider workspaceId={workspaceId} initialWorkspaces={workspaces}>
          <ControlShell>{children}</ControlShell>
        </WorkspaceProvider>
      </ProtectedRoute>
    </AuthProvider>
  )
}


