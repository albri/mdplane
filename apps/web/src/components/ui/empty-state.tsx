'use client'

import { useState } from 'react'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'
import { Copy, Check, ArrowRight } from 'lucide-react'
import { GeometricGrid } from '@/components/ui/patterns'

interface EmptyStateAction {
  label: string
  onClick: () => void
  href?: never
}

interface EmptyStateLinkAction {
  label: string
  href: string
  onClick?: never
}

interface EmptyStateProps {
  icon?: React.ReactNode
  headline: string
  description?: string
  command?: string
  primaryAction?: EmptyStateAction | EmptyStateLinkAction
  secondaryAction?: EmptyStateAction | EmptyStateLinkAction
  className?: string
}

export function EmptyState({
  icon,
  headline,
  description,
  command,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCommand = async () => {
    if (command) {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border border-border/80 bg-card px-6 py-12 text-center shadow-sm',
        className
      )}
      data-testid="empty-state"
    >
      <GeometricGrid size={28} />
      {icon && (
        <div className="mb-4 text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}

      <p className="text-2xl font-semibold tracking-tight">{headline}</p>

      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {command && (
        <pre className="mt-6 max-w-lg overflow-x-auto bg-muted p-4 text-left font-mono text-xs">
          {command}
        </pre>
      )}

      <div className="mt-5 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
        {command && (
            <Button
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
              onClick={handleCopyCommand}
              data-testid="empty-state-copy-btn"
            >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy command'}
          </Button>
        )}
        {primaryAction && (
          'href' in primaryAction ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={primaryAction.href}>
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button onClick={primaryAction.onClick} className="w-full sm:w-auto">
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )
        )}
      </div>

      {secondaryAction && (
        'href' in secondaryAction ? (
          <a
            href={secondaryAction.href}
            className="mt-2 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {secondaryAction.label}
          </a>
        ) : (
          <button
            className="mt-2 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )
      )}
    </div>
  )
}


