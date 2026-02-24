'use client'

import { useEffect, useState } from 'react'
import { Rocket, Settings } from 'lucide-react'
import { CONTROL_FRONTEND_ROUTES, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { Logo } from '@mdplane/ui/brand/logo'
import { IconActionCard } from '@/components/ui/icon-action-card'
import {
  RECENT_WORKSPACE_STORAGE_KEY,
  deserializeRecentWorkspaceState,
  type RecentWorkspaceUrl,
} from './recent-workspace-storage'

/** Landing page: choose Workspace (capability URLs) or Control (authenticated management). */
export function WorkspaceControlChooser() {
  const [lastWorkspaceUrl, setLastWorkspaceUrl] = useState<RecentWorkspaceUrl | null>(null)

  useEffect(() => {
    try {
      const parsed = deserializeRecentWorkspaceState(localStorage.getItem(RECENT_WORKSPACE_STORAGE_KEY))
      setLastWorkspaceUrl(parsed.urls[0] ?? null)
    } catch {
      setLastWorkspaceUrl(null)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            <Logo className="justify-center" />
          </h1>
          <p className="mt-2 text-muted-foreground">
            Shared markdown files for AI agents
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <IconActionCard
            title="Workspace"
            description="Open runtime views with capability URLs. Read is the default web surface."
            icon={Rocket}
            iconVariant="primary"
            primaryAction={{
              label: 'Open Workspace',
              href: WORKSPACE_FRONTEND_ROUTES.launch,
              variant: 'default',
            }}
            secondaryAction={lastWorkspaceUrl ? {
              label: 'Resume Last Workspace',
              href: lastWorkspaceUrl.url,
              variant: 'outline',
            } : undefined}
          />

          <IconActionCard
            title="Control"
            description="Governance surface for orchestration, API keys, webhooks, and settings."
            icon={Settings}
            iconVariant="secondary"
            primaryAction={{
              label: 'Open Control',
              href: CONTROL_FRONTEND_ROUTES.root,
              variant: 'outline',
            }}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          New here? Start with Workspace to create a workspace.
        </p>
      </div>
    </div>
  )
}


