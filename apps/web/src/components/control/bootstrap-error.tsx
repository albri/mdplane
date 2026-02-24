'use client'

import { Button, buttonVariants } from '@mdplane/ui/ui/button'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { AlertCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@mdplane/ui/lib/utils'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'

interface BootstrapErrorProps {
  message: string | null
  onRetry: () => void
}

export function BootstrapError({ message, onRetry }: BootstrapErrorProps) {
  return (
    <div className="state-shell">
      <DiagonalStripes angle={135} spacing={24} className="opacity-30" />
      <IntersectionMarks size={52} className="opacity-20" />

      <div className="state-shell-content">
        <div className="state-shell-card w-full max-w-md p-8 text-center">
          <BorderedIcon variant="error" className="mx-auto mb-4 h-12 w-12">
            <AlertCircle className="h-6 w-6" />
          </BorderedIcon>

          <h2 className="mb-2 text-lg font-medium">Couldn&apos;t create workspace</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {message || 'Something went wrong. Please try again.'}
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Link
              href={CONTROL_FRONTEND_ROUTES.root}
              className={cn(
                buttonVariants({ variant: 'link' }),
                'mx-auto h-auto px-0 text-muted-foreground hover:text-foreground'
              )}
            >
              Back to control
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
