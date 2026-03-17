'use client'

import { ControlContent, ControlHeader, WelcomeState } from '@/components/control'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@mdplane/ui/ui/button'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatsGridSkeleton, TableSkeleton } from '@/components/ui/skeletons'
import { useControlClaims, useWorkspaceId } from '@/hooks'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { Files, Key, Webhook, SquareKanban, Settings, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { VariantProps } from 'class-variance-authority'

type BorderedIconVariant = 'primary' | 'terracotta' | 'amber' | 'sage' | 'muted' | 'secondary'

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  description,
  iconVariant = 'muted'
}: {
  title: string
  value: string | number
  icon: React.ElementType
  href: string
  description?: string
  iconVariant?: BorderedIconVariant
}) {
  return (
    <Link href={href}>
      <Card tone="interactive" size="sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <BorderedIcon variant={iconVariant} size="sm">
            <Icon aria-hidden="true" />
          </BorderedIcon>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {description && (
            <CardDescription className="text-xs">{description}</CardDescription>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default function ControlPage() {
  const workspaceId = useWorkspaceId()
  const orchestrationHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.orchestration(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const apiKeysHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.apiKeys(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const webhooksHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.webhooks(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const settingsHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.settings(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const { data: claims = [], isLoading, error } = useControlClaims(workspaceId, undefined)

  const activeClaims = claims.filter(c => c.status === 'active').length
  const completedClaims = claims.filter(c => c.status === 'completed').length
  const expiredClaims = claims.filter(c => c.status === 'expired').length
  const isEmpty = !isLoading && !error && claims.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col">
        <ControlHeader
          title="Welcome"
          description="Get started with your workspace"
        />
        <ControlContent>
          <WelcomeState />
        </ControlContent>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <ControlHeader
          title="Welcome"
          description="Workspace dashboard and orchestration activity"
        />
        <ControlContent>
          <StatsGridSkeleton count={4} />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card tone="muted" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Files className="h-4 w-4" />
                  Recent Claims
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TableSkeleton rows={5} />
              </CardContent>
            </Card>
            <Card tone="muted" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TableSkeleton rows={3} />
              </CardContent>
            </Card>
          </div>
        </ControlContent>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <ControlHeader
          title="Welcome"
          description="Workspace dashboard and orchestration activity"
        />
        <ControlContent>
          <EmptyState
            icon={<AlertTriangle />}
            iconVariant="error"
            headline="Couldn't load workspace activity"
            description="Something went wrong loading the workspace."
            primaryAction={{ label: 'Try again', onClick: () => window.location.reload() }}
            className="py-12"
          />
        </ControlContent>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <ControlHeader
        title="Welcome"
        description="Workspace dashboard and orchestration activity"
      />

      <ControlContent>
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Active Tasks"
            value={activeClaims}
            icon={Clock}
            href={orchestrationHref}
            description="Tasks currently being worked on"
            iconVariant="amber"
          />
          <StatCard
            title="Completed Today"
            value={completedClaims}
            icon={CheckCircle}
            href={orchestrationHref}
            description="Tasks finished today"
            iconVariant="sage"
          />
          <StatCard
            title="Expired Claims"
            value={expiredClaims}
            icon={AlertTriangle}
            href={orchestrationHref}
            description="Claims that need attention"
            iconVariant="terracotta"
          />
          <StatCard
            title="Orchestration"
            value={activeClaims + expiredClaims}
            icon={SquareKanban}
            href={orchestrationHref}
            description="Tasks that need active attention"
            iconVariant="primary"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card tone="muted" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Files className="h-4 w-4" aria-hidden="true" />
                Recent Task Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims yet</p>
              ) : (
                <ul className="space-y-2">
                  {claims.slice(0, 5).map((claim) => (
                    <li key={claim.id} className="rounded-md border border-border/70 bg-background p-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{claim.taskTitle}</p>
                        <p className="font-mono text-xs text-muted-foreground">{claim.path}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{claim.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card tone="muted" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-4 w-4" aria-hidden="true" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li>
                  <Button variant="ghost" asChild className="w-full justify-start text-sm">
                    <Link href={apiKeysHref}>
                      <Key className="h-4 w-4" aria-hidden="true" />
                      Manage API Keys
                    </Link>
                  </Button>
                </li>
                <li>
                  <Button variant="ghost" asChild className="w-full justify-start text-sm">
                    <Link href={webhooksHref}>
                      <Webhook className="h-4 w-4" aria-hidden="true" />
                      Configure Webhooks
                    </Link>
                  </Button>
                </li>
                <li>
                  <Button variant="ghost" asChild className="w-full justify-start text-sm">
                    <Link href={settingsHref}>
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Workspace Settings
                    </Link>
                  </Button>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </ControlContent>
    </div>
  )
}


