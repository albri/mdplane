'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'

interface ControlHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  links?: Array<{
    href: string
    label: string
    external?: boolean
  }>
  className?: string
}

export function ControlHeader({ title, description, actions, links = [], className }: ControlHeaderProps) {
  return (
    <header className={cn('mb-2 flex flex-col gap-4 border-b border-border/70 pb-4 sm:mb-3', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
          {links.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {links.map((link) => (
                <Button key={`${link.href}:${link.label}`} asChild variant="outline" size="sm">
                  <Link
                    href={link.href}
                    {...(link.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  >
                    {link.label}
                    {link.external ? <ExternalLink className="size-3.5" /> : null}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </header>
  )
}

