'use client'

import Link from 'next/link'
import { URLS } from '@mdplane/shared'
import { cn } from '@mdplane/ui/lib/utils'

interface AppFooterProps {
  className?: string
}

export function AppFooter({ className }: AppFooterProps) {
  return (
    <footer className={cn('mt-10 border-t border-border/70 pt-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">
          <span className="text-primary">md</span>
          <span>plane</span>
        </span>
        <nav className="inline-flex flex-wrap items-center gap-3">
          <Link href={URLS.DOCS} className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <Link href={URLS.API} className="transition-colors hover:text-foreground">
            API
          </Link>
          <a
            href={URLS.STATUS}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Status
          </a>
        </nav>
      </div>
    </footer>
  )
}
