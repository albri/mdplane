'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { Button } from '@mdplane/ui/ui/button'
import { Check, Settings } from 'lucide-react'
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
          <Check className="h-4 w-4" />
          <span>Claimed</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          asChild
        >
          <Link href={CONTROL_FRONTEND_ROUTES.workspace(workspaceId)}>
            <Settings className="h-4 w-4" />
            Control Panel
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}

