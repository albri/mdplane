'use client'

import { URLS, CONTROL_FRONTEND_ROUTES, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { FolderPlus, SquareKanban, Key, Settings, Webhook } from 'lucide-react'
import { useWorkspaces } from '@/contexts/workspace-context'
import { IconActionCard } from '@/components/ui/icon-action-card'

export function WelcomeState() {
  const { selectedWorkspace } = useWorkspaces()
  const orchestrationHref = selectedWorkspace
    ? CONTROL_FRONTEND_ROUTES.orchestration(selectedWorkspace.id)
    : CONTROL_FRONTEND_ROUTES.root
  const settingsHref = selectedWorkspace
    ? CONTROL_FRONTEND_ROUTES.settings(selectedWorkspace.id)
    : CONTROL_FRONTEND_ROUTES.root
  const apiKeysHref = selectedWorkspace
    ? CONTROL_FRONTEND_ROUTES.apiKeys(selectedWorkspace.id)
    : CONTROL_FRONTEND_ROUTES.root
  const webhooksHref = selectedWorkspace
    ? CONTROL_FRONTEND_ROUTES.webhooks(selectedWorkspace.id)
    : CONTROL_FRONTEND_ROUTES.root

  return (
    <div className="space-y-6" data-testid="control-welcome-state">
      <div className="grid gap-4 md:grid-cols-2">
        <IconActionCard
          title="Workspace Launcher"
          description="Create new workspaces and retrieve fresh capability keys."
          icon={FolderPlus}
          iconVariant="primary"
          primaryAction={{
            label: 'Open Launcher',
            href: WORKSPACE_FRONTEND_ROUTES.launch,
          }}
        />

        <IconActionCard
          title="Orchestration"
          description="Monitor active and stalled tasks, then intervene when needed."
          icon={SquareKanban}
          iconVariant="secondary"
          primaryAction={{
            label: 'Open Orchestration',
            href: orchestrationHref,
          }}
        />

        <IconActionCard
          title="API Keys"
          description="Create and revoke machine API keys for backend automation."
          icon={Key}
          iconVariant="secondary"
          primaryAction={{
            label: 'Manage API Keys',
            href: apiKeysHref,
          }}
        />

        <IconActionCard
          title="Webhooks"
          description="Configure outbound events for workspace and folder workflows."
          icon={Webhook}
          iconVariant="secondary"
          primaryAction={{
            label: 'Configure Webhooks',
            href: webhooksHref,
          }}
        />

        <IconActionCard
          title="Workspace Settings"
          description="Rename workspaces and manage rotation and recovery controls."
          icon={Settings}
          iconVariant="secondary"
          primaryAction={{
            label: 'Open Settings',
            href: settingsHref,
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Need docs?{' '}
        <a
          href={`${URLS.DOCS}/docs/web`}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Web app guide
        </a>
        {' '}·{' '}
        <a
          href={`${URLS.DOCS}/docs/authentication`}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Authentication
        </a>
        {' '}·{' '}
        <a
          href={`${URLS.DOCS}/docs/api-reference`}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          API reference
        </a>
      </p>
    </div>
  )
}
