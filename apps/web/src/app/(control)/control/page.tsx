import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AUTH_FRONTEND_ROUTES, CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { ControlModeNotConfiguredState, ControlNoWorkspacesState } from '@/components/control'
import { CONTROL_LAST_WORKSPACE_COOKIE } from '@/lib/control-workspace-routing'
import { getAuthMe } from '@/lib/server/get-auth-me'
import { webEnv } from '@/config/env'

export default async function ControlRootPage() {
  if (!webEnv.governedModeEnabled) {
    return <ControlModeNotConfiguredState />
  }

  const cookieStore = await cookies()
  const meResult = await getAuthMe(cookieStore.toString())

  if (meResult.status === 'unauthenticated') {
    redirect(AUTH_FRONTEND_ROUTES.loginWithRedirect(CONTROL_FRONTEND_ROUTES.root))
  }

  if (meResult.status === 'error') {
    throw new Error('Failed to load authenticated workspace context')
  }

  const me = meResult.data

  if (me.workspaces.length === 0) {
    return <ControlNoWorkspacesState />
  }

  const preferredWorkspaceId = cookieStore.get(CONTROL_LAST_WORKSPACE_COOKIE)?.value
  const hasPreferredWorkspace = preferredWorkspaceId
    ? me.workspaces.some((workspace) => workspace.id === preferredWorkspaceId)
    : false

  const selectedWorkspaceId = hasPreferredWorkspace && preferredWorkspaceId
    ? preferredWorkspaceId
    : me.workspaces[0].id

  if (!selectedWorkspaceId) {
    return <ControlNoWorkspacesState />
  }

  redirect(CONTROL_FRONTEND_ROUTES.workspace(selectedWorkspaceId))
}

