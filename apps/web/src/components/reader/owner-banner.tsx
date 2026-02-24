'use client'

import { Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@mdplane/ui/ui/button'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'

interface OwnerBannerProps {
  workspaceId: string
}

export function OwnerBanner({ workspaceId }: OwnerBannerProps) {
  return (
    <div
      className="border-b border-border/70 bg-muted/25 px-4 py-3"
      data-testid="owner-banner"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>You own this workspace</span>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
          <Link href={CONTROL_FRONTEND_ROUTES.workspace(workspaceId)}>
            Go to Control Panel →
          </Link>
        </Button>
      </div>
    </div>
  )
}

