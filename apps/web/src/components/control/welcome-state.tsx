'use client'

import Link from 'next/link'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { SquareKanban, Key, Settings, Webhook, ArrowRight } from 'lucide-react'
import { useWorkspaces } from '@/contexts/workspace-context'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'

export function WelcomeState() {
  const { selectedWorkspace } = useWorkspaces()

  const links = [
    {
      title: 'Orchestration',
      description: 'Monitor tasks and intervene when needed',
      icon: SquareKanban,
      iconVariant: 'amber' as const,
      href: selectedWorkspace
        ? CONTROL_FRONTEND_ROUTES.orchestration(selectedWorkspace.id)
        : CONTROL_FRONTEND_ROUTES.root,
    },
    {
      title: 'API Keys',
      description: 'Manage programmatic access',
      icon: Key,
      iconVariant: 'sage' as const,
      href: selectedWorkspace
        ? CONTROL_FRONTEND_ROUTES.apiKeys(selectedWorkspace.id)
        : CONTROL_FRONTEND_ROUTES.root,
    },
    {
      title: 'Webhooks',
      description: 'Configure event notifications',
      icon: Webhook,
      iconVariant: 'terracotta' as const,
      href: selectedWorkspace
        ? CONTROL_FRONTEND_ROUTES.webhooks(selectedWorkspace.id)
        : CONTROL_FRONTEND_ROUTES.root,
    },
    {
      title: 'Settings',
      description: 'Workspace configuration',
      icon: Settings,
      iconVariant: 'primary' as const,
      href: selectedWorkspace
        ? CONTROL_FRONTEND_ROUTES.settings(selectedWorkspace.id)
        : CONTROL_FRONTEND_ROUTES.root,
    },
  ]

  return (
    <div data-testid="control-welcome-state">
      <nav className="grid gap-2 sm:grid-cols-2">
        {links.map(({ title, description, icon: Icon, iconVariant, href }) => (
          <Link
            key={title}
            href={href}
            className="group flex items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <BorderedIcon variant={iconVariant} size="md">
              <Icon aria-hidden="true" />
            </BorderedIcon>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground truncate">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  )
}
