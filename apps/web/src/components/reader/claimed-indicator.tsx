'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { Button } from '@mdplane/ui/ui/button'
import { BadgeCheck, Settings } from 'lucide-react'
import Link from 'next/link'

interface ClaimedIndicatorProps {
  workspaceId: string
}

export function ClaimedIndicator({ workspaceId }: ClaimedIndicatorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="claimed-workspace-button"
          className="text-muted-foreground"
        >
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          <span>Owned</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          You own this workspace. Manage settings from the control panel.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          asChild
        >
          <Link href={CONTROL_FRONTEND_ROUTES.workspace(workspaceId)}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            Open Control Panel
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}

