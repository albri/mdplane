import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AUTH_FRONTEND_ROUTES, CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { ControlModeNotConfiguredState } from '@/components/control'
import { webEnv } from '@/config/env'
import { isWorkspaceId } from '@/lib/control-workspace-routing'
import { getAuthMe } from '@/lib/server/get-auth-me'
import { WorkspaceLayoutClient } from './workspace-layout-client'

export default async function WorkspaceScopedControlLayout({
  params,
  children,
}: {
  params: Promise<{ workspaceId: string }>
  children: React.ReactNode
}) {
  const { workspaceId } = await params

  if (!isWorkspaceId(workspaceId)) {
    notFound()
  }
  if (!webEnv.governedModeEnabled) {
    return <ControlModeNotConfiguredState />
  }

  const cookieStore = await cookies()
  const meResult = await getAuthMe(cookieStore.toString())

  if (meResult.status === 'unauthenticated') {
    redirect(AUTH_FRONTEND_ROUTES.loginWithRedirect(CONTROL_FRONTEND_ROUTES.workspace(workspaceId)))
  }

  if (meResult.status === 'error') {
    throw new Error('Failed to load authenticated workspace context')
  }

  const me = meResult.data

  if (me.workspaces.length === 0) {
    redirect(CONTROL_FRONTEND_ROUTES.root)
  }

  const hasWorkspaceAccess = me.workspaces.some((workspace) => workspace.id === workspaceId)
  if (!hasWorkspaceAccess) {
    redirect(CONTROL_FRONTEND_ROUTES.root)
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WorkspaceLayoutClient workspaceId={workspaceId} workspaces={me.workspaces}>
        {children}
      </WorkspaceLayoutClient>
    </Suspense>
  )
}
