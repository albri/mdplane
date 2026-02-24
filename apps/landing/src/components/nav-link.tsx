import type { ReactNode } from 'react'
import Link from 'next/link'

import { cn } from '@mdplane/ui/lib/utils'

type NavLinkProps = {
  href: string
  children: ReactNode
  external?: boolean
  className?: string
}

export function NavLink({ href, children, external, className }: NavLinkProps) {
  const shouldUseNextLink = external !== true && href.startsWith('/')
  const baseClassName =
    'rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

  if (shouldUseNextLink) {
    return (
      <Link href={href} className={cn(baseClassName, className)}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={href}
      className={cn(baseClassName, className)}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {children}
    </a>
  )
}

type FooterLinkProps = {
  href: string
  children: ReactNode
  external?: boolean
}

export function FooterLink({ href, children, external }: FooterLinkProps) {
  const shouldUseNextLink = external !== true && href.startsWith('/')
  const className =
    'rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

  if (shouldUseNextLink) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={href}
      className={className}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {children}
    </a>
  )
}
